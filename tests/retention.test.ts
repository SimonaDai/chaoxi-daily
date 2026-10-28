import { describe, expect, it, vi } from 'vitest';
import { photoIsExpired } from '../src/domain/retention';
import { cleanupExpiredPhotos, flushPhotoDeletes } from '../src/platform/photo-cleanup';
import type { Repository } from '../src/platform/repository';
import { event, photo, state } from './fixtures';

describe('图片保留一个自然月，且事项已经结束', () => {
  const timestamp = (value: string) => Date.parse(value);
  it('自然月满之前不清理，刚满自然月可以清理', () => {
    const snapshot = state();
    expect(photoIsExpired(photo(), snapshot, timestamp('2026-02-28T09:59:59+08:00'))).toBe(false);
    expect(photoIsExpired(photo(), snapshot, timestamp('2026-02-28T10:00:00+08:00'))).toBe(true);
  });
  it('未来事项、日期待定或没有对应事项的图片受保护', () => {
    const now = timestamp('2026-03-01T12:00:00+08:00');
    const future = event({ date: '2026-04-01' });
    const pending = photo({ occurrenceDate: null });
    expect(photoIsExpired(pending, state(future, pending), now)).toBe(false);
    expect(photoIsExpired(pending, state(event({ date: null }), pending), now)).toBe(false);
    expect(photoIsExpired(photo(), { ...state(), events: [] }, now)).toBe(false);
  });
  it('按改期后的那次日期判断，不因原日期已过而误删', () => {
    const record = event({
      repeat: 'monthly',
      exceptions: { '2026-01-31': { cancelled: false, date: '2026-04-01' } },
    });
    expect(photoIsExpired(photo(), state(record), timestamp('2026-03-02T12:00:00+08:00'))).toBe(
      false,
    );
    expect(photoIsExpired(photo(), state(record), timestamp('2026-04-02T00:00:00+08:00'))).toBe(
      true,
    );
  });
  it('全天事项当天结束前不清理', () => {
    const record = event({ date: '2026-03-01' });
    const image = photo({ occurrenceDate: '2026-03-01' });
    expect(
      photoIsExpired(image, state(record, image), timestamp('2026-03-01T22:00:00+08:00')),
    ).toBe(false);
    expect(
      photoIsExpired(image, state(record, image), timestamp('2026-03-01T23:59:59+08:00')),
    ).toBe(false);
    expect(
      photoIsExpired(image, state(record, image), timestamp('2026-03-02T00:00:00+08:00')),
    ).toBe(true);
  });
});

describe('清理的持久化与重试顺序', () => {
  function repository(): Repository {
    return {
      native: false,
      load: vi.fn(),
      save: vi.fn().mockResolvedValue(undefined),
      savePhoto: vi.fn(),
      readPhoto: vi.fn(),
      deletePhoto: vi.fn().mockResolvedValue(undefined),
    };
  }
  it('先记录删除队列，后删副本；保留事项文字', async () => {
    const repo = repository();
    const result = await cleanupExpiredPhotos(state(), repo, Date.parse('2026-04-01'));
    expect(repo.save).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ photos: [], pendingPhotoDeletes: ['photo-a'] }),
    );
    expect(repo.deletePhoto).toHaveBeenCalledWith('photo-a');
    expect(result.events[0]?.fields.title).toBe('我的事项');
    expect(result.pendingPhotoDeletes).toEqual([]);
  });
  it('保存删除计划失败时绝不删除文件', async () => {
    const repo = repository();
    vi.mocked(repo.save).mockRejectedValue(new Error('空间不足'));
    await expect(cleanupExpiredPhotos(state(), repo, Date.parse('2026-04-01'))).rejects.toThrow(
      '空间不足',
    );
    expect(repo.deletePhoto).not.toHaveBeenCalled();
  });
  it('删除失败留在队列，下一次前台检查能够重试', async () => {
    const repo = repository();
    vi.mocked(repo.deletePhoto).mockRejectedValueOnce(new Error('IO busy'));
    const failed = await cleanupExpiredPhotos(state(), repo, Date.parse('2026-04-01'));
    expect(failed.pendingPhotoDeletes).toEqual(['photo-a']);
    const retried = await flushPhotoDeletes(failed, repo);
    expect(retried.pendingPhotoDeletes).toEqual([]);
    expect(repo.deletePhoto).toHaveBeenCalledTimes(2);
  });
});
