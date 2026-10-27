import { type EventRecord, emptyFields, emptySnapshot, type PhotoMeta } from '../src/domain/model';

export function event(overrides: Partial<EventRecord> = {}): EventRecord {
  return {
    id: 'event-a',
    fields: { ...emptyFields(), title: '我的事项' },
    date: '2026-01-31',
    repeat: 'none',
    until: null,
    exceptions: {},
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}
export function photo(overrides: Partial<PhotoMeta> = {}): PhotoMeta {
  return {
    id: 'photo-a',
    eventId: 'event-a',
    occurrenceDate: '2026-01-31',
    createdAt: Date.parse('2026-01-31T10:00:00+08:00'),
    name: '短信.png',
    mime: 'image/png',
    bytes: 3,
    ...overrides,
  };
}
export function state(record = event(), image = photo()) {
  return { ...emptySnapshot(), events: [record], photos: [image] };
}
