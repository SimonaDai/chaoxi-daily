import { isDateKey } from './dates';
import { type EventFields, emptyFields } from './model';

export interface NoticeDraft {
  fields: EventFields;
  date: string | null;
  dateCandidates: string[];
  warnings: string[];
}

/** OCR 只提供候选字段；无年份、多日期、复杂时间均留给用户确认。 */
export function parseNotice(input: string): NoticeDraft {
  const text = input.slice(0, 10000).replace(/\r\n/g, '\n');
  const mentions = [
    ...text.matchAll(
      /(?<![\d:：])(?:(\d{4})[年/.-])?(0?[1-9]|1[0-2])[月/.-](0?[1-9]|[12]\d|3[01])日?(?![\d:：])/g,
    ),
  ];
  const dates = mentions.flatMap((match) => {
    if (!match[1]) return [];
    const date = `${match[1]}-${match[2]?.padStart(2, '0')}-${match[3]?.padStart(2, '0')}`;
    return isDateKey(date) ? [date] : [];
  });
  const candidates = [...new Set(dates)];
  const ambiguous =
    mentions.some((mention) => !mention[1]) ||
    candidates.length !== 1 ||
    dates.length !== mentions.length;
  const date = ambiguous ? null : (candidates[0] ?? null);
  const times = [...text.matchAll(/(?<!\d)([01]?\d|2[0-3])[:：]([0-5]\d)(?!\d)/g)].map(
    (match) => `${match[1]?.padStart(2, '0')}:${match[2]}`,
  );
  const company = text.match(/【([^】\n]{1,40})】/);
  const categoryId = /笔试/.test(text)
    ? 'written'
    : /面试/.test(text)
      ? 'interview'
      : /作业|课程|期中|期末|考试/.test(text)
        ? 'study'
        : /工作|会议|入职|周报|项目/.test(text)
          ? 'work'
          : 'uncategorized';
  const labels: Record<string, string> = {
    written: '笔试',
    interview: '面试',
    study: '学习安排',
    work: '工作安排',
    uncategorized: '通知',
  };
  const fields = emptyFields();
  fields.categoryId = categoryId;
  fields.title = company?.[1] ? `${company[1]} · ${labels[categoryId]}` : '';
  fields.note = text;
  fields.location = text.match(/https?:\/\/[^\s<>，。；）)]+/)?.[0] ?? '';
  const warnings: string[] = [];
  if (!date)
    warnings.push(
      candidates.length > 1
        ? '存在多个日期，请区分事项时间与确认/报名截止时间。'
        : '没有明确且完整的日期，请手动选择，或先存入待整理。',
    );
  if (date && times.length >= 1 && times.length <= 2) {
    fields.time = times[0] ?? '';
    if (times[1] && times[1] > fields.time) fields.endTime = times[1];
    else if (times[1]) warnings.push('时间可能跨天或识别有误，请核对。');
  } else if (times.length > 2)
    warnings.push('存在多个时间，未自动填写，避免误用截图状态栏或其他截止时间。');
  return { fields, date, dateCandidates: candidates, warnings };
}
