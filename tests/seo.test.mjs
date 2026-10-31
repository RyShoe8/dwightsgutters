import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cities, cityBySlug, cityServed } from '../lib/cities.mjs';
import { coverageZips } from '../lib/coverage-data.mjs';
import { sitemapEntries, robotsRules, llmsText, pageMetadata, businessSchema, siteUrl } from '../lib/seo.mjs';

test('every service city has a unique slug, real coverage ZIPs, and valid nearby links', () => {
  assert.equal(new Set(cities.map(c => c.slug)).size, cities.length);
  for (const c of cities) {
    assert.ok(c.zips.length, c.slug);
    assert.ok(c.zips.every(zip => coverageZips.includes(zip)), c.slug);
    assert.ok(c.nearby.every(slug => cityBySlug[slug] && slug !== c.slug), c.slug);
    assert.ok(c.local.length > 80, `${c.slug} needs its own local note`);
  }
  assert.equal(new Set(cities.map(c => c.local)).size, cities.length);
  assert.ok(cityBySlug.austin.zips.length > 20);
});
test('sitemap lists public pages and only the city pages for enabled areas', () => {
  const all = sitemapEntries({ enabledZips: coverageZips, coverageUpdatedAt: '2026-10-31T00:00:00Z' }).map(e => e.url);
  assert.ok(all.includes(`${siteUrl}/`));
  assert.ok(all.includes(`${siteUrl}/gutter-cleaning/round-rock/`));
  assert.ok(all.includes(`${siteUrl}/gutter-repair/austin/`));
  assert.equal(all.filter(u => u.includes('/gutter-cleaning/') && u !== `${siteUrl}/gutter-cleaning/`).length, cities.length);
  assert.ok(!all.some(u => u.includes('/admin') || u.includes('/api/') || u.includes('/book/change')));
  const withoutKyle = sitemapEntries({ enabledZips: coverageZips.filter(z => !cityBySlug.kyle.zips.includes(z)), coverageUpdatedAt: null }).map(e => e.url);
  assert.ok(!withoutKyle.some(u => u.includes('/kyle/')));
  assert.ok(!cityServed(cityBySlug.kyle, []));
});
test('robots keep private areas out while letting crawlers render public pages', () => {
  for (const path of ['/admin/', '/book/change/', '/api/']) assert.ok(robotsRules.disallow.includes(path));
  for (const path of ['/', '/api/catalog/', '/api/reviews/']) assert.ok(robotsRules.allow.includes(path));
});
test('llms.txt states services, live prices, contact details and every served city', () => {
  const services = { 'gutter-cleaning': { priceCents: 15000, twoStoryPriceCents: 30000 }, 'gutter-repair': { priceCents: 5000, hourlyRateCents: 5000 }, 'downspout-concern': { priceCents: 4000 } };
  const text = llmsText({ enabledZips: coverageZips, services });
  for (const fact of ['from $150 for a one-story home', '$300 for a two-story home', '$50 per hour, $50 minimum', '(737) 425-1697', 'one- and two-story', `${siteUrl}/gutter-cleaning/georgetown/`]) assert.ok(text.includes(fact), fact);
  assert.ok(llmsText({ enabledZips: coverageZips, services: {} }).includes('Current prices are shown when booking'));
});
test('page metadata sets canonical URLs and social cards; business schema lists every city', () => {
  const meta = pageMetadata({ title: 'T', description: 'D', path: '/services/' });
  assert.equal(meta.alternates.canonical, '/services/');assert.equal(meta.openGraph.url, '/services/');assert.equal(meta.twitter.card, 'summary_large_image');
  const business = businessSchema();
  assert.equal(business.telephone, '+1-737-425-1697');assert.equal(business.areaServed.length, cities.length);
});
