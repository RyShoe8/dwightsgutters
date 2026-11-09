import { cache } from 'react';
import { notFound } from 'next/navigation';
import JsonLd from '../../../components/JsonLd';
import PostBody from '../../../components/PostBody';
import { PostCard, PostCover } from '../../../components/BlogCards';
import { businessPhone, businessPhoneHref } from '../../../lib/business.mjs';
import { publishedPost, publishedPosts } from '../../../lib/blog.mjs';
import { coverAlt, coverSrc, postDate } from '../../../lib/blogShared.mjs';
import { absolute, breadcrumbSchema, pageMetadata, siteUrl } from '../../../lib/seo.mjs';
// Published posts are built ahead; new ones render on first visit. Saving in the admin refreshes them.
export const revalidate = 3600;
export const dynamicParams = true;
const getPost = cache(publishedPost);
export async function generateStaticParams() {
  return (await publishedPosts()).map(post => ({ slug: post.slug }));
}
export async function generateMetadata({ params }) {
  const { slug } = await params, post = await getPost(slug);
  if (!post) return { title: 'Post not found | Dwight’s Gutters', robots: { index: false } };
  return pageMetadata({ title: `${post.title} | Dwight’s Gutters`, description: post.excerpt, path: `/blog/${post.slug}/`, feed: true,
    image: { url: coverSrc(post), alt: coverAlt(post) },
    article: { publishedTime: new Date(post.publishedAt).toISOString(), modifiedTime: new Date(post.updatedAt).toISOString() } });
}
export default async function Page({ params }) {
  const { slug } = await params, post = await getPost(slug);
  if (!post) notFound();
  const related = await publishedPosts({ limit: 3, exclude: post.id });
  const path = `/blog/${post.slug}/`;
  const updated = new Date(post.updatedAt) - new Date(post.publishedAt) > 86400000;
  const schema = { '@graph': [
    { '@type': 'BlogPosting', '@id': `${absolute(path)}#post`, headline: post.title, description: post.excerpt, image: absolute(coverSrc(post)), url: absolute(path), mainEntityOfPage: absolute(path),
      datePublished: new Date(post.publishedAt).toISOString(), dateModified: new Date(post.updatedAt).toISOString(),
      author: { '@id': `${siteUrl}/#business` }, publisher: { '@id': `${siteUrl}/#business` }, isPartOf: { '@id': `${siteUrl}/blog/#blog` } },
    breadcrumbSchema([['Home', '/'], ['Blog', '/blog/'], [post.title, path]]),
  ] };
  return <main id="main" className="blog-page post-page">
    <JsonLd data={schema}/>
    <header className="post-hero"><div className="container post-narrow">
      <nav className="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/blog/">Blog</a> / <span>{post.title}</span></nav>
      <p className="eyebrow"><time dateTime={new Date(post.publishedAt).toISOString()}>{postDate(post.publishedAt).toUpperCase()}</time><span aria-hidden="true">·</span>{post.readingMinutes} MIN READ</p>
      <h1>{post.title}</h1>
      {post.description && <p className="lead">{post.description}</p>}
      {updated && <p className="post-updated">Updated <time dateTime={new Date(post.updatedAt).toISOString()}>{postDate(post.updatedAt)}</time></p>}
    </div></header>
    <figure className="container post-cover"><PostCover post={post} priority sizes="(max-width: 1240px) 100vw, 1100px"/></figure>
    <article className="container post-narrow post-body"><PostBody body={post.body}/></article>
    <aside className="container post-narrow post-author" aria-label="About Dwight’s Gutters">
      <img src="/assets/mark.png" alt="" width="72" height="72"/>
      <div><p className="eyebrow">FROM DWIGHT’S GUTTERS</p><p>Veteran-owned gutter cleaning and repair for one- and two-story homes in Austin and surrounding cities. Book online in a couple of minutes, and pay after the job.</p>
        <div className="actions"><a className="button" href="/book/">Book a cleaning <span aria-hidden="true">↗</span></a><a className="text-link" href={businessPhoneHref}>Call or text {businessPhone}</a></div></div>
    </aside>
    {related.length > 0 && <section className="section pale blog-more" aria-labelledby="related-posts"><div className="container">
      <div className="section-heading"><div><p className="eyebrow">KEEP READING</p><h2 id="related-posts">More from the blog</h2></div><a className="text-link" href="/blog/">All posts →</a></div>
      <div className="post-grid">{related.map(item => <PostCard key={item.id} post={item}/>)}</div>
    </div></section>}
    <section className="cta"><div className="container cta-inner"><div><p className="eyebrow">LET’S CLEAR THINGS UP</p><h2>Your gutters called.<br/>We’ll take it from here.</h2></div><a className="button white" href="/book/">Book a Cleaning<span aria-hidden="true">↗</span></a></div></section>
  </main>;
}
