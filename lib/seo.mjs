import { businessPhone } from './business.mjs';
import { cities, cityServed, landingServices } from './cities.mjs';
export const siteUrl = 'https://dwightsgutters.com';
export const siteName = 'Dwight’s Gutters';
const ogImage = { url: '/assets/social-preview-white.png', width: 1200, height: 630, alt: 'Dwight’s Gutters — Austin gutter cleaning' };
// Title, description, canonical URL and social cards for one page.
export function pageMetadata({ title, description, path, robots }) {
  return {
    title, description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, siteName, locale: 'en_US', type: 'website', images: [ogImage] },
    twitter: { card: 'summary_large_image', title, description, images: [ogImage.url] },
    ...(robots ? { robots } : {}),
  };
}
export const absolute = path => new URL(path, siteUrl).toString();
export const landingPath = (service, citySlug) => `/${service}/${citySlug}/`;
// Pages included in the sitemap. City pages appear only while their area is enabled.
export function sitemapEntries({ enabledZips, coverageUpdatedAt }) {
  const pages = [['/', 1, 'weekly'], ['/services/', 0.9, 'monthly'], ['/book/', 0.9, 'weekly'], ['/service-area/', 0.8, 'monthly'], ['/gutter-cleaning/', 0.8, 'monthly'], ['/gutter-repair/', 0.8, 'monthly'], ['/about/', 0.6, 'yearly'], ['/contact/', 0.6, 'yearly'], ['/terms/', 0.2, 'yearly'], ['/cookie-policy/', 0.2, 'yearly']]
    .map(([path, priority, changeFrequency]) => ({ url: absolute(path), changeFrequency, priority }));
  const served = cities.filter(c => cityServed(c, enabledZips));
  const landings = Object.keys(landingServices).flatMap(service => served.map(c => ({ url: absolute(landingPath(service, c.slug)), changeFrequency: 'monthly', priority: c.slug === 'austin' ? 0.9 : 0.8, ...(coverageUpdatedAt ? { lastModified: new Date(coverageUpdatedAt) } : {}) })));
  return [...pages, ...landings];
}
export const robotsRules = {
  disallow: ['/admin/', '/book/change/', '/api/'],
  // The booking form and reviews read these when a crawler renders the page.
  allow: ['/', '/api/catalog/', '/api/reviews/', '/api/coverage/'],
};
// Search and AI assistant crawlers explicitly welcomed, with the same rules as everyone.
export const aiCrawlers = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'Applebot-Extended', 'Bingbot'];
// Structured data shared by every page: the business and the website.
export function businessSchema() {
  return {
    '@type': 'HomeAndConstructionBusiness', '@id': `${siteUrl}/#business`, name: siteName, url: siteUrl,
    description: 'Veteran-owned gutter cleaning and gutter repair for one- and two-story homes in Austin, Texas and surrounding cities. Book online.',
    telephone: '+1-737-425-1697', email: 'dwight@dwightsgutters.com', logo: absolute('/assets/logo.png'), image: absolute('/assets/social-preview-white.png'),
    priceRange: '$$', currenciesAccepted: 'USD', paymentAccepted: 'Cash, Check, Credit Card, Venmo, PayPal',
    address: { '@type': 'PostalAddress', addressLocality: 'Austin', addressRegion: 'TX', addressCountry: 'US' },
    areaServed: cities.map(c => ({ '@type': 'City', name: `${c.name}, TX` })),
    sameAs: ['https://share.google/lUWf6Nr0oXle8ruty', 'https://www.yelp.com/biz/dwights-gutter-cleaning-service-round-rock'],
    knowsAbout: ['Gutter cleaning', 'Gutter repair', 'Downspout cleaning'],
    contactPoint: { '@type': 'ContactPoint', telephone: '+1-737-425-1697', contactType: 'customer service', areaServed: 'US-TX', availableLanguage: 'English' },
  };
}
export const websiteSchema = () => ({ '@type': 'WebSite', '@id': `${siteUrl}/#website`, url: siteUrl, name: siteName, publisher: { '@id': `${siteUrl}/#business` } });
export const breadcrumbSchema = items => ({ '@type': 'BreadcrumbList', itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: absolute(path) })) });
export const faqSchema = faqs => ({ '@type': 'FAQPage', mainEntity: faqs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) });
export const phoneLine = `Call or text ${businessPhone}`;
// Plain-language summary for AI assistants (llms.txt). Facts only, with links to cite.
export function llmsText({ enabledZips, services }) {
  const served = cities.filter(c => cityServed(c, enabledZips));
  const usd = cents => `$${(cents / 100).toFixed(2).replace(/\.00$/, '')}`;
  const cleaning = services['gutter-cleaning'], repair = services['gutter-repair'], downspout = services['downspout-concern'];
  const pricing = [
    cleaning && `- Gutter cleaning: from ${usd(cleaning.priceCents)} for a one-story home; ${usd(cleaning.twoStoryPriceCents ?? cleaning.priceCents)} for a two-story home.`,
    repair && `- Gutter repair: ${usd(repair.hourlyRateCents)} per hour, ${usd(repair.priceCents)} minimum. Can be booked alone or added to a cleaning.`,
    downspout && `- Downspout attention: add-on to a cleaning, ${usd(downspout.priceCents)}.`,
  ].filter(Boolean);
  return `# Dwight’s Gutters

> Veteran-owned gutter cleaning and gutter repair for one- and two-story homes in Austin, Texas and surrounding cities. Customers book online at ${siteUrl}/book/ and pay after the job.

## Key facts
- Business: Dwight’s Gutters, owned by Dwight, a military veteran.
- Services: gutter cleaning, seasonal gutter upkeep, gutter repair, and downspout attention (as an add-on to a cleaning).
- Homes: one- and two-story residential homes only. Gutter replacement and gutter guard installation are not offered.
- Area: ${served.map(c => c.name).join(', ')} (Texas).
- Booking: online at ${siteUrl}/book/ with instant email confirmation. Appointments can be changed online up to 48 hours ahead.
- Payment: nothing is charged at booking. An invoice is emailed after the job.
- Phone: ${businessPhone} (call or text). Email: dwight@dwightsgutters.com.

## Pricing
${pricing.length ? pricing.join('\n') : `- Current prices are shown when booking at ${siteUrl}/book/.`}
- Final scope and price are confirmed with the customer before work begins.

## Pages
- [Services](${siteUrl}/services/): what each service includes.
- [Gutter cleaning by city](${siteUrl}/gutter-cleaning/)
- [Gutter repair by city](${siteUrl}/gutter-repair/)
- [Service area map](${siteUrl}/service-area/): ZIP-level coverage.
- [Book online](${siteUrl}/book/)
- [About](${siteUrl}/about/)
- [Contact](${siteUrl}/contact/)
- [Terms of Service](${siteUrl}/terms/)

## City pages
${served.map(c => `- ${c.name}, TX (${c.county}; ZIP ${c.zips.join(', ')}): [gutter cleaning](${absolute(landingPath('gutter-cleaning', c.slug))}), [gutter repair](${absolute(landingPath('gutter-repair', c.slug))})`).join('\n')}
`;
}
