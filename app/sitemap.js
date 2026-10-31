import { siteData } from '../lib/siteData.mjs';
import { sitemapEntries } from '../lib/seo.mjs';
// Rebuilt hourly, and immediately when Dwight changes coverage in admin.
export const revalidate = 3600;
export default async function sitemap() {
  return sitemapEntries(await siteData());
}
