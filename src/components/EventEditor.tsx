import { Capacitor } from '@capacitor/core';
import { ImagePlus, X } from 'lucide-react';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { isDateKey } from '../domain/dates';
import {
  type Category,
  type EventFields,
  type EventRecord,
  emptyFields,
  fieldsSchema,
  type Occurrence,
  type Repeat,
  reminderLabels,
  repeatLabels,
} from '../domain/model';
import type { NoticeDraft } from '../domain/notice';
import type { AppModel } from '../hooks/useAppModel';
import { compressImage, validateImage } from '../platform/images';
import { requestReminderPermission } from '../platform/notifications';
import { PhotoAttachment } from './PhotoAttachment';
import { Sheet } from './Sheet';

export interface EditorInput {
  selected: string;
  event?: EventRecord;
  occurrence?: Occurrence;
  draft?: NoticeDraft;
  photo?: File;
}

export function EventEditor({
  input,
  app,
  onClose,
  onSaved,
}: {
  input: EditorInput;
  app: AppModel;
  onClose(): void;
  onSaved(date: string | null): void;
}) {
  const original = input.event;
  const [fields, setFields] = useState<EventFields>(
    input.occurrence?.fields ?? original?.fields ?? input.draft?.fields ?? emptyFields(),
  );
  const [date, setDate] = useState(
    input.occurrence?.date ?? original?.date ?? input.draft?.date ?? input.selected,
  );
  const [dated, setDated] = useState(
    input.draft ? !!input.draft.date : original ? !!original.date : true,
  );
  const [repeat, setRepeat] = useState<Repeat>(original?.repeat ?? 'none');
  const [until, setUntil] = useState(original?.until ?? '');
  const [scope, setScope] = useState<'one' | 'series'>(
    input.occurrence && original?.repeat !== 'none' ? 'one' : 'series',
  );
  const [customName, setCustomName] = useState(''),
    [customColor, setCustomColor] = useState('#765b92');
  const [photo, setPhoto] = useState<File | null>(input.photo ?? null),
    [preview, setPreview] = useState('');
  const [error, setError] = useState(''),
    [working, setWorking] = useState(false);
  const alive = useRef(true);
  const snapshot = app.snapshot;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (!photo) {
      setPreview('');
      return;
    }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);
  if (!snapshot) return null;
  const set = <K extends keyof EventFields>(key: K, value: EventFields[K]) =>
    setFields((current) => ({ ...current, [key]: value }));
  const existingPhotos = snapshot.photos.filter(
    (item) =>
      item.eventId === original?.id &&
      item.occurrenceDate === (input.occurrence?.originalDate ?? original?.date ?? null),
  );
  const allDay = !fields.time;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    let category: Category | undefined;
    const nextFields = { ...fields, title: fields.title.trim() };
    if (fields.categoryId === '__custom') {
      if (!customName.trim()) {
        setError('请填写类型名称，或选择未分类。');
        return;
      }
      category = { id: crypto.randomUUID(), name: customName.trim(), color: customColor };
      nextFields.categoryId = category.id;
    }
    const parsed = fieldsSchema.safeParse(nextFields);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? '请检查填写内容。');
      return;
    }
    if (dated && !isDateKey(date)) {
      setError('请选择有效日期。');
      return;
    }
    if (dated && until && repeat !== 'none' && until < date) {
      setError('重复结束日期不能早于开始日期。');
      return;
    }
    if (!dated && scope === 'one') {
      setError('仅修改本次时需要保留日期。');
      return;
    }
    if (photo && existingPhotos.length >= 3) {
      setError('每次事项最多保留 3 张图片，请先移除不需要的附件。');
      return;
    }
    setWorking(true);
    try {
      if (
        original &&
        scope === 'series' &&
        (original.date !== (dated ? date : null) ||
          original.repeat !== repeat ||
          original.until !== (until || null)) &&
        Object.keys(original.exceptions).length &&
        !window.confirm(
          '整体调整起始日或重复规则后，不再符合新规则的单次改期会重置，相关截图移到新的起始日。继续保存？',
        )
      )
        return;
      if (
        fields.reminder !== 'none' &&
        Capacitor.isNativePlatform() &&
        !(await requestReminderPermission())
      )
        throw new Error('系统通知尚未授权。可以在设置中允许通知，或选择不提醒后保存。');
      const blob = photo ? await compressImage(photo) : null;
      if (!alive.current) return;
      await app.saveEvent({
        fields: parsed.data,
        date: dated ? date : null,
        repeat: dated ? repeat : 'none',
        until: dated && repeat !== 'none' && until ? until : null,
        scope,
        event: original,
        occurrence: input.occurrence,
        category,
        photo: photo && blob ? { blob, name: photo.name } : undefined,
      });
      if (alive.current) onSaved(dated ? date : null);
    } catch (value) {
      if (alive.current) setError(value instanceof Error ? value.message : '保存失败，请重试。');
    } finally {
      if (alive.current) setWorking(false);
    }
  };

  return (
    <Sheet
      title={original ? '编辑事项' : input.draft ? '核对后记下' : '记一件事'}
      onClose={() => {
        if (!working && !app.busy) onClose();
      }}
    >
      <form className="editor-form" onSubmit={(event) => void submit(event)}>
        {input.draft && (
          <div className="soft-note">识别结果仅作填写建议，请对照原通知核对。提醒默认关闭。</div>
        )}
        {input.draft?.warnings.map((warning) => (
          <p className="field-warning" key={warning}>
            {warning}
          </p>
        ))}
        <fieldset disabled={working || app.busy}>
          {original && input.occurrence && original.repeat !== 'none' && (
            <label className="field">
              修改范围
              <select
                value={scope}
                onChange={(event) => {
                  const value = event.target.value as 'one' | 'series';
                  setScope(value);
                  if (value === 'series') {
                    setDate(original.date ?? input.selected);
                    setFields(original.fields);
                  } else {
                    setDate(input.occurrence?.date ?? input.selected);
                    setFields(input.occurrence?.fields ?? original.fields);
                  }
                }}
              >
                <option value="one">仅这一次</option>
                <option value="series">整个重复系列</option>
              </select>
            </label>
          )}
          <label className="field">
            事项名称
            <input
              name="title"
              autoComplete="off"
              placeholder="准备记录什么？"
              maxLength={100}
              required
              value={fields.title}
              onChange={(event) => set('title', event.target.value)}
            />
          </label>
          <div className="form-pair">
            <label className="field">
              类型
              <select
                value={fields.categoryId}
                onChange={(event) => set('categoryId', event.target.value)}
              >
                {snapshot.categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
                <option value="__custom">＋ 自己填写类型</option>
              </select>
            </label>
            <label className="field">
              提醒
              <select
                value={fields.reminder}
                onChange={(event) => set('reminder', event.target.value as EventFields['reminder'])}
              >
                {Object.entries(reminderLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {fields.categoryId === '__custom' && (
            <div className="custom-category">
              <label className="field">
                类型名称
                <input
                  maxLength={20}
                  value={customName}
                  placeholder="例如：体检、旅行"
                  onChange={(event) => setCustomName(event.target.value)}
                  required
                />
              </label>
              <label className="field color-field">
                颜色
                <input
                  type="color"
                  value={customColor}
                  onChange={(event) => setCustomColor(event.target.value)}
                />
              </label>
            </div>
          )}
          {!Capacitor.isNativePlatform() && fields.reminder !== 'none' && (
            <p className="field-help">系统提醒会在 Android 安装版中生效，网页版保存提醒偏好。</p>
          )}
          <label className="check-line">
            <input
              type="checkbox"
              checked={!dated}
              disabled={scope === 'one'}
              onChange={(event) => setDated(!event.target.checked)}
            />
            日期还没确定，先存入待整理
          </label>
          {dated && (
            <>
              <label className="field">
                日期
                <input
                  type="date"
                  min="1900-01-01"
                  max="2100-12-31"
                  required
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </label>
              {input.draft && input.draft.dateCandidates.length > 1 && (
                <fieldset className="candidate-dates" aria-label="通知中的候选日期">
                  {input.draft.dateCandidates.map((value) => (
                    <button
                      type="button"
                      className="quiet-button"
                      key={value}
                      onClick={() => {
                        setDate(value);
                        setDated(true);
                      }}
                    >
                      {value}
                    </button>
                  ))}
                </fieldset>
              )}
              <label className="check-line">
                <input
                  type="checkbox"
                  checked={allDay}
                  onChange={(event) =>
                    setFields((current) => ({
                      ...current,
                      time: event.target.checked ? '' : '09:00',
                      endTime: '',
                    }))
                  }
                />
                全天事项
              </label>
              {!allDay && (
                <div className="form-pair">
                  <label className="field">
                    开始时间
                    <input
                      type="time"
                      required
                      value={fields.time}
                      onChange={(event) => set('time', event.target.value)}
                    />
                  </label>
                  <label className="field">
                    结束时间（选填）
                    <input
                      type="time"
                      value={fields.endTime}
                      onChange={(event) => set('endTime', event.target.value)}
                    />
                  </label>
                </div>
              )}
              {scope === 'series' && (
                <>
                  <label className="field">
                    重复
                    <select
                      value={repeat}
                      onChange={(event) => setRepeat(event.target.value as Repeat)}
                    >
                      {Object.entries(repeatLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {repeat !== 'none' && (
                    <label className="field">
                      重复到哪天（选填）
                      <input
                        type="date"
                        min={date}
                        max="2100-12-31"
                        value={until}
                        onChange={(event) => setUntil(event.target.value)}
                      />
                    </label>
                  )}
                  {repeat === 'monthly' && (
                    <p className="field-help">短月份没有对应日期时，安排在该月最后一天。</p>
                  )}
                  {repeat === 'lunar-yearly' && (
                    <p className="field-help">
                      按所选日期的农历月日重复。闰月有对应闰月时用闰月，否则用同名普通月；小月按月末安排。
                    </p>
                  )}
                </>
              )}
            </>
          )}
          <label className="field">
            地点 / 会议链接
            <input
              type="text"
              maxLength={500}
              value={fields.location}
              placeholder="选填"
              onChange={(event) => set('location', event.target.value)}
            />
          </label>
          <label className="field">
            备注
            <textarea
              value={fields.note}
              maxLength={10000}
              rows={4}
              placeholder="准备事项、通知原文，或想记下的话。"
              onChange={(event) => set('note', event.target.value)}
            />
          </label>
          {existingPhotos.map((item) => (
            <PhotoAttachment
              key={item.id}
              photo={item}
              repository={app.repository}
              onRemove={() => {
                if (window.confirm('移除这张本机附件？事项文字会保留。'))
                  void app.removePhoto(item.id).catch(app.report);
              }}
            />
          ))}
          {preview && (
            <div className="selected-photo">
              <img src={preview} alt="将要保存的截图" />
              <button
                type="button"
                className="icon-button"
                aria-label="移除待保存截图"
                onClick={() => setPhoto(null)}
              >
                <X />
              </button>
            </div>
          )}
          {!photo && existingPhotos.length < 3 && (
            <label className="photo-picker">
              <ImagePlus />
              <span>附一张截图，存在本机</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  try {
                    validateImage(file);
                    setPhoto(file);
                    setError('');
                  } catch (value) {
                    setError(value instanceof Error ? value.message : '图片无效');
                  }
                  event.target.value = '';
                }}
              />
            </label>
          )}
          <p className="field-help">
            图片保存满一个自然月，且对应事项已结束后，在打开应用时清理；文字记录保留。
          </p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="primary-button full-button">
            {working || app.busy ? '正在保存…' : dated ? '记进日历' : '存入待整理'}
          </button>
          {original?.date === null && (
            <button
              type="button"
              className="text-button danger full-button"
              onClick={() => {
                if (window.confirm('删除这件待整理事项及其附件？')) {
                  setWorking(true);
                  void app
                    .removeEvent(original)
                    .then(onClose)
                    .catch((value: unknown) => {
                      setError(value instanceof Error ? value.message : '删除失败。');
                      setWorking(false);
                    });
                }
              }}
            >
              删除这件待整理事项
            </button>
          )}
        </fieldset>
      </form>
    </Sheet>
  );
}
