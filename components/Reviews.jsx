'use client';
import { useEffect, useState } from 'react';
import { initialReviews, reviewSources } from '../lib/reviewSnapshot.mjs';
import ProfileLinks from './ProfileLinks';

export default function Reviews() {
  const [snapshot, setSnapshot] = useState(initialReviews);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/reviews/', { signal: controller.signal }).then(async response => {
      if (response.ok) setSnapshot(await response.json());
    }).catch(() => {});
    return () => controller.abort();
  }, []);
  const count = snapshot.sources.reduce((sum, source) => sum + source.count, 0);
  const rating = count ? snapshot.sources.reduce((sum, source) => sum + source.rating * source.count, 0) / count : null;
  return <section className="section reviews-section" aria-labelledby="reviews-title"><div className="container">
    <div className="section-heading"><div><p className="eyebrow">FROM LOCAL HOMEOWNERS</p><h2 id="reviews-title">Good words.<br/>Clear gutters.</h2></div>
      {rating !== null && <div className="review-summary"><span className="review-stars" aria-hidden="true">{'★'.repeat(Math.round(rating))}{'☆'.repeat(5 - Math.round(rating))}</span><p><strong>{rating.toFixed(1)}</strong> / 5</p><span>{count} {snapshot.sources.length > 1 ? 'reviews across Google and Yelp · approximate combined rating' : `reviews on ${reviewSources[snapshot.sources[0].id].name}`}</span></div>}
    </div>
    <div className="review-cards">{snapshot.sources.flatMap(source => source.reviews.map(review => <figure className="review-card" key={`${source.id}:${review.id}`}>
      <div className="review-card-top"><span className="review-stars" aria-label={`${review.rating} out of 5 stars`}>{'★'.repeat(review.rating)}<span aria-hidden="true">{'☆'.repeat(5 - review.rating)}</span></span><a href={reviewSources[source.id].url} target="_blank" rel="noopener noreferrer">{reviewSources[source.id].name} ↗</a></div>
      <blockquote><p>“{review.text}”</p></blockquote>
      <figcaption><a href={review.authorUrl} target="_blank" rel="noopener noreferrer">{review.author}</a><span>Review on {reviewSources[source.id].name}</span></figcaption>
    </figure>))}</div>
    <div className="review-section-footer"><ProfileLinks/><p className="fine">Selected customer reviews. {snapshot.sources.map(source => `${reviewSources[source.id].name}: ${source.rating.toFixed(1)}/5 from ${source.count} reviews, verified ${new Date(`${source.verifiedAt}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })}.`).join(' ')}</p></div>
  </div></section>;
}
