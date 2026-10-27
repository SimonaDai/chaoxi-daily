import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { occurrencesBetween } from '../domain/calendar';
import { chinaTimestamp, todayKey } from '../domain/dates';
import type { Snapshot } from '../domain/model';

const offsets = { '30m': 30 * 60_000, '1d': 86400_000, '3d': 3 * 86400_000 };

export async function requestReminderPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform())
    throw new Error('系统提醒在 Android 安装版中可用；网页版可保存提醒设置。');
  const current = await LocalNotifications.checkPermissions();
  return (
    current.display === 'granted' ||
    (await LocalNotifications.requestPermissions()).display === 'granted'
  );
}

export async function syncReminders(snapshot: Snapshot): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const permission = await LocalNotifications.checkPermissions();
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length)
    await LocalNotifications.cancel({ notifications: pending.notifications });
  if (permission.display !== 'granted') return;
  const now = Date.now();
  const occurrences = occurrencesBetween(snapshot.events, todayKey(), 60).filter(
    (item) => item.fields.reminder !== 'none' && !snapshot.completed.includes(item.key),
  );
  const notifications = occurrences
    .flatMap((item, index) => {
      const reminder = item.fields.reminder;
      if (reminder === 'none') return [];
      const timestamp = chinaTimestamp(item.date, item.fields.time || '09:00') - offsets[reminder];
      if (timestamp <= now) return [];
      return [
        {
          id: index + 1,
          title: item.fields.title,
          body: `${item.date} ${item.fields.time || '全天事项'}`,
          isExactNotification: false,
          schedule: { at: new Date(timestamp), allowWhileIdle: false },
          extra: { occurrenceKey: item.key },
        },
      ];
    })
    .slice(0, 200);
  if (notifications.length) await LocalNotifications.schedule({ notifications });
}
