import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { excerpt, parseInline, parsePost, plainText, readingMinutes, safeHref } from '../lib/postFormat.mjs';
import { slugify } from '../lib/blogShared.mjs';

let repl, db, blog, access, seo;
const jpeg = (size = 32) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(size, 9)]).toString('base64');
const draft = extra => ({ title: 'When to clean gutters in Austin', slug: 'when-to-clean-gutters', description: '', body: 'Oak season is here.\n\n## Spring\nClean after the tassels fall.', cover: { type: 'brand', name: 'austin-home' }, coverAlt: '', status: 'draft', ...extra });

before(async () => {
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  process.env.MONGODB_URI = repl.getUri(); process.env.MONGODB_DB = 'blog'; process.env.EMAIL_TRANSPORT = 'file'; process.env.APP_URL = 'http://localhost:3000';
  const { database, seed } = await import('../lib/db.mjs');
  await seed(); ({ db } = await database());
  blog = await import('../lib/blog.mjs'); access = await import('../lib/access.mjs'); seo = await import('../lib/seo.mjs');
});
after(async () => { if (db) await db.dropDatabase(); if (globalThis.dwightMongo) await (await globalThis.dwightMongo).close(); await repl?.stop(); });

test('posts are parsed into headings, lists, quotes, photos and paragraphs', () => {
  const blocks = parsePost('# Big title\n\nFirst line\nsame paragraph with **bold** and *italic*.\n\n## A heading\n- one\n- two\n\n1. first\n2. second\n\n> Clear gutters, dry foundation.\n\n![Clean gutter](/api/blog-images/0f8fad5b-d9cb-469f-a165-70867728950e/full/)');
  assert.deepEqual(blocks.map(block => block.type), ['h2', 'p', 'h2', 'ul', 'ol', 'quote', 'img']);
  assert.equal(blocks[2].id, 'a-heading');
  assert.deepEqual(blocks[1].text, ['First line same paragraph with ', { bold: ['bold'] }, ' and ', { italic: ['italic'] }, '.']);
  assert.equal(blocks[3].items.length, 2);
  assert.equal(blocks[6].alt, 'Clean gutter');
});

test('unsafe links and outside images are never rendered', () => {
  assert.equal(safeHref('javascript:alert(1)'), null);
  assert.equal(safeHref('//evil.example'), null);
  assert.equal(safeHref('data:text/html,hi'), null);
  assert.equal(safeHref('/book/'), '/book/');
  assert.equal(safeHref('https://example.com'), 'https://example.com');
  assert.deepEqual(parseInline('[click](javascript:alert(1))'), ['[click](javascript:alert(1)', ')']);
  assert.deepEqual(parsePost('![x](https://evil.example/pixel.png)'), []);
  assert.deepEqual(parsePost('<script>alert(1)</script>')[0].text, ['<script>alert(1)</script>']);
});

test('summaries, reading time and web addresses are worked out from the post', () => {
  assert.equal(plainText('## Hi\n\n**Bold** [link](/book/)'), 'Hi Bold link');
  assert.equal(readingMinutes('word '.repeat(660)), 3);
  assert.equal(readingMinutes(''), 1);
  assert.ok(excerpt('word '.repeat(100), 40).endsWith('…'));
  assert.equal(slugify('Oak Season & Your Gutters: What’s Next?'), 'oak-season-and-your-gutters-whats-next');
});

test('a draft stays private until it is published, and publishing keeps its first date', async () => {
  const id = randomUUID();
  const saved = await blog.savePost(id, draft(), 'owner@example.com');
  assert.equal(saved.status, 'draft'); assert.equal(saved.publishedAt, null);
  assert.equal((await blog.publishedPosts()).length, 0);
  assert.equal(await blog.publishedPost('when-to-clean-gutters'), null);
  const live = await blog.savePost(id, draft({ status: 'published' }), 'owner@example.com');
  assert.ok(live.publishedAt);
  assert.equal(live.excerpt, 'Oak season is here. Spring Clean after the tassels fall.');
  assert.equal(live.readingMinutes, 1);
  assert.equal((await blog.publishedPost('when-to-clean-gutters')).id, id);
  const posts = await blog.publishedPosts();
  assert.equal(posts.length, 1); assert.equal(posts[0].body, undefined);
  await blog.savePost(id, draft({ status: 'draft' }), 'owner@example.com');
  assert.equal(await blog.publishedPost('when-to-clean-gutters'), null);
  const again = await blog.savePost(id, draft({ status: 'published', description: 'Custom summary.' }), 'owner@example.com');
  assert.equal(new Date(again.publishedAt).getTime(), new Date(live.publishedAt).getTime());
  assert.equal(again.excerpt, 'Custom summary.');
});

