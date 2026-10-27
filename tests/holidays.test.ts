import { describe, expect, it } from 'vitest';
import policies from '../src/data/holidays.json';
import { holidayOn, mergeHolidayFeeds, validateHolidayFeed } from '../src/domain/holidays';

describe('已审核的中国大陆政策数据', () => {
  const feed = validateHolidayFeed(policies);
  it('区分春节放假、补班、普通周末和未配置年份', () => {
    expect(holidayOn(feed, '2026-02-17').kind).toBe('off');
    expect(holidayOn(feed, '2026-02-14').kind).toBe('work');
    expect(holidayOn(feed, '2026-10-10').kind).toBe('work');
    expect(holidayOn(feed, '2026-10-25').kind).toBeUndefined();
    expect(holidayOn(feed, '2027-01-01').configured).toBe(false);
  });
  it('旧版本数据不能回滚本地的新政策', () => {
    const latest = structuredClone(feed);
    if (latest.policies[0]) latest.policies[0].revision = 2;
    expect(mergeHolidayFeeds(latest, feed).policies[0]?.revision).toBe(2);
  });
  it('拒绝假冒来源、重叠安排和跨年份日期', () => {
    const fake = structuredClone(policies);
    if (fake.policies[0]) fake.policies[0].source = 'https://gov.cn.example.com/notice';
    expect(() => validateHolidayFeed(fake)).toThrow();
    const duplicate = structuredClone(policies);
    const policy = duplicate.policies[0];
    if (policy?.ranges[0]) policy.ranges.push(policy.ranges[0]);
    expect(() => validateHolidayFeed(duplicate)).toThrow();
    const wrongYear = structuredClone(policies);
    if (wrongYear.policies[0]) wrongYear.policies[0].year = 2027;
    expect(() => validateHolidayFeed(wrongYear)).toThrow();
  });
});
