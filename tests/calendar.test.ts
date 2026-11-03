import { describe, expect, it } from 'vitest';
import policies from '../src/data/holidays.json';
import {
  calendarDay,
  chineseDate,
  deleteOccurrence,
  matchesRepeat,
  occurrencesOn,
  reconcileSeries,
  toggleCompleted,
} from '../src/domain/calendar';
import { addMonths, isDateKey, oneMonthAfter, todayKey } from '../src/domain/dates';
import { validateHolidayFeed } from '../src/domain/holidays';
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
  it('南北小年随农历跨公历年份移动，只在腊月对应日期标注', () => {
    const feed = validateHolidayFeed(policies);
    for (const [north, south] of [
      ['2025-01-22', '2025-01-23'],
      ['2026-02-10', '2026-02-11'],
      ['2027-01-30', '2027-01-31'],
    ]) {
      expect(chineseDate(north ?? '').festivals).toContain('北方小年');
      expect(chineseDate(north ?? '').festivals).not.toContain('南方小年');
      expect(chineseDate(south ?? '').festivals).toContain('南方小年');
      expect(chineseDate(south ?? '').festivals).not.toContain('北方小年');
    }
    expect(chineseDate('2026-02-12').festivals).not.toContain('南方小年');
    expect(chineseDate('2026-01-11').festivals).not.toContain('北方小年');
    expect(calendarDay('2026-02-10', feed).holiday.kind).toBeUndefined();
  });
  it('保留常见农历民俗节日，节日名称不重复', () => {
    expect(chineseDate('2026-01-26').festivals).toContain('腊八节');
    expect(chineseDate('2026-08-27').festivals).toContain('中元节');
    expect(chineseDate('2026-11-09').festivals).toContain('寒衣节');
    const southern = chineseDate('2026-02-11').festivals;
    expect(new Set(southern).size).toBe(southern.length);
  });
  it('公历节日、传统节日和浮动星期节日均显示，且不推断放假', () => {
    const feed = validateHolidayFeed(policies);
    expect(chineseDate('2026-10-31').festivals).toContain('万圣夜');
    expect(chineseDate('2026-11-01').festivals).toContain('万圣节');
    expect(chineseDate('2026-02-14').festivals).toContain('情人节');
    expect(chineseDate('2026-05-10').festivals).toContain('母亲节');
    expect(chineseDate('2026-06-21').festivals).toContain('父亲节');
    expect(chineseDate('2026-02-17').festivals).toContain('春节');
    expect(calendarDay('2026-10-31', feed).holiday.kind).toBeUndefined();
    expect(calendarDay('2026-02-14', feed).holiday.kind).toBe('work');
    expect(calendarDay('2027-01-01', feed).holiday.kind).toBeUndefined();
    expect(calendarDay('2027-01-01', feed).labels).toContainEqual({
      name: '元旦',
      kind: 'festival',
    });
  });
  it('节气与节日重合时保留双方名称，放假名称不重复', () => {
    const feed = validateHolidayFeed(policies);
    const summer = calendarDay('2026-06-21', feed);
    expect(summer.labels).toContainEqual({ name: '夏至', kind: 'term' });
    expect(summer.labels).toContainEqual({ name: '父亲节', kind: 'festival' });
    const spring = calendarDay('2026-02-17', feed);
    expect(spring.labels.filter((label) => label.name === '春节')).toHaveLength(1);
    expect(spring.holiday.kind).toBe('off');
  });
  it('全年二十四节气完整，跨年仍按对应年份计算', () => {
    const terms = new Set<string>();
    for (let day = 0; day < 365; day++) {
      const date = new Date(Date.UTC(2026, 0, 1 + day)).toISOString().slice(0, 10);
      const term = chineseDate(date).term;
      if (term) terms.add(term);
    }
    expect(terms.size).toBe(24);
    expect(chineseDate('2027-01-05').term).toBe('小寒');
  });
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
