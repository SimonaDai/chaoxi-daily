const accepted = new Set(['image/png', 'image/jpeg', 'image/webp']);

export function validateImage(file: Blob): void {
  if (!accepted.has(file.type)) throw new Error('请选择 PNG、JPG 或 WebP 图片。');
  if (!file.size || file.size > 8 * 1024 * 1024) throw new Error('图片需小于 8 MB。');
}

export async function compressImage(file: Blob): Promise<Blob> {
  validateImage(file);
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const ratio = Math.min(1, 4096 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(image.width * ratio);
    canvas.height = Math.round(image.height * ratio);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('当前设备无法处理图片。');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const result = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('图片处理失败。'))),
        'image/webp',
        0.9,
      ),
    );
    return result.size < file.size ? result : file;
  } finally {
    URL.revokeObjectURL(url);
  }
}
