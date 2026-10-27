import { readFile } from 'node:fs/promises';
import { validateHolidayFeed } from '../src/domain/holidays.ts';

const feed = validateHolidayFeed(
  JSON.parse(await readFile(new URL('../src/data/holidays.json', import.meta.url), 'utf8')),
);
console.log(
  `假期数据检查通过：${feed.policies.map((policy) => `${policy.year} v${policy.revision}`).join('、')}`,
);
