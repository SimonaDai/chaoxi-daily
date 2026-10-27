import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { z } from 'zod';
import { type Snapshot, snapshotSchema } from '../domain/model';
import { blobToDataUrl, dataUrlToBlob, type Repository } from './repository';

const backupSchema = z.object({
  app: z.literal('chaoxi-daily'),
  version: z.literal(1),
  exportedAt: z.string().datetime(),
  snapshot: snapshotSchema,
  images: z
    .array(z.object({ id: z.string(), dataUrl: z.string().max(14 * 1024 * 1024) }))
    .max(10000),
});

export async function createBackup(snapshot: Snapshot, repository: Repository): Promise<string> {
  const images: { id: string; dataUrl: string }[] = [];
  let bytes = 0;
  for (const photo of snapshot.photos) {
    bytes += photo.bytes;
    if (bytes > 30 * 1024 * 1024)
      throw new Error('图片总量超过 30 MB，请先清理不需要的附件再备份。');
    const blob = await repository.readPhoto(photo.id);
    if (!blob) throw new Error(`附件“${photo.name}”缺失，请先处理后再备份，避免导出不完整数据。`);
    images.push({
      id: photo.id,
      dataUrl: await blobToDataUrl(new Blob([blob], { type: photo.mime })),
    });
  }
  return JSON.stringify({
    app: 'chaoxi-daily',
    version: 1,
    exportedAt: new Date().toISOString(),
    snapshot,
    images,
  });
}

export function parseBackup(text: string) {
  if (text.length > 45 * 1024 * 1024) throw new Error('备份文件过大。');
  const backup = backupSchema.parse(JSON.parse(text));
  const photoIds = new Set(backup.snapshot.photos.map((photo) => photo.id));
  const imageIds = backup.images.map((image) => image.id);
  if (
    new Set(imageIds).size !== imageIds.length ||
    photoIds.size !== imageIds.length ||
    imageIds.some((id) => !photoIds.has(id))
  )
    throw new Error('备份的附件列表不完整或重复。');
  const images = backup.images.map((image) => {
    const blob = dataUrlToBlob(image.dataUrl);
    const metadata = backup.snapshot.photos.find((photo) => photo.id === image.id);
    if (!metadata || blob.size !== metadata.bytes || blob.type !== metadata.mime)
      throw new Error('图片内容与附件信息不一致。');
    return { id: image.id, blob };
  });
  return { snapshot: backup.snapshot, images };
}

export async function exportFile(text: string): Promise<void> {
  const name = `chaoxi-backup-${new Date().toISOString().slice(0, 10)}.json`;
  if (Capacitor.isNativePlatform()) {
    const result = await Filesystem.writeFile({
      directory: Directory.Cache,
      path: name,
      data: text,
      encoding: Encoding.UTF8,
    });
    await Share.share({ title: '朝夕数据备份', url: result.uri, dialogTitle: '保存备份文件' });
  } else {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
