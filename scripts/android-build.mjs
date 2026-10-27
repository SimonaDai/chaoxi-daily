import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';

const mode = process.argv[2];
if (!['debug', 'release'].includes(mode)) throw new Error('构建参数应为 debug 或 release');
await access(new URL('../android/gradlew', import.meta.url));
const android = new URL('../android/', import.meta.url);
const task = mode === 'debug' ? 'assembleDebug' : 'assembleRelease';
const command = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
const child = spawn(command, [task, '--no-daemon'], {
  cwd: android,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
child.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
