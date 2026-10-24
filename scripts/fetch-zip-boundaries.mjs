// Reproducible build-time data acquisition. Visitors never query Census directly.
import { writeFile, mkdir } from 'node:fs/promises';
import { coverageZips, zipLabels, coverageGroups } from '../lib/coverage-data.mjs';
const endpoint = 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/PUMA_TAD_TAZ_UGA_ZCTA/MapServer/1/query';
const params = new URLSearchParams({ where: `ZCTA5 IN (${coverageZips.map(z => `'${z}'`).join(',')})`, outFields: 'ZCTA5', returnGeometry: 'true', outSR: '4326', geometryPrecision: '5', maxAllowableOffset: '0.00008', f: 'geojson' });
const response = await fetch(`${endpoint}?${params}`, { signal: AbortSignal.timeout(120000) });
if (!response.ok) throw Error(`Census returned ${response.status}`);
const collection = await response.json();
if (collection.error || collection.exceededTransferLimit || !collection.features) throw Error('Census query failed or was truncated');
const found = collection.features.map(f => f.properties.ZCTA5);
if (found.length !== coverageZips.length || coverageZips.some(zip => !found.includes(zip))) throw Error('Missing or duplicate ZIP boundaries');
collection.features = collection.features.map(f => ({ type: 'Feature', properties: { zip: f.properties.ZCTA5, label: zipLabels[f.properties.ZCTA5] }, geometry: f.geometry })).sort((a,b) => a.properties.zip.localeCompare(b.properties.zip));
await mkdir('public/data', { recursive: true });
await writeFile('public/data/service-area-zips.geojson', JSON.stringify(collection));
const rows = [['Region','Community','ZIP code'], ...coverageGroups.flatMap(g => g.areas.flatMap(a => a.zips.map(z => [g.name,a.name,z])))];
await writeFile('public/data/service-area-zips.csv', rows.map(row => row.map(v => `"${v}"`).join(',')).join('\r\n'));
console.log(`Saved ${found.length} Census ZCTA polygons and grouped ZIP directory.`);
