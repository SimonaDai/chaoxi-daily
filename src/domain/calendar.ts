import { LunarMonth, Solar } from 'lunar-typescript';
import { addDays, isDateKey, parseDate } from './dates';
import { type HolidayFeed, holidayOn } from './holidays';
import type { EventRecord, Occurrence, Snapshot } from './model';

const festivalNames: Record<string, string> = {
  万圣节前夜: '万圣夜',
  元旦节: '元旦',
};

const traditionalFestivals = new Set(['上巳节', '中元节', '寒衣节', '下元节', '尾牙']);
// 常用南北方习俗日期，按农历普通月计算，不据此推断放假。
// 来源：https://www.jcgov.gov.cn/dtxx/ztzl/2022nzt/2022ncj_47119/xsgjwzzhn_47123/202201/t20220125_1544825.shtml
const regionalFestivals: Record<string, string> = {
  '12-23': '北方小年',
  '12-24': '南方小年',
};

export function chineseDate(date: string) {
  const parsed = parseDate(date);
  const solar = Solar.fromYmd(
    parsed.getUTCFullYear(),
    parsed.getUTCMonth() + 1,
    parsed.getUTCDate(),
  );
  const lunar = solar.getLunar();
  const month = `${lunar.getMonthInChinese()}月`;
  const day = lunar.getDayInChinese();
  const regional = regionalFestivals[`${lunar.getMonth()}-${lunar.getDay()}`];
  return {
    short: lunar.getDay() === 1 ? month : day,
    full: `${month}${day}`,
    term: lunar.getJieQi(),
    festivals: [
      ...new Set(
        [
          ...lunar.getFestivals(),
          ...solar.getFestivals(),
          ...(regional ? [regional] : []),
          ...lunar.getOtherFestivals().filter((name) => traditionalFestivals.has(name)),
        ].map((name) => festivalNames[name] ?? name),
      ),
    ],
    year: lunar.getYear(),
    month: lunar.getMonth(),
    day: lunar.getDay(),
  };
}

/** 节日、节气只提供名称；放假和补班仅来自审核过的政策数据。 */
export function calendarDay(date: string, policies: HolidayFeed) {
  const lunar = chineseDate(date);
  const holiday = holidayOn(policies, date);
  const labels: { name: string; kind: 'term' | 'festival' | 'holiday' }[] = [];
  if (lunar.term) labels.push({ name: lunar.term, kind: 'term' });
  for (const name of lunar.festivals) {
    if (!labels.some((label) => label.name === name)) labels.push({ name, kind: 'festival' });
  }
  if (
    holiday.kind === 'off' &&
    holiday.name &&
    !labels.some((label) => label.name === holiday.name)
  ) {
    labels.push({ name: holiday.name, kind: 'holiday' });
  }
  return { lunar, holiday, labels };
}

export function matchesRepeat(event: EventRecord, date: string): boolean {
  if (!isDateKey(date)) return false;
  if (!event.date || date < event.date || (event.until && date > event.until)) return false;
  if (event.repeat === 'none') return date === event.date;
  const start = parseDate(event.date);
  const target = parseDate(date);
  if (event.repeat === 'weekly') return start.getUTCDay() === target.getUTCDay();
  if (event.repeat === 'lunar-yearly') {
    const original = chineseDate(event.date);
    const candidate = chineseDate(date);
    // 闰月生日：有对应闰月时用闰月，没有时按该年的同名普通月。
    const leapMonthExists =
      original.month < 0 && LunarMonth.fromYm(candidate.year, original.month) !== null;
    const targetMonth = original.month < 0 && !leapMonthExists ? -original.month : original.month;
    const lunarMonth = LunarMonth.fromYm(candidate.year, targetMonth);
    return (
      candidate.month === targetMonth &&
      candidate.day === Math.min(original.day, lunarMonth?.getDayCount() ?? 30)
    );
  }
  if (event.repeat === 'yearly' && start.getUTCMonth() !== target.getUTCMonth()) return false;
  const last = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return target.getUTCDate() === Math.min(start.getUTCDate(), last);
}

export function occurrenceFromOriginal(
  event: EventRecord,
  originalDate: string,
): Occurrence | null {
  if (!matchesRepeat(event, originalDate)) return null;
  const exception = event.exceptions[originalDate];
  if (exception?.cancelled) return null;
  return {
    event,
    originalDate,
    date: exception?.date ?? originalDate,
    fields: exception?.fields ?? event.fields,
    key: `${event.id}@${originalDate}`,
  };
}

export function occurrencesOn(events: EventRecord[], date: string, category = 'all'): Occurrence[] {
  if (!isDateKey(date)) return [];
  const result: Occurrence[] = [];
  for (const event of events) {
    const original = occurrenceFromOriginal(event, date);
    if (original && original.date === date) result.push(original);
    for (const [originalDate, exception] of Object.entries(event.exceptions)) {
      if (exception.date === date && originalDate !== date) {
        const moved = occurrenceFromOriginal(event, originalDate);
        if (moved) result.push(moved);
      }
    }
  }
  return result
    .filter((item) => category === 'all' || item.fields.categoryId === category)
    .sort(
      (a, b) =>
        (a.fields.time || '99:99').localeCompare(b.fields.time || '99:99') ||
        a.fields.title.localeCompare(b.fields.title, 'zh-CN'),
    );
}

export function occurrencesBetween(
  events: EventRecord[],
  start: string,
  days: number,
  category = 'all',
): Occurrence[] {
  if (!isDateKey(start)) return [];
  return Array.from({ length: days }, (_, index) =>
    occurrencesOn(events, addDays(start, index), category),
  ).flat();
}

export function toggleCompleted(snapshot: Snapshot, key: string): Snapshot {
  return {
    ...snapshot,
    completed: snapshot.completed.includes(key)
      ? snapshot.completed.filter((value) => value !== key)
      : [...snapshot.completed, key],
  };
}

/** 补日期或整体调整规则时，把失去发生日期的附件移到新起始日，绝不悄悄删除附件。 */
export function reconcileSeries(record: EventRecord, photos: Snapshot['photos']) {
  const exceptions = Object.fromEntries(
    Object.entries(record.exceptions).filter(([date]) => matchesRepeat(record, date)),
  );
  return {
    record: { ...record, exceptions },
    photos: photos.map((photo) =>
      photo.eventId === record.id &&
      (!photo.occurrenceDate || !matchesRepeat(record, photo.occurrenceDate))
        ? { ...photo, occurrenceDate: record.date }
        : photo,
    ),
  };
}

export function deleteOccurrence(
  snapshot: Snapshot,
  item: Occurrence,
  scope: 'one' | 'series',
): Snapshot {
  if (scope === 'series' || item.event.repeat === 'none') {
    return {
      ...snapshot,
      events: snapshot.events.filter((event) => event.id !== item.event.id),
      photos: snapshot.photos.filter((photo) => photo.eventId !== item.event.id),
      completed: snapshot.completed.filter((key) => !key.startsWith(`${item.event.id}@`)),
    };
  }
  return {
    ...snapshot,
    events: snapshot.events.map((event) =>
      event.id === item.event.id
        ? {
            ...event,
            updatedAt: Date.now(),
            exceptions: { ...event.exceptions, [item.originalDate]: { cancelled: true } },
          }
        : event,
    ),
    photos: snapshot.photos.filter(
      (photo) => !(photo.eventId === item.event.id && photo.occurrenceDate === item.originalDate),
    ),
    completed: snapshot.completed.filter((key) => key !== item.key),
  };
}
