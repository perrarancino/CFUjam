import { cp, readdir, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const appDir = fileURLToPath(new URL('../', import.meta.url));
const repoDir = path.resolve(appDir, '..');
const distDir = path.join(appDir, 'dist');
await stat(path.join(repoDir, '.git'));
await stat(path.join(distDir, 'index.html'));
for (const entry of await readdir(distDir)) {
  await cp(path.join(distDir, entry), path.join(repoDir, entry), { recursive: true, force: true });
}
await writeFile(path.join(repoDir, '.nojekyll'), '');
console.log('Prepared current app build for GitHub Pages in the repository root.');
