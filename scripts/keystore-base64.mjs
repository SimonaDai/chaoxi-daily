import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const source = process.argv[2];
if (!source) throw new Error('用法：node scripts/keystore-base64.mjs "证书绝对路径"');
const content = await readFile(resolve(source));
if (content.byteLength > 32_000) throw new Error('证书文件过大，请核对是否选择正确的私钥库文件。');
const target = resolve('.tools/keystore-base64.txt');
await mkdir(resolve('.tools'), { recursive: true });
await writeFile(target, content.toString('base64'), { mode: 0o600 });
console.log(`已写入 ${target}。它包含私钥，请勿提交或分享；仅用于你的 GitHub Secret。`);