test('posts need a title, a valid address, and some writing before publishing', async () => {
  await assert.rejects(blog.savePost(randomUUID(), draft({ title: '' }), 'owner@example.com'), /title/);
  await assert.rejects(blog.savePost(randomUUID(), draft({ slug: 'Bad Slug!' }), 'owner@example.com'), /lowercase letters/);
  await assert.rejects(blog.savePost(randomUUID(), draft({ slug: 'empty-post', body: '  ', status: 'published' }), 'owner@example.com'), /Write the post/);
  await assert.rejects(blog.savePost(randomUUID(), draft(), 'owner@example.com'), error => error.status === 409);
  await assert.rejects(blog.savePost('not-an-id', draft({ slug: 'x' }), 'owner@example.com'), error => error.status === 400);
  await assert.rejects(blog.savePost(randomUUID(), draft({ slug: 'missing-cover', cover: { type: 'upload', id: randomUUID() } }), 'owner@example.com'), error => error.status === 400);
});

test('post photos upload, serve, and are removed with their post', async () => {
  const id = randomUUID();
  const image = await blog.addBlogImage(id, { image: jpeg(64), thumb: jpeg(16) }, 'owner@example.com');
  assert.match(image.src, /^\/api\/blog-images\/[0-9a-f-]{36}\/full\/$/);
  assert.equal((await blog.readBlogImage(image.id, 'full')).toString('base64'), jpeg(64));
  assert.equal((await blog.readBlogImage(image.id, 'card')).toString('base64'), jpeg(16));
  await assert.rejects(blog.addBlogImage(id, { image: Buffer.from('not a photo').toString('base64'), thumb: jpeg() }, 'owner@example.com'), error => error.status === 400);
  await blog.savePost(id, draft({ slug: 'with-photo', cover: { type: 'upload', id: image.id }, body: `Intro\n\n![Gutter](${image.src})`, status: 'published' }), 'owner@example.com');
  assert.equal(blog.coverSrc(await blog.publishedPost('with-photo'), 'card'), image.card);
  await blog.deletePost(id, 'owner@example.com');
  assert.equal(await blog.publishedPost('with-photo'), null);
  await assert.rejects(blog.readBlogImage(image.id, 'full'), error => error.status === 404);
  await assert.rejects(blog.deletePost(id, 'owner@example.com'), error => error.status === 404);
});

test('published posts appear in the sitemap and llms.txt', async () => {
  const posts = await blog.publishedPosts();
  const urls = seo.sitemapEntries({ enabledZips: [], posts }).map(entry => entry.url);
  assert.ok(urls.includes('https://dwightsgutters.com/blog/'));
  assert.ok(urls.includes('https://dwightsgutters.com/blog/when-to-clean-gutters/'));
  assert.equal(seo.sitemapEntries({ enabledZips: [], posts: [] }).some(entry => entry.url.includes('/blog/')), false);
  assert.match(seo.llmsText({ enabledZips: [], services: {}, posts }), /## Blog\n- \[When to clean gutters in Austin\]/);
});

test('only owners can manage the blog', () => {
  for (const [route, method] of [['admin/posts', 'GET'], ['admin/posts/abc', 'PUT'], ['admin/posts/abc', 'DELETE'], ['admin/posts/abc/images', 'POST']]) {
    assert.throws(() => access.authorizeRoute('staff', route, method), `${method} ${route}`);
    assert.doesNotThrow(() => access.authorizeRoute('owner', route, method));
  }
});
