import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { coverageZips } from '../lib/coverage-data.mjs';
test('every configured ZIP has one valid local Census polygon', async () => {
  const data = JSON.parse(await readFile(new URL('../public/data/service-area-zips.geojson', import.meta.url)));
  assert.deepEqual(data.features.map(f => f.properties.zip).sort(), coverageZips);
  for (const feature of data.features) {
    assert.ok(['Polygon', 'MultiPolygon'].includes(feature.geometry.type));
    const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    for (const polygon of polygons) for (const ring of polygon) {
      assert.ok(ring.length >= 4); assert.deepEqual(ring[0], ring.at(-1));
      for (const [lng, lat] of ring) { assert.ok(lng > -99 && lng < -97); assert.ok(lat > 29 && lat < 32); }
    }
  }
});
