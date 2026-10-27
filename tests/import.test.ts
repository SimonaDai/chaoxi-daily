import { describe, expect, it } from 'vitest';
import { snapshotSchema } from '../src/domain/model';
import { parseNotice } from '../src/domain/notice';
import { createBackup, parseBackup } from '../src/platform/backup';
import { createRepository } from '../src/platform/repository';
import { state } from './fixtures';

describe('通知解析保守填入候选字段', () => {
  it('存在无效日期时，不用另一个合法日期掩盖它', () => {
    expect(parseNotice('2026年2月30日确认，2026年3月2日面试').date).toBeNull();
  });
  it('完整年月日与两个时间可以填入，不开启提醒', () => {
    const result = parseNotice(
      '【星河科技】2026年10月28日 14:00-15:00 笔试 https://example.com/exam',
    );
    expect(result.date).toBe('2026-10-28');
    expect(result.fields).toMatchObject({
      categoryId: 'written',
      time: '14:00',
      endTime: '15:00',
      reminder: 'none',
      location: 'https://example.com/exam',
    });
  });
  it.each(['10月28日14:00面试', '2026年10月28日面试，2026年10月27日报名截止', '2026年2月30日面试'])(
    '不猜测含糊或无效日期：%s',
    (text) => {
      const result = parseNotice(text);
      expect(result.date).toBeNull();
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.fields.note).toBe(text);
    },
  );
  it('包含状态栏和多个时间时不擅自选时间', () => {
    expect(parseNotice('08:09 2026年10月28日14:00至16:00笔试').fields.time).toBe('');
  });
});

describe('真实本机存储与备份导入验证', () => {
  const image = new Blob(['abc'], { type: 'image/png' });
  it('存储后重新读取文字；备份包含完整附件内容', async () => {
    const repo = createRepository(false);
    const snapshot = state();
    await repo.savePhoto('photo-a', image);
    await repo.save(snapshot);
    expect((await repo.load()).events).toEqual(snapshot.events);
    // jsdom Blob 的内部槽不支持 Node structuredClone；真实浏览器附件持久化由 E2E 覆盖。
    const backup = await createBackup(snapshot, { ...repo, readPhoto: async () => image });
    const restored = parseBackup(backup);
    expect(restored.snapshot).toEqual(snapshot);
    expect(restored.images[0]?.blob.size).toBe(3);
  });
  it('拒绝缺图、重复 ID、越界路径和错误类型引用', async () => {
    const repo = createRepository(false);
    const valid = JSON.parse(
      await createBackup(state(), { ...repo, readPhoto: async () => image }),
    );
    expect(() => parseBackup(JSON.stringify({ ...valid, images: [] }))).toThrow();
    expect(() =>
      parseBackup(JSON.stringify({ ...valid, images: [...valid.images, ...valid.images] })),
    ).toThrow();
    const malformed = state();
    if (malformed.photos[0]) malformed.photos[0].id = '../outside';
    expect(snapshotSchema.safeParse(malformed).success).toBe(false);
    const missingType = state();
    if (missingType.events[0]) missingType.events[0].fields.categoryId = 'missing';
    expect(snapshotSchema.safeParse(missingType).success).toBe(false);
    expect(snapshotSchema.safeParse({ ...state(), pendingPhotoDeletes: ['photo-a'] }).success).toBe(
      false,
    );
    await expect(repo.savePhoto('../outside', new Blob(['x']))).rejects.toThrow();
  });
  it('损坏的本机资料不会被静默重置成空日历', async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('chaoxi-local-v1', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve) => {
      const transaction = db.transaction('state', 'readwrite');
      transaction.objectStore('state').put({ schemaVersion: 999 }, 'chaoxi.snapshot.v1');
      transaction.oncomplete = () => resolve();
    });
    await expect(createRepository(false).load()).rejects.toThrow();
    db.close();
  });
});
