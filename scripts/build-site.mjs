import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const python = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const tasks = [
  [python, ['scripts/render-math.py']],
  [process.execPath, ['sync-guides.mjs']],
  [process.execPath, ['sync-courses.mjs']],
  [process.execPath, ['sync-data.mjs']],
  [process.execPath, ['scripts/check-site.mjs']],
  [python, ['scripts/check-course-articles.py']],
];
for (const [command, args] of tasks) {
  const result = spawnSync(command, args, {cwd: root, stdio: 'inherit'});
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log('Ready to publish: dist/');
