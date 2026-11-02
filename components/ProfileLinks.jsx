import { reviewLinks, socialLinks } from '../lib/business.mjs';

export default function ProfileLinks() {
  return <div className="profile-links review-links">
    <a href={reviewLinks.google} target="_blank" rel="noopener noreferrer">Read reviews on Google ↗</a>
    <a href={reviewLinks.yelp} target="_blank" rel="noopener noreferrer">Read reviews on Yelp ↗</a>
    <a href={socialLinks.facebook} target="_blank" rel="noopener noreferrer">Follow us on Facebook ↗</a>
  </div>;
}
