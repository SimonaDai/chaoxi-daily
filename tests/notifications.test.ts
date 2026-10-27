import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestReminderPermission, syncReminders } from '../src/platform/notifications';
import { event, state } from './fixtures';

const api = vi.hoisted(() => ({
  checkPermissions: vi.fn().mockResolvedValue({ display: 'granted' }),
  requestPermissions: vi.fn().mockResolvedValue({ display: 'granted' }),
  getPending: vi.fn().mockResolvedValue({ notifications: [] }),
  cancel: vi.fn().mockResolvedValue(undefined),
  schedule: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true } }));
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: api }));
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('提醒仅由用户主动选择开启', () => {
  it('默认事项不安排通知，权限检查不会触发授权弹窗', async () => {
    await syncReminders(state());
    expect(api.requestPermissions).not.toHaveBeenCalled();
    expect(api.schedule).not.toHaveBeenCalled();
  });
  it('未授权时静默保留记录，只在用户主动请求时询问', async () => {
    api.checkPermissions.mockResolvedValue({ display: 'prompt' });
    await syncReminders(state());
    expect(api.requestPermissions).not.toHaveBeenCalled();
    expect(await requestReminderPermission()).toBe(true);
    expect(api.requestPermissions).toHaveBeenCalledOnce();
    api.checkPermissions.mockResolvedValue({ display: 'granted' });
  });
  it('使用北京时间计算全天事项，跳过已完成且不申请精确闹钟', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-27T00:00:00+08:00'));
    const record = event({ date: '2026-10-28' });
    record.fields.reminder = '1d';
    const snapshot = { ...state(record), photos: [] };
    await syncReminders(snapshot);
    expect(api.schedule).toHaveBeenCalledWith({
      notifications: [
        expect.objectContaining({
          isExactNotification: false,
          schedule: { at: new Date('2026-10-27T09:00:00+08:00'), allowWhileIdle: false },
        }),
      ],
    });
    api.schedule.mockClear();
    await syncReminders({ ...snapshot, completed: ['event-a@2026-10-28'] });
    expect(api.schedule).not.toHaveBeenCalled();
  });
});
