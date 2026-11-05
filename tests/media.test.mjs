import { test } from 'node:test';
import assert from 'node:assert/strict';
import { access, readdir } from 'node:fs/promises';
import path from 'node:path';
import { assetFiles, mediaItems, previewPath } from '../lib/mediaLibrary.mjs';
import { robotsRules } from '../lib/seo.mjs';
const skip = /(^|[\\/])(source)([\\/]|$)|README\.md$|asset-manifest\.json$|palette\.(css|json)$/;
test('every Media entry points at a real brand file with a previewable PNG', async () => {
  for (const item of mediaItems()) {
    for (const file of assetFiles(item)) await access(path.join('branding', file));
    await access(path.join('branding', `${previewPath(item)}.png`));
  }
});
test('every brand asset in the branding folder is listed in Media', async () => {
  const listed = new Set(mediaItems().flatMap(assetFiles));
  const files = (await readdir('branding', { recursive: true, withFileTypes: true })).filter(entry => entry.isFile()).map(entry => path.relative('branding', path.join(entry.parentPath, entry.name)).replaceAll('\\', '/')).filter(file => !skip.test(file));
  assert.deepEqual(files.filter(file => !listed.has(file)), []);
});
test('the published media library stays out of search results', () => {
  assert.ok(robotsRules.disallow.includes('/media-library/'));
});
