import JsonLd from '../../components/JsonLd';
import { PostCard, PostCover, PostMeta } from '../../components/BlogCards';
import { businessPhone, businessPhoneHref } from '../../lib/business.mjs';
import { siteData } from '../../lib/siteData.mjs';
import { absolute, breadcrumbSchema, pageMetadata, siteName, siteUrl } from '../../lib/seo.mjs';
// New and edited posts appear immediately (the admin refreshes this page); otherwise hourly.
export const revalidate = 3600;
export async function generateMetadata() {
  const { posts } = await siteData();
  return pageMetadata({ title: 'Gutter Tips for Austin Homeowners | Dwight’s Gutters Blog', description: 'Seasonal gutter tips, local advice for Central Texas homes, and straight answers from Dwight’s Gutters, a veteran-owned Austin gutter cleaning business.', path: '/blog/', feed: true,
    // Nothing for search engines to index until the first post is published.
    ...(posts.length ? {} : { robots: { index: false, follow: true } }) });
}
export default async function Page() {
  const { posts } = await siteData();
  const [featured, ...rest] = posts;
  const schema = { '@graph': [breadcrumbSchema([['Home', '/'], ['Blog', '/blog/']]), { '@type': 'Blog', '@id': `${siteUrl}/blog/#blog`, name: `${siteName} blog`, url: absolute('/blog/'), publisher: { '@id': `${siteUrl}/#business` }, blogPost: posts.map(post => ({ '@type': 'BlogPosting', headline: post.title, url: absolute(`/blog/${post.slug}/`), datePublished: new Date(post.publishedAt).toISOString() })) }] };
  return <main id="main" className="blog-page">
    <JsonLd data={schema}/>
    <section className="page-intro blog-intro"><div className="container">
      <nav className="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <span>Blog</span></nav>
      <p className="eyebrow">THE DWIGHT’S GUTTERS BLOG</p>
      <h1>Gutter know-how for Central&nbsp;Texas homes.</h1>
      <p className="lead">Seasonal tips, local advice, and straight answers about keeping rain moving off your roof and away from your foundation.</p>
    </div></section>
    {featured ? <>
      <section className="section container blog-featured" aria-label="Latest post">
        <article className="post-feature">
          <a className="post-feature-photo" href={`/blog/${featured.slug}/`} tabIndex={-1} aria-hidden="true"><PostCover post={featured} priority sizes="(max-width: 900px) 100vw, 60vw" decorative/></a>
          <div className="post-feature-copy"><p className="eyebrow">LATEST POST</p><PostMeta post={featured}/><h2><a href={`/blog/${featured.slug}/`}>{featured.title}</a></h2><p>{featured.excerpt}</p><a className="button" href={`/blog/${featured.slug}/`}>Read the post <span aria-hidden="true">→</span></a></div>
        </article>
      </section>
      {rest.length > 0 && <section className="section pale blog-more" aria-labelledby="more-posts"><div className="container">
        <div className="section-heading"><div><p className="eyebrow">MORE FROM THE BLOG</p><h2 id="more-posts">Recent posts</h2></div></div>
        <div className="post-grid">{rest.map(post => <PostCard key={post.id} post={post}/>)}</div>
      </div></section>}
    </> : <section className="section container blog-empty-wrap"><div className="blog-empty">
      <img src="/assets/mark.png" alt="" width="96" height="96"/>
      <p className="eyebrow">COMING SOON</p>
      <h2>The first posts are on the way.</h2>
      <p>We’re putting together seasonal gutter tips and local advice for Austin-area homeowners. Check back soon.</p>
      <div className="actions"><a className="button" href="/book/">Book a cleaning <span aria-hidden="true">↗</span></a><a className="text-link" href={businessPhoneHref}>Call or text {businessPhone}</a></div>
    </div></section>}
    <section className="cta"><div className="container cta-inner"><div><p className="eyebrow">LET’S CLEAR THINGS UP</p><h2>Your gutters called.<br/>We’ll take it from here.</h2></div><a className="button white" href="/book/">Book a Cleaning<span aria-hidden="true">↗</span></a></div></section>
  </main>;
}
