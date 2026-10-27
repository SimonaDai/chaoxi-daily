import type { Snapshot } from '../domain/model';
import { expiredPhotoIds } from '../domain/retention';
import type { Repository } from './repository';

/** 先持久化待删除队列，再清理文件；中断后可重试，避免删除失败或保存失败造成状态失配。 */
export async function flushPhotoDeletes(
  snapshot: Snapshot,
  repository: Repository,
): Promise<Snapshot> {
  const pending: string[] = [];
  for (const id of snapshot.pendingPhotoDeletes) {
    try {
      await repository.deletePhoto(id);
    } catch {
      pending.push(id);
    }
  }
  if (pending.length === snapshot.pendingPhotoDeletes.length) return snapshot;
  const next = { ...snapshot, pendingPhotoDeletes: pending };
  await repository.save(next);
  return next;
}

export async function cleanupExpiredPhotos(
  snapshot: Snapshot,
  repository: Repository,
  now = Date.now(),
): Promise<Snapshot> {
  const ids = expiredPhotoIds(snapshot, now);
  const next = ids.length
    ? {
        ...snapshot,
        photos: snapshot.photos.filter((photo) => !ids.includes(photo.id)),
        pendingPhotoDeletes: [...new Set([...snapshot.pendingPhotoDeletes, ...ids])],
      }
    : snapshot;
  if (ids.length) await repository.save(next);
  return flushPhotoDeletes(next, repository);
}
