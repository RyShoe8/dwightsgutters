import { z } from 'zod';
import { database } from './db.mjs';
import { initialReviews } from './reviewSnapshot.mjs';

const review = z.object({
  id: z.string().min(1).max(200), author: z.string().trim().min(1).max(160),
  authorUrl: z.string().url().refine(value => {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password &&
      (url.hostname === 'www.google.com' && url.pathname.startsWith('/maps/contrib/') || url.hostname === 'www.yelp.com' && url.pathname === '/user_details');
  }),
  rating: z.number().int().min(1).max(5), text: z.string().trim().min(1).max(5000),
});
export const reviewSnapshotSchema = z.object({ sources: z.array(z.object({
  id: z.enum(['google', 'yelp']), rating: z.number().min(1).max(5), count: z.number().int().min(1).max(1000000),
  verifiedAt: z.string().date().refine(value => value <= new Date().toISOString().slice(0, 10), 'Verification date cannot be in the future.'),
  reviews: z.array(review).max(20),
}).superRefine((source, ctx) => {
  if (source.reviews.length > source.count || new Set(source.reviews.map(r => r.id)).size !== source.reviews.length) ctx.addIssue({ code: 'custom', message: 'Review IDs must be unique and the source total must cover the displayed reviews.' });
})).max(2).refine(sources => new Set(sources.map(s => s.id)).size === sources.length, 'Sources must be unique.') });

export async function getReviews() {
  const { db } = await database();
  const stored = await db.collection('settings').findOne({ _id: 'reviews' });
  return reviewSnapshotSchema.parse(stored?.snapshot || initialReviews);
}
export async function saveReviews(input, actor) {
  const snapshot = reviewSnapshotSchema.parse(input);
  const { db } = await database();
  await db.collection('settings').updateOne({ _id: 'reviews' }, { $set: { snapshot, updatedAt: new Date(), updatedBy: actor } }, { upsert: true });
  return snapshot;
}
// Platform averages are already rounded; the result is an approximation, not a
// recomputation from the selected testimonials.
export function combinedRating(sources) {
  const count = sources.reduce((sum, source) => sum + source.count, 0);
  return count ? { count, rating: sources.reduce((sum, source) => sum + source.rating * source.count, 0) / count } : null;
}
