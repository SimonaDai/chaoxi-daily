import { useEffect, useState } from 'react';
import type { PhotoMeta } from '../domain/model';
import type { Repository } from '../platform/repository';

export function PhotoAttachment({
  photo,
  repository,
  onRemove,
}: {
  photo: PhotoMeta;
  repository: Repository;
  onRemove?(): void;
}) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true,
      current = '';
    void repository
      .readPhoto(photo.id)
      .then((blob) => {
        if (!blob) throw new Error('图片已不存在，可移除附件记录。');
        current = URL.createObjectURL(new Blob([blob], { type: photo.mime }));
        if (active) setUrl(current);
        else URL.revokeObjectURL(current);
      })
      .catch((value: unknown) => {
        if (active) setError(value instanceof Error ? value.message : '图片读取失败。');
      });
    return () => {
      active = false;
      if (current) URL.revokeObjectURL(current);
    };
  }, [photo.id, photo.mime, repository]);
  return (
    <details className="photo-attachment">
      <summary>原始截图 · {photo.name}</summary>
      {error ? (
        <p role="alert">{error}</p>
      ) : url ? (
        <img src={url} alt={`事项截图：${photo.name}`} />
      ) : (
        <p>正在读取本机图片…</p>
      )}
      {onRemove && (
        <button type="button" className="text-button danger" onClick={onRemove}>
          移除这张图片
        </button>
      )}
    </details>
  );
}
