import { App as NativeApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { deleteOccurrence, reconcileSeries, toggleCompleted } from '../domain/calendar';
import { todayKey } from '../domain/dates';
import type { HolidayFeed } from '../domain/holidays';
import {
  type Category,
  type EventFields,
  type EventRecord,
  type Occurrence,
  type PhotoMeta,
  type Repeat,
  type Snapshot,
  snapshotSchema,
} from '../domain/model';
import { parseBackup } from '../platform/backup';
import { syncReminders } from '../platform/notifications';
import { cleanupExpiredPhotos, flushPhotoDeletes } from '../platform/photo-cleanup';
import { bundledPolicies, cachedPolicies, refreshPolicies } from '../platform/policies';
import { createRepository } from '../platform/repository';

export interface SaveEventInput {
  fields: EventFields;
  date: string | null;
  repeat: Repeat;
  until: string | null;
  event?: EventRecord;
  occurrence?: Occurrence;
  scope: 'one' | 'series';
  category?: Category;
  photo?: { blob: Blob; name: string };
}

const repository = createRepository();

export function useAppModel() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const current = useRef<Snapshot | null>(null);
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const pending = useRef(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [policies, setPolicies] = useState<HolidayFeed>(bundledPolicies);
  const policyRef = useRef(policies);

  const report = useCallback((value: unknown) => {
    setMessage(value instanceof Error ? value.message : '操作失败，请重试。');
  }, []);

  const mutate = useCallback(
    async (change: (state: Snapshot) => Snapshot, photo?: { id: string; blob: Blob }) => {
      pending.current++;
      setBusy(true);
      const job = chain.current.then(async () => {
        const previous = current.current;
        if (!previous) throw new Error('数据尚未准备完成。');
        let next = snapshotSchema.parse(change(previous));
        const removed = previous.photos
          .filter((item) => !next.photos.some((target) => target.id === item.id))
          .map((item) => item.id);
        next = {
          ...next,
          pendingPhotoDeletes: [
            ...new Set([...previous.pendingPhotoDeletes, ...next.pendingPhotoDeletes, ...removed]),
          ],
        };
        if (photo) await repository.savePhoto(photo.id, photo.blob);
        try {
          await repository.save(next);
        } catch (saveError) {
          if (photo) await repository.deletePhoto(photo.id).catch(() => {});
          throw saveError;
        }
        current.current = next;
        setSnapshot(next);
        try {
          next = await flushPhotoDeletes(next, repository);
          current.current = next;
          setSnapshot(next);
        } catch {
          setMessage('事项已保存，附件清理将在下次打开时继续。');
        }
        await syncReminders(next).catch(() =>
          setMessage('事项已保存，系统提醒暂未完成设置，请到设置中检查通知权限。'),
        );
        return next;
      });
      chain.current = job.catch(() => {});
      try {
        return await job;
      } finally {
        pending.current--;
        setBusy(pending.current > 0);
      }
    },
    [],
  );

  const clean = useCallback(async () => {
    const job = chain.current.then(async () => {
      if (!current.current) return;
      const next = await cleanupExpiredPhotos(current.current, repository);
      current.current = next;
      setSnapshot(next);
      await syncReminders(next);
    });
    chain.current = job.catch(() => {});
    await job;
  }, []);

  const updatePolicies = useCallback(async (url?: string) => {
    const feed = url ?? current.current?.settings.holidayFeedUrl ?? '';
    if (!feed) throw new Error('请先填写已审核的假期数据地址。');
    const next = await refreshPolicies(feed, policyRef.current);
    policyRef.current = next;
    setPolicies(next);
    setMessage('假期政策数据已更新。');
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      let loaded = await repository.load();
      loaded = await cleanupExpiredPhotos(loaded, repository);
      const feed = await cachedPolicies();
      if (!active) return;
      if (!loaded.settings.holidayFeedUrl && import.meta.env.VITE_HOLIDAY_FEED_URL)
        loaded.settings.holidayFeedUrl = import.meta.env.VITE_HOLIDAY_FEED_URL;
      current.current = loaded;
      setSnapshot(loaded);
      policyRef.current = feed;
      setPolicies(feed);
      await syncReminders(loaded).catch(() => {});
      if (loaded.settings.holidayFeedUrl) {
        const refreshed = await refreshPolicies(loaded.settings.holidayFeedUrl, feed).catch(
          () => null,
        );
        if (active && refreshed) {
          policyRef.current = refreshed;
          setPolicies(refreshed);
        }
      }
    };
    void load().catch(() => {
      if (active)
        setError('本机数据读取失败。原有数据不会被覆盖，请关闭其他窗口后重试；请勿清除应用数据。');
    });
    const onVisible = () => {
      if (document.visibilityState === 'visible') void clean().catch(report);
    };
    document.addEventListener('visibilitychange', onVisible);
    const listener = Capacitor.isNativePlatform()
      ? NativeApp.addListener('appStateChange', ({ isActive }) => {
          if (isActive) void clean().catch(report);
        })
      : null;
    return () => {
      active = false;
      document.removeEventListener('visibilitychange', onVisible);
      void listener?.then((handle) => handle.remove());
    };
  }, [clean, report]);

  const saveEvent = useCallback(
    async (input: SaveEventInput) => {
      const now = Date.now();
      const eventId = input.event?.id ?? crypto.randomUUID();
      const photoId = input.photo ? crypto.randomUUID() : null;
      const next = await mutate(
        (previous) => {
          let categories = previous.categories;
          let fields = input.fields;
          if (input.category) {
            const same = categories.find(
              (category) => category.name === input.category?.name.trim(),
            );
            if (same) fields = { ...fields, categoryId: same.id };
            else categories = [...categories, input.category];
          }
          const existing = previous.events.find((event) => event.id === eventId);
          let record: EventRecord;
          if (existing && input.occurrence && input.scope === 'one' && existing.repeat !== 'none') {
            if (!input.date) throw new Error('单次重复事项需保留日期；待整理请选择整个系列。');
            record = {
              ...existing,
              updatedAt: now,
              exceptions: {
                ...existing.exceptions,
                [input.occurrence.originalDate]: { cancelled: false, date: input.date, fields },
              },
            };
          } else {
            record = {
              id: eventId,
              fields,
              date: input.date,
              repeat: input.date ? input.repeat : 'none',
              until: input.repeat === 'none' ? null : input.until,
              exceptions: existing?.exceptions ?? {},
              createdAt: existing?.createdAt ?? now,
              updatedAt: now,
            };
          }
          const reconciled =
            input.scope === 'series'
              ? reconcileSeries(record, previous.photos)
              : { record, photos: previous.photos };
          record = reconciled.record;
          const photos = [...reconciled.photos];
          if (input.photo && photoId) {
            const photo: PhotoMeta = {
              id: photoId,
              eventId,
              occurrenceDate:
                input.scope === 'one' && input.occurrence
                  ? input.occurrence.originalDate
                  : input.date,
              createdAt: now,
              name: input.photo.name.slice(0, 200),
              mime: input.photo.blob.type as PhotoMeta['mime'],
              bytes: input.photo.blob.size,
            };
            photos.push(photo);
          }
          return {
            ...previous,
            categories,
            events: existing
              ? previous.events.map((event) => (event.id === eventId ? record : event))
              : [...previous.events, record],
            photos,
          };
        },
        input.photo && photoId ? { id: photoId, blob: input.photo.blob } : undefined,
      );
      setMessage(input.date ? '已记下这件事。' : '已存入待整理，之后可以补日期。');
      return next.events.find((event) => event.id === eventId);
    },
    [mutate],
  );

  const removeEvent = useCallback(
    async (event: EventRecord, occurrence?: Occurrence, scope: 'one' | 'series' = 'series') => {
      await mutate((previous) =>
        occurrence
          ? deleteOccurrence(previous, occurrence, scope)
          : {
              ...previous,
              events: previous.events.filter((item) => item.id !== event.id),
              photos: previous.photos.filter((photo) => photo.eventId !== event.id),
              completed: previous.completed.filter((key) => !key.startsWith(`${event.id}@`)),
            },
      );
      setMessage(scope === 'one' ? '本次事项已删除。' : '事项已删除。');
    },
    [mutate],
  );

  const restore = useCallback(
    async (text: string) => {
      const backup = parseBackup(text);
      const images = backup.images.map((image) => ({ ...image, newId: crypto.randomUUID() }));
      const saved: string[] = [];
      try {
        for (const image of images) {
          await repository.savePhoto(image.newId, image.blob);
          saved.push(image.newId);
        }
        await mutate(() => ({
          ...backup.snapshot,
          pendingPhotoDeletes: [],
          photos: backup.snapshot.photos.map((photo) => ({
            ...photo,
            id: images.find((image) => image.id === photo.id)?.newId ?? photo.id,
          })),
        }));
      } catch (restoreError) {
        for (const id of saved) await repository.deletePhoto(id).catch(() => {});
        throw restoreError;
      }
      setMessage('本机资料已从备份恢复。');
    },
    [mutate],
  );

  return {
    snapshot,
    busy,
    error,
    message,
    policies,
    repository,
    report,
    setMessage,
    saveEvent,
    removeEvent,
    restore,
    clean,
    updatePolicies,
    toggle: (key: string) => mutate((previous) => toggleCompleted(previous, key)),
    removePhoto: (id: string) =>
      mutate((previous) => ({
        ...previous,
        photos: previous.photos.filter((photo) => photo.id !== id),
      })),
    saveSettings: (holidayFeedUrl: string) =>
      mutate((previous) => ({ ...previous, settings: { holidayFeedUrl } })),
    today: todayKey(),
  };
}

export type AppModel = ReturnType<typeof useAppModel>;
