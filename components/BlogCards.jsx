import BrandPhoto from './BrandPhoto';
import { coverAlt, coverSrc, postDate } from '../lib/blogShared.mjs';
// Cover photo for a post: brand photos get responsive sizes; uploads are served at two sizes.
export function PostCover({ post, size = 'full', priority = false, sizes, decorative = false }) {
  const alt = decorative ? '' : coverAlt(post);
  if (!post.cover) return <BrandPhoto name="gutter-cleaning" alt={alt} sizes={sizes} priority={priority}/>;
  if (post.cover.type === 'brand') return <BrandPhoto name={post.cover.name} alt={alt} sizes={sizes} priority={priority}/>;
  return <img src={coverSrc(post, size)} alt={alt} loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'auto'} decoding="async"/>;
}
export const PostMeta = ({ post }) => <p className="post-meta"><time dateTime={new Date(post.publishedAt).toISOString()}>{postDate(post.publishedAt)}</time><span aria-hidden="true">·</span><span>{post.readingMinutes} min read</span></p>;
export function PostCard({ post, headingLevel = 3 }) {
  const Heading = `h${headingLevel}`;
  return <article className="post-card">
    <a className="post-card-photo" href={`/blog/${post.slug}/`} tabIndex={-1} aria-hidden="true"><PostCover post={post} size="card" sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 400px" decorative/></a>
    <div className="post-card-copy"><PostMeta post={post}/><Heading><a href={`/blog/${post.slug}/`}>{post.title}</a></Heading><p>{post.excerpt}</p><a className="card-link" href={`/blog/${post.slug}/`} aria-hidden="true" tabIndex={-1}>Read the post →</a></div>
  </article>;
}
