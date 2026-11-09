// Blog details used by both the site and the admin editor (no database code here).
export const brandCovers = [
  { name: 'gutter-cleaning', label: 'Gutter cleaning', alt: 'Close-up of oak leaves being cleared from a home’s gutter' },
  { name: 'austin-home', label: 'Austin home', alt: 'Limestone home with white gutters beneath live oak trees' },
  { name: 'austin-neighborhood', label: 'Neighborhood', alt: 'Tree-lined Austin neighborhood street with one- and two-story homes' },
];
export const slugify = text => String(text).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/['’]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/, '');
// Where a post's cover photo is served from. Cards use the smaller version.
export function coverSrc(post, size = 'full') {
  if (!post.cover) return null;
  if (post.cover.type === 'brand') return `/assets/${post.cover.name}-${size === 'card' ? 960 : 1536}.webp`;
  return `/api/blog-images/${post.cover.id}/${size === 'card' ? 'card' : 'full'}/`;
}
export function coverAlt(post) {
  return post.coverAlt || (post.cover?.type === 'brand' ? brandCovers.find(c => c.name === post.cover.name)?.alt : '') || '';
}
export const postDate = value => new Date(value).toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'long', day: 'numeric', year: 'numeric' });
