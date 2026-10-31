import { cache } from 'react';
import { database } from './db.mjs';
import { coverageZips, enabledCoverage } from './coverage-data.mjs';
import { initialReviews } from './reviewSnapshot.mjs';
// Live prices, coverage and reviews for statically rendered marketing pages. If the
// database is unreachable (for example during a build), pages fall back to every
// configured area, the verified review snapshot, and no published prices.
// Cached per request so metadata and the page share one database read.
export const siteData = cache(async () => {
  try {
    const { db } = await database();
    const [coverage, services, reviews] = await Promise.all([
      db.collection('settings').findOne({ _id: 'coverage' }),
      db.collection('services').find({}, { projection: { updatedAt: 0 } }).toArray(),
      db.collection('settings').findOne({ _id: 'reviews' }),
    ]);
    return {
      enabledZips: coverage ? enabledCoverage(coverage) : coverageZips,
      coverageUpdatedAt: coverage?.updatedAt || null,
      services: Object.fromEntries(services.filter(s => s.active && s.priceCents !== null).map(s => [s._id, s])),
      reviews: reviews?.snapshot || initialReviews,
    };
  } catch {
    return { enabledZips: coverageZips, coverageUpdatedAt: null, services: {}, reviews: initialReviews };
  }
});
export function reviewSummary(snapshot) {
  const count = snapshot.sources.reduce((sum, s) => sum + s.count, 0);
  return count ? { count, rating: snapshot.sources.reduce((sum, s) => sum + s.rating * s.count, 0) / count } : null;
}
