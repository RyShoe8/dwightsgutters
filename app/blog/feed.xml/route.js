import { publishedPosts } from '../../../lib/blog.mjs';
import { absolute, siteName } from '../../../lib/seo.mjs';
// RSS feed of published posts, for feed readers and anyone who wants new posts automatically.
export const revalidate = 3600;
const xml = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export async function GET() {
  const posts = await publishedPosts({ limit: 50 });
  const items = posts.map(post => `<item><title>${xml(post.title)}</title><link>${absolute(`/blog/${post.slug}/`)}</link><guid isPermaLink="true">${absolute(`/blog/${post.slug}/`)}</guid><pubDate>${new Date(post.publishedAt).toUTCString()}</pubDate><description>${xml(post.excerpt)}</description></item>`).join('');
  const body = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${xml(`${siteName} blog`)}</title><link>${absolute('/blog/')}</link><atom:link href="${absolute('/blog/feed.xml')}" rel="self" type="application/rss+xml"/><description>Gutter tips and local advice for Austin-area homeowners.</description><language>en-us</language>${posts[0] ? `<lastBuildDate>${new Date(posts[0].updatedAt).toUTCString()}</lastBuildDate>` : ''}${items}</channel></rss>`;
  return new Response(body, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
}
