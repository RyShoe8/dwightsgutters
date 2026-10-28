import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialReviews } from '../lib/reviewSnapshot.mjs';
import { reviewSnapshotSchema, combinedRating } from '../lib/reviews.mjs';

test('verified snapshot keeps platform totals separate from selected testimonials', () => {
 const snapshot = reviewSnapshotSchema.parse(initialReviews);
 assert.equal(snapshot.sources[0].reviews.length, 3);
 assert.deepEqual(combinedRating(snapshot.sources), { rating: 5, count: 7 });
 assert.deepEqual(combinedRating([{ rating: 5, count: 7 }, { rating: 4, count: 1 }]), {rating: 4.875, count: 8});
 assert.equal(combinedRating([]), null);
});
test('review imports reject duplicate sources, duplicate reviews, unsafe URLs and impossible totals', () => {
 const source = initialReviews.sources[0];
 assert.equal(reviewSnapshotSchema.safeParse({ sources:[source,source] }).success, false);
 for(const change of [{rating:6},{count:0},{count:1},{verifiedAt:'not-a-date'},{reviews:[source.reviews[0],source.reviews[0]]},{reviews:[{...source.reviews[0],authorUrl:'javascript:alert(1)'}]}]) {
  assert.equal(reviewSnapshotSchema.safeParse({sources:[{...source,...change}]}).success,false);
 }
});
