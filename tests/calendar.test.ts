import { describe, expect, it } from 'vitest';
import {
  chineseDate,
  deleteOccurrence,
  matchesRepeat,
  occurrencesOn,
  reconcileSeries,
  toggleCompleted,
} from '../src/domain/calendar';
import { addMonths, isDateKey, oneMonthAfter, todayKey } from '../src/domain/dates';
import { event, state } from './fixtures';

describe('北京时间与日期边界', () => {
  it('不依赖设备所在时区决定今天', () => {
    expect(todayKey(new Date('2026-10-26T16:00:00Z'))).toBe('2026-10-27');
    expect(todayKey(new Date('2026-10-26T15:59:59Z'))).toBe('2026-10-26');
  });
  it('拒绝不存在的日期，月份运算按月末收敛', () => {
    expect(isDateKey('2026-02-29')).toBe(false);
    expect(isDateKey('2024-02-29')).toBe(true);
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(new Date(oneMonthAfter(Date.parse('2026-01-31T10:30:00+08:00'))).toISOString()).toBe(
      '2026-02-28T02:30:00.000Z',
    );
  });
});

describe('重复事项与中国日历', () => {
  it('待整理补日期或整体改期后，截图仍关联可见事项', () => {
    const snapshot = state();
    const pending = {
      ...snapshot.photos[0],
      occurrenceDate: null,
    } as (typeof snapshot.photos)[number];
    expect(
      reconcileSeries(event({ date: '2026-10-28' }), [pending]).photos[0]?.occurrenceDate,
    ).toBe('2026-10-28');
    expect(
      reconcileSeries(event({ date: '2026-11-01' }), snapshot.photos).photos[0]?.occurrenceDate,
    ).toBe('2026-11-01');
  });
  it('31 日订阅经过二月后仍回到 31 日', () => {
    const record = event({ repeat: 'monthly' });
    expect(matchesRepeat(record, '2026-02-28')).toBe(true);
    expect(matchesRepeat(record, '2026-03-31')).toBe(true);
    expect(matchesRepeat(record, '2026-03-28')).toBe(false);
    expect(matchesRepeat(record, '2025-12-31')).toBe(false);
    expect(matchesRepeat({ ...record, until: '2026-02-28' }, '2026-03-31')).toBe(false);
  });
  it('公历闰年生日在普通年按二月末安排', () => {
    const record = event({ date: '2024-02-29', repeat: 'yearly' });
    expect(matchesRepeat(record, '2025-02-28')).toBe(true);
    expect(matchesRepeat(record, '2028-02-29')).toBe(true);
    expect(matchesRepeat(record, '2025-03-29')).toBe(false);
  });
  it('春节纪念日遵循农历，闰月无对应年份使用普通月', () => {
    const record = event({ date: '2026-02-17', repeat: 'lunar-yearly' });
    expect(chineseDate('2026-02-17').full).toBe('正月初一');
    expect(matchesRepeat(record, '2027-02-06')).toBe(true);
    expect(chineseDate('2026-10-23').term).toBe('霜降');
    const leapBirthday = event({ date: '2023-03-22', repeat: 'lunar-yearly' });
    expect(chineseDate(leapBirthday.date ?? '').month).toBe(-2);
    expect(matchesRepeat(leapBirthday, '2024-03-10')).toBe(true);
  });
  it('单次改期只出现一次，完成状态绑定原发生日期', () => {
    const record = event({
      repeat: 'monthly',
      exceptions: { '2026-02-28': { cancelled: false, date: '2026-03-02' } },
    });
    expect(occurrencesOn([record], '2026-02-28')).toHaveLength(0);
    const items = occurrencesOn([record], '2026-03-02');
    expect(items).toHaveLength(1);
    expect(items[0]?.key).toBe('event-a@2026-02-28');
    expect(occurrencesOn([record], '2026-03-31')).toHaveLength(1);
    const item = items[0];
    if (!item) throw new Error('缺少改期事项');
    const completed = toggleCompleted(state(record), item.key);
    expect(completed.completed).toEqual([item.key]);
    const removed = deleteOccurrence(completed, item, 'one');
    expect(occurrencesOn(removed.events, '2026-03-02')).toHaveLength(0);
    expect(removed.events).toHaveLength(1);
    expect(removed.completed).toEqual([]);
    expect(deleteOccurrence(completed, item, 'series').events).toEqual([]);
  });
});
