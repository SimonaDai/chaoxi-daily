import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const project = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const notices = [await readFile(new URL('../THIRD_PARTY_NOTICES.md', import.meta.url), 'utf8')];
const seen = new Set();
async function collect(name, parentRequire) {
  let manifest;
  try {
    manifest = parentRequire.resolve(`${name}/package.json`);
  } catch {
    return;
  } // 浏览器打包器剔除的 Node 内置/平台可选依赖可能无法独立解析。
  if (seen.has(manifest)) return;
  seen.add(manifest);
  const directory = dirname(manifest);
  const metadata = JSON.parse(await readFile(manifest, 'utf8'));
  notices.push(
    `\n\n===== ${metadata.name} ${metadata.version} (${metadata.license ?? 'see upstream'}) =====\n`,
  );
  const files = (await readdir(directory)).filter((file) =>
    /^(?:licen[cs]e(?:[-.].*)?|ofl(?:\.txt)?|notice(?:\.txt)?)$/i.test(file),
  );
  for (const file of files) notices.push(await readFile(join(directory, file), 'utf8'));
  if (!files.length && name.startsWith('@tesseract.js-data/')) {
    notices.push(
      'Language data: https://github.com/tesseract-ocr/tessdata_best — Apache License 2.0.\n',
    );
    notices.push(
      await readFile(
        join(dirname(require.resolve('tesseract.js-core/package.json')), 'LICENSE'),
        'utf8',
      ),
    );
  }
  const childRequire = createRequire(manifest);
  for (const dependency of Object.keys(metadata.dependencies ?? {}))
    await collect(dependency, childRequire);
}
for (const name of Object.keys(project.dependencies)) await collect(name, require);
await mkdir(new URL('../public/', import.meta.url), { recursive: true });
await writeFile(new URL('../public/THIRD_PARTY_LICENSES.txt', import.meta.url), notices.join('\n'));
