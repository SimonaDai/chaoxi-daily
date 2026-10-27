import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

for (const name of [
  'ANDROID_KEYSTORE_BASE64',
  'ANDROID_KEYSTORE_PASSWORD',
  'ANDROID_KEY_ALIAS',
  'ANDROID_KEY_PASSWORD',
  'GITHUB_ENV',
]) {
  if (!process.env[name])
    throw new Error(`缺少 ${name}，请按 docs/GITHUB_APK.md 配置后再打 release 包。`);
}
if (process.env.GITHUB_REF !== 'refs/heads/main')
  throw new Error('固定签名正式包仅允许从已验收的 main 分支手动构建。');
const path = resolve('.tools/release.jks');
await mkdir(resolve('.tools'), { recursive: true });
await writeFile(path, Buffer.from(process.env.ANDROID_KEYSTORE_BASE64, 'base64'), { mode: 0o600 });
await appendFile(process.env.GITHUB_ENV, `ANDROID_KEYSTORE_PATH=${path}\n`);
console.log('正式签名已在临时构建环境准备，证书和口令不会写入源码。');
