import { Preferences } from '@capacitor/preferences';
import bundled from '../data/holidays.json';
import { type HolidayFeed, mergeHolidayFeeds, validateHolidayFeed } from '../domain/holidays';

const key = 'chaoxi.holiday-feed.v1';
export const bundledPolicies = validateHolidayFeed(bundled);

export async function cachedPolicies(): Promise<HolidayFeed> {
  const cached = (await Preferences.get({ key })).value;
  if (!cached) return bundledPolicies;
  try {
    return mergeHolidayFeeds(bundledPolicies, validateHolidayFeed(JSON.parse(cached)));
  } catch {
    return bundledPolicies;
  }
}

export async function refreshPolicies(url: string, current: HolidayFeed): Promise<HolidayFeed> {
  if (!url) return current;
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password)
    throw new Error('假期数据地址必须是无账号信息的 HTTPS 链接。');
  const response = await fetch(parsed, {
    signal: AbortSignal.timeout(12_000),
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
  });
  if (!response.ok) throw new Error(`假期更新失败（${response.status}），已保留现有数据。`);
  if (Number(response.headers.get('content-length')) > 200_000)
    throw new Error('假期数据文件过大。');
  const text = await response.text();
  if (text.length > 200_000) throw new Error('假期数据文件过大。');
  const next = mergeHolidayFeeds(current, validateHolidayFeed(JSON.parse(text)));
  await Preferences.set({ key, value: JSON.stringify(next) });
  return next;
}
