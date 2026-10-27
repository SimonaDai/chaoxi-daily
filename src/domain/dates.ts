export type DateKey = string;

export function isDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year = 0, month = 0, day = 0] = value.split('-').map(Number);
  if (year < 1900 || year > 2100) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export function parseDate(value: DateKey): Date {
  if (!isDateKey(value)) throw new Error('日期无效，请选择 1900—2100 年的日期。');
  return new Date(`${value}T00:00:00Z`);
}

export function dateKey(date: Date): DateKey {
  return date.toISOString().slice(0, 10);
}

export function todayKey(now = new Date()): DateKey {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function addDays(value: DateKey, days: number): DateKey {
  const date = parseDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return dateKey(date);
}

export function addMonths(value: DateKey, months: number): DateKey {
  const date = parseDate(value);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, last));
  return dateKey(date);
}

export function weekStart(value: DateKey): DateKey {
  return addDays(value, -((parseDate(value).getUTCDay() + 6) % 7));
}

export function monthDays(value: DateKey): DateKey[] {
  const first = `${value.slice(0, 7)}-01`;
  const date = parseDate(first);
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  const offset = (date.getUTCDay() + 6) % 7;
  return Array.from({ length: Math.ceil((offset + last) / 7) * 7 }, (_, i) =>
    addDays(first, i - offset),
  );
}

export function chinaTimestamp(date: DateKey, time = '23:59'): number {
  return Date.parse(`${date}T${time}:00+08:00`);
}

/** A calendar month, clamped at month end, preserving the original time of day. */
export function oneMonthAfter(timestamp: number): number {
  const instant = new Date(timestamp);
  const baseDate = todayKey(instant);
  const midnight = chinaTimestamp(baseDate, '00:00');
  return chinaTimestamp(addMonths(baseDate, 1), '00:00') + (timestamp - midnight);
}

export const weekdays = ['日', '一', '二', '三', '四', '五', '六'];

export function readableDate(value: DateKey): string {
  const date = parseDate(value);
  return `${date.getUTCMonth() + 1} 月 ${date.getUTCDate()} 日`;
}
