import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import './prepare-licenses.mjs';

const require = createRequire(import.meta.url);
const target = new URL('../public/ocr/', import.meta.url);
await mkdir(new URL('core/', target), { recursive: true });
const tesseractRoot = dirname(require.resolve('tesseract.js/package.json'));
const coreRoot = dirname(require.resolve('tesseract.js-core/package.json'));
await copyFile(join(tesseractRoot, 'dist/worker.min.js'), new URL('worker.min.js', target));
for (const variant of ['lstm', 'simd-lstm', 'relaxedsimd-lstm']) {
  for (const extension of ['wasm', 'wasm.js']) {
    const name = `tesseract-core-${variant}.${extension}`;
    await copyFile(join(coreRoot, name), new URL(`core/${name}`, target));
  }
}
for (const lang of ['chi_sim', 'eng']) {
  const directory = dirname(require.resolve(`@tesseract.js-data/${lang}/package.json`));
  // 预解压消除 WebView / 静态服务器对 .gz 的 Content-Encoding 差异，APK 本身会压缩资源。
  const data = gunzipSync(await readFile(join(directory, `4.0.0_best_int/${lang}.traineddata.gz`)));
  if (data.byteLength < 1_000_000) throw new Error(`${lang} OCR 模型不完整`);
  await writeFile(new URL(`${lang}.traineddata`, target), data);
  await rm(new URL(`${lang}.traineddata.gz`, target), { force: true });
}
console.log('离线 OCR 引擎与中英文模型已准备，不需要上传截图或在线下载模型。');
