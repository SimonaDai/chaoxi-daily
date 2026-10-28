import { z } from 'zod';
import { addDays, isDateKey } from './dates.ts';

const date = z.string().refine(isDateKey);
const rangeSchema = z.object({
  start: date,
  end: date,
  kind: z.enum(['off', 'work']),
  name: z.string().min(1).max(40),
});
const policySchema = z
  .object({
    year: z.number().int().min(1900).max(2100),
    revision: z.number().int().positive(),
    publishedAt: date,
    source: z
      .string()
      .url()
      .refine((value) => {
        try {
          const url = new URL(value);
          return (
            url.protocol === 'https:' &&
            (url.hostname === 'gov.cn' || url.hostname.endsWith('.gov.cn'))
          );
        } catch {
          return false;
        }
      }),
    ranges: z.array(rangeSchema).max(100),
  })
  .superRefine((policy, context) => {
    const occupied = new Set<string>();
    for (const range of policy.ranges) {
      if (
        !range.start.startsWith(`${policy.year}-`) ||
        !range.end.startsWith(`${policy.year}-`) ||
        range.start > range.end
      ) {
        context.addIssue({ code: 'custom', message: '假期范围不属于对应年份或日期顺序错误' });
        continue;
      }
      for (let current = range.start; current <= range.end; current = addDays(current, 1)) {
        if (occupied.has(current))
          context.addIssue({ code: 'custom', message: '假期和补班日期重复或冲突' });
        occupied.add(current);
      }
    }
  });

export const holidayFeedSchema = z
  .object({ schemaVersion: z.literal(1), policies: z.array(policySchema).max(201) })
  .superRefine((feed, context) => {
    if (new Set(feed.policies.map((policy) => policy.year)).size !== feed.policies.length)
      context.addIssue({ code: 'custom', message: '同一年份存在多个政策版本' });
  });
export type HolidayFeed = z.infer<typeof holidayFeedSchema>;

export function validateHolidayFeed(value: unknown): HolidayFeed {
  return holidayFeedSchema.parse(value);
}

export function mergeHolidayFeeds(current: HolidayFeed, incoming: HolidayFeed): HolidayFeed {
  const policies = new Map(current.policies.map((policy) => [policy.year, policy]));
  for (const policy of incoming.policies) {
    const previous = policies.get(policy.year);
    if (!previous || policy.revision > previous.revision) policies.set(policy.year, policy);
  }
  return { schemaVersion: 1, policies: [...policies.values()].sort((a, b) => a.year - b.year) };
}

export function holidayOn(feed: HolidayFeed, value: string) {
  const year = Number(value.slice(0, 4));
  const policy = feed.policies.find((item) => item.year === year);
  const day = policy?.ranges.find((range) => value >= range.start && value <= range.end);
  return {
    configured: !!policy,
    kind: day?.kind,
    name: day?.name,
    source: policy?.source,
    publishedAt: policy?.publishedAt,
  };
}
