import { aiCrawlers, robotsRules, siteUrl } from '../lib/seo.mjs';
export default function robots() {
  return {
    rules: [{ userAgent: '*', ...robotsRules }, { userAgent: aiCrawlers, ...robotsRules }],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
