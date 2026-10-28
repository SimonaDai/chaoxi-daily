import { z } from 'zod';
import { isDateKey } from './dates';

export const dateSchema = z.string().refine(isDateKey, '日期无效');
const idSchema = z.string().regex(/^[A-Za-z0-9_-]{1,100}$/);
const timeSchema = z.string().regex(/^$|^(?:[01]\d|2[0-3]):[0-5]\d$/);
export const reminderSchema = z.enum(['none', '30m', '1d', '3d']);
export const repeatSchema = z.enum(['none', 'weekly', 'monthly', 'yearly', 'lunar-yearly']);
export const fieldsSchema = z
  .object({
    title: z.string().trim().min(1).max(100),
    categoryId: idSchema,
    time: timeSchema,
    endTime: timeSchema,
    location: z.string().max(500),
    note: z.string().max(10000),
    reminder: reminderSchema,
  })
  .refine((event) => !event.endTime || (!!event.time && event.endTime > event.time), {
    message: '结束时间必须晚于开始时间',
    path: ['endTime'],
  });

const exceptionSchema = z.object({
  cancelled: z.boolean().default(false),
  date: dateSchema.optional(),
  fields: fieldsSchema.optional(),
});

export const eventSchema = z
  .object({
    id: idSchema,
    fields: fieldsSchema,
    date: dateSchema.nullable(),
    repeat: repeatSchema,
    until: dateSchema.nullable().default(null),
    exceptions: z.record(dateSchema, exceptionSchema).default({}),
    createdAt: z.number().finite().nonnegative(),
    updatedAt: z.number().finite().nonnegative(),
  })
  .refine((event) => event.date !== null || event.repeat === 'none', {
    message: '待整理事项不能设置重复',
    path: ['repeat'],
  })
  .refine((event) => !event.until || (!!event.date && event.until >= event.date), {
    message: '重复结束日期不能早于开始日期',
    path: ['until'],
  });

export const categorySchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1).max(20),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export const photoMetaSchema = z.object({
  id: idSchema,
  eventId: idSchema,
  occurrenceDate: dateSchema.nullable(),
  createdAt: z.number().finite().nonnegative(),
  name: z.string().max(200),
  mime: z.enum(['image/png', 'image/jpeg', 'image/webp']),
  bytes: z
    .number()
    .int()
    .positive()
    .max(10 * 1024 * 1024),
});

export const snapshotSchema = z
  .object({
    schemaVersion: z.literal(1),
    events: z.array(eventSchema).max(10000),
    categories: z.array(categorySchema).min(1).max(200),
    completed: z
      .array(z.string().regex(/^[A-Za-z0-9_-]{1,100}@(?:\d{4}-\d{2}-\d{2}|inbox)$/))
      .max(100000),
    photos: z.array(photoMetaSchema).max(10000),
    pendingPhotoDeletes: z.array(idSchema).max(20000).default([]),
    settings: z.object({ holidayFeedUrl: z.string().max(1000).default('') }),
  })
  .superRefine((state, context) => {
    const categories = new Set(state.categories.map((category) => category.id));
    const ids = state.events.map((event) => event.id);
    if (new Set(ids).size !== ids.length)
      context.addIssue({ code: 'custom', message: '事项 ID 重复' });
    if (categories.size !== state.categories.length)
      context.addIssue({ code: 'custom', message: '分类 ID 重复' });
    if (!categories.has('uncategorized'))
      context.addIssue({ code: 'custom', message: '缺少未分类类型' });
    for (const event of state.events) {
      if (!categories.has(event.fields.categoryId))
        context.addIssue({ code: 'custom', message: '事项引用了不存在的类型' });
      for (const exception of Object.values(event.exceptions)) {
        if (exception.fields && !categories.has(exception.fields.categoryId))
          context.addIssue({ code: 'custom', message: '本次事项类型不存在' });
      }
    }
    if (new Set(state.photos.map((photo) => photo.id)).size !== state.photos.length)
      context.addIssue({ code: 'custom', message: '附件 ID 重复' });
    for (const photo of state.photos) {
      if (state.pendingPhotoDeletes.includes(photo.id))
        context.addIssue({ code: 'custom', message: '仍在使用的图片不能进入删除队列' });
      if (!ids.includes(photo.eventId))
        context.addIssue({ code: 'custom', message: '图片没有对应的事项' });
    }
  });

export type EventFields = z.infer<typeof fieldsSchema>;
export type EventRecord = z.infer<typeof eventSchema>;
export type Category = z.infer<typeof categorySchema>;
export type PhotoMeta = z.infer<typeof photoMetaSchema>;
export type Snapshot = z.infer<typeof snapshotSchema>;
export type Repeat = EventRecord['repeat'];
export type Occurrence = {
  event: EventRecord;
  date: string;
  originalDate: string;
  key: string;
  fields: EventFields;
};

export const defaultCategories: Category[] = [
  { id: 'uncategorized', name: '未分类', color: '#596b85' },
  { id: 'interview', name: '面试', color: '#34735f' },
  { id: 'written', name: '笔试', color: '#4d64a1' },
  { id: 'study', name: '学习', color: '#7d5d9d' },
  { id: 'work', name: '工作', color: '#28748a' },
  { id: 'life', name: '生活', color: '#a36a35' },
  { id: 'anniversary', name: '纪念日', color: '#a55579' },
  { id: 'subscription', name: '订阅缴费', color: '#84712e' },
];

export function emptySnapshot(): Snapshot {
  return {
    schemaVersion: 1,
    events: [],
    categories: structuredClone(defaultCategories),
    completed: [],
    photos: [],
    pendingPhotoDeletes: [],
    settings: { holidayFeedUrl: '' },
  };
}

export function emptyFields(): EventFields {
  return {
    title: '',
    categoryId: 'uncategorized',
    time: '',
    endTime: '',
    location: '',
    note: '',
    reminder: 'none',
  };
}

export const repeatLabels: Record<Repeat, string> = {
  none: '不重复',
  weekly: '每周',
  monthly: '每月',
  yearly: '每年（公历）',
  'lunar-yearly': '每年（农历）',
};
export const reminderLabels: Record<EventFields['reminder'], string> = {
  none: '不提醒',
  '30m': '提前 30 分钟',
  '1d': '提前 1 天',
  '3d': '提前 3 天',
};
