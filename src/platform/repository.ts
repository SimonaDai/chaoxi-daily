import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import { emptySnapshot, type Snapshot, snapshotSchema } from '../domain/model';

const STATE_KEY = 'chaoxi.snapshot.v1';
let database: Promise<IDBDatabase> | undefined;

function openDatabase(): Promise<IDBDatabase> {
  if (!database)
    database = new Promise((resolve, reject) => {
      const request = indexedDB.open('chaoxi-local-v1', 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('state');
        request.result.createObjectStore('photos');
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => {
          request.result.close();
          database = undefined;
        };
        resolve(request.result);
      };
      request.onerror = () => {
        database = undefined;
        reject(new Error('本机存储无法打开，请检查浏览器是否允许保存网站数据。'));
      };
      request.onblocked = () => reject(new Error('本机数据正被其他窗口使用，请关闭旧窗口后重试。'));
    });
  return database;
}

async function dbRead<T>(store: 'state' | 'photos', key: string): Promise<T | undefined> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(store, 'readonly');
    const request = transaction.objectStore(store).get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
  });
}

async function dbWrite(
  store: 'state' | 'photos',
  key: string,
  value: unknown,
  remove = false,
): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(store, 'readwrite');
    const target = transaction.objectStore(store);
    if (remove) target.delete(key);
    else target.put(value, key);
    transaction.oncomplete = () => resolve();
    transaction.onabort = transaction.onerror = () =>
      reject(transaction.error ?? new Error('本机保存失败，可能存储空间不足。'));
  });
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('图片读取失败。'));
    reader.readAsDataURL(blob);
  });
}

export function dataUrlToBlob(value: string): Blob {
  const match = value.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match?.[1] || !match[2]) throw new Error('图片备份格式无效。');
  const binary = atob(match[2]);
  return new Blob([Uint8Array.from(binary, (character) => character.charCodeAt(0))], {
    type: match[1],
  });
}

function photoPath(id: string): string {
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) throw new Error('附件标识无效。');
  return `photos/${id}`;
}

export interface Repository {
  native: boolean;
  load(): Promise<Snapshot>;
  save(snapshot: Snapshot): Promise<void>;
  savePhoto(id: string, blob: Blob): Promise<void>;
  readPhoto(id: string): Promise<Blob | null>;
  deletePhoto(id: string): Promise<void>;
}

export function createRepository(native = Capacitor.isNativePlatform()): Repository {
  return {
    native,
    async load() {
      const data = native
        ? (await Preferences.get({ key: STATE_KEY })).value
        : await dbRead<Snapshot>('state', STATE_KEY);
      if (!data) return emptySnapshot();
      return snapshotSchema.parse(typeof data === 'string' ? JSON.parse(data) : data);
    },
    async save(snapshot) {
      const valid = snapshotSchema.parse(snapshot);
      if (native) await Preferences.set({ key: STATE_KEY, value: JSON.stringify(valid) });
      else await dbWrite('state', STATE_KEY, valid);
    },
    async savePhoto(id, blob) {
      const path = photoPath(id);
      if (native) {
        const data = await blobToDataUrl(blob);
        await Filesystem.writeFile({
          path,
          directory: Directory.Data,
          data: data.slice(data.indexOf(',') + 1),
          recursive: true,
        });
      } else await dbWrite('photos', id, blob);
    },
    async readPhoto(id) {
      const path = photoPath(id);
      if (!native) return (await dbRead<Blob>('photos', id)) ?? null;
      try {
        const value = await Filesystem.readFile({ path, directory: Directory.Data });
        if (value.data instanceof Blob) return value.data;
        return new Blob([
          Uint8Array.from(atob(value.data), (character) => character.charCodeAt(0)),
        ]);
      } catch (error) {
        const message = String(error);
        if (/not exist|not found|no such file/i.test(message)) return null;
        throw error;
      }
    },
    async deletePhoto(id) {
      const path = photoPath(id);
      if (!native) {
        await dbWrite('photos', id, null, true);
        return;
      }
      try {
        await Filesystem.deleteFile({ path, directory: Directory.Data });
      } catch (error) {
        if (!/not exist|not found|no such file/i.test(String(error))) throw error;
      }
    },
  };
}

export function resetRepositoryConnectionForTests(): void {
  database = undefined;
}
