import { mkdir, cp, writeFile, readdir, stat, unlink, rmdir } from 'node:fs/promises';
import path from 'node:path';
const root = process.cwd(), out = path.resolve(root, 'dist');
if (path.dirname(out) !== root || path.basename(out) !== 'dist') throw new Error('Invalid build output path.');
// Only clean the known generated dist directory; never follow directory links.
async function clean(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.isSymbolicLink()) { await clean(target); await rmdir(target); }
    else await unlink(target);
  }
}
await clean(out);
await mkdir(out, { recursive: true });
for (const entry of ['index.html', 'css', 'js', 'data', 'favicon.svg']) await cp(path.join(root, entry), path.join(out, entry), { recursive: true });
await mkdir(path.join(out, 'vendor/highs'), { recursive: true });
for (const name of ['highs.mjs', 'highs.wasm']) await cp(path.join(root, 'node_modules/highs/build', name), path.join(out, 'vendor/highs', name));
await cp(path.join(root, 'node_modules/highs/LICENSE'), path.join(out, 'vendor/highs/LICENSE'));
await writeFile(path.join(out, '.nojekyll'), '');
await cp(path.join(root, 'THIRD_PARTY_NOTICES.md'), path.join(out, 'THIRD_PARTY_NOTICES.md'));
console.log('Static application built in dist (including local WebAssembly solver).');
