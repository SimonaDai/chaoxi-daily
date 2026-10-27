import { occurrenceFromOriginal } from './calendar';
import { chinaTimestamp, oneMonthAfter } from './dates';
import type { PhotoMeta, Snapshot } from './model';

export function photoIsExpired(photo: PhotoMeta, snapshot: Snapshot, now = Date.now()): boolean {
  if (now < oneMonthAfter(photo.createdAt)) return false;
  const event = snapshot.events.find((record) => record.id === photo.eventId);
  if (!event) return false; // 孤立附件交给明确的删除操作或导入修复，定期清理保持保守。
  if (!photo.occurrenceDate) {
    if (!event.date) return false;
    const end = event.fields.time
      ? chinaTimestamp(event.date, event.fields.endTime || event.fields.time)
      : chinaTimestamp(event.date, '00:00') + 86_400_000;
    return now >= end;
  }
  const occurrence = occurrenceFromOriginal(event, photo.occurrenceDate);
  if (!occurrence) return false;
  const end = occurrence.fields.time
    ? chinaTimestamp(occurrence.date, occurrence.fields.endTime || occurrence.fields.time)
    : chinaTimestamp(occurrence.date, '00:00') + 86_400_000;
  return now >= end;
}

export function expiredPhotoIds(snapshot: Snapshot, now = Date.now()): string[] {
  return snapshot.photos
    .filter((photo) => photoIsExpired(photo, snapshot, now))
    .map((photo) => photo.id);
}
