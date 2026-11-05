// Publishes the brand assets for Admin → Media into public/media-library (gitignored), with small
// previews so the page loads quickly on a phone. branding/ stays the single source of truth.
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assetFiles, mediaItems, previewPath } from '../lib/mediaLibrary.mjs';
const source = path.resolve('branding'), target = path.resolve('public', 'media-library');
let sharp = null;
try { sharp = (await import('sharp')).default; } catch { console.warn('sharp is unavailable; Media previews will use full-size images.'); }
async function save(from, to) { await mkdir(path.dirname(to), { recursive: true }); await copyFile(from, to); }
async function preview(from, to) {
  await mkdir(path.dirname(to), { recursive: true });
  if (sharp) await writeFile(to, await sharp(from).resize({ width: 640, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer());
  else await writeFile(to, await readFile(from));
}
await rm(target, { recursive: true, force: true });
const items = mediaItems();
for (const item of items) {
  for (const file of assetFiles(item)) await save(path.join(source, file), path.join(target, file));
  await preview(path.join(source, `${previewPath(item)}.png`), path.join(target, 'previews', `${previewPath(item)}.webp`));
}
console.log(`Media library ready: ${items.length} assets.`);
