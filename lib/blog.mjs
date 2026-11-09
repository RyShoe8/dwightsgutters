import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { database } from './db.mjs';
import { fail } from './validation.mjs';
import { excerpt, readingMinutes } from './postFormat.mjs';
import { brandCovers } from './blogShared.mjs';
export { brandCovers, coverAlt, coverSrc, slugify } from './blogShared.mjs';
// Blog posts are written by owners in Admin → Blog and stored in MongoDB. Published posts
// appear at /blog/; drafts are visible only in the admin.
export const MAX_IMAGES_PER_POST = 30;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const cover = z.union([
  z.object({ type: z.literal('brand'), name: z.enum(brandCovers.map(c => c.name)) }),
  z.object({ type: z.literal('upload'), id: z.string().uuid() }),
]).nullable().default(null);
export const postSchema = z.object({
  title: z.string().trim().min(3, 'Give the post a title.').max(120),
  slug: z.string().trim().toLowerCase().min(1, 'Add a web address for the post.').max(80).regex(slugPattern, 'Use only lowercase letters, numbers and dashes in the web address.'),
  description: z.string().trim().max(220, 'Keep the summary under 220 characters.').default(''),
  body: z.string().max(60000, 'This post is too long. Split it into two posts.').default(''),
  cover, coverAlt: z.string().trim().max(200).default(''),
  status: z.enum(['draft', 'published']),
}).refine(v => v.status === 'draft' || v.body.trim(), { message: 'Write the post before publishing it.' });
const summary = post => ({ id: post._id, title: post.title, slug: post.slug, description: post.description, excerpt: post.excerpt, cover: post.cover, coverAlt: post.coverAlt, readingMinutes: post.readingMinutes, status: post.status, publishedAt: post.publishedAt || null, updatedAt: post.updatedAt });
export async function listAdminPosts() {
  const { db } = await database();
  return (await db.collection('posts').find({}).sort({ updatedAt: -1 }).toArray()).map(post => ({ ...summary(post), body: post.body }));
}
export async function savePost(id, input, actor) {
  if (!z.string().uuid().safeParse(id).success) fail(400, 'Invalid post.');
  const data = postSchema.parse(input);
  const { db } = await database();
  if (data.cover?.type === 'upload' && !await db.collection('blogImages').findOne({ _id: data.cover.id }, { projection: { _id: 1 } })) fail(400, 'That cover photo is no longer available. Choose another.');
  const existing = await db.collection('posts').findOne({ _id: id }, { projection: { publishedAt: 1, createdAt: 1 } });
  const now = new Date();
  const post = { ...data, excerpt: data.description || excerpt(data.body), readingMinutes: readingMinutes(data.body), updatedAt: now, updatedBy: actor,
    ...(data.status === 'published' && !existing?.publishedAt ? { publishedAt: now } : {}) };
  try {
    await db.collection('posts').updateOne({ _id: id }, { $set: post, $setOnInsert: { createdAt: now, createdBy: actor } }, { upsert: true });
  } catch (error) {
    if (error.code === 11000) fail(409, 'Another post already uses that web address. Change it and save again.');
    throw error;
  }
  await db.collection('audit').insertOne({ actor, action: existing ? 'post.saved' : 'post.created', target: id, status: data.status, at: now });
  const saved = await db.collection('posts').findOne({ _id: id });
  return { ...summary(saved), body: saved.body };
}
export async function deletePost(id, actor) {
  const { db } = await database();
  const post = await db.collection('posts').findOne({ _id: id }, { projection: { slug: 1 } });
  if (!post) fail(404, 'Post not found.');
  await db.collection('posts').deleteOne({ _id: id });
  await db.collection('blogImages').deleteMany({ postId: id });
  await db.collection('audit').insertOne({ actor, action: 'post.deleted', target: id, slug: post.slug, at: new Date() });
  return { ok: true };
}
// Public reads. They fall back to no posts if the database can't be reached (for example during a build).
export async function publishedPosts({ limit = 200, exclude } = {}) {
  try {
    const { db } = await database();
    const items = await db.collection('posts').find({ status: 'published', ...(exclude ? { _id: { $ne: exclude } } : {}) }, { projection: { body: 0 } }).sort({ publishedAt: -1 }).limit(limit).toArray();
    return items.map(summary);
  } catch { return []; }
}
export async function publishedPost(slug) {
  if (!slugPattern.test(slug || '')) return null;
  try {
    const { db } = await database();
    const post = await db.collection('posts').findOne({ slug, status: 'published' });
    return post ? { ...summary(post), body: post.body } : null;
  } catch { return null; }
}
// Photos for posts are public once used, so they're served to anyone. The browser shrinks
// each one to JPEG first (which also removes location data).
const imageSchema = z.object({ image: z.string().min(1).max(3700000), thumb: z.string().min(1).max(820000) });
function jpegBytes(base64, maxBytes) {
  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) fail(400, 'That file isn’t a photo we can use. Try a JPG or PNG.');
  if (bytes.length > maxBytes) fail(413, 'That photo is too large to upload.');
  return bytes;
}
export async function addBlogImage(postId, input, actor) {
  if (!z.string().uuid().safeParse(postId).success) fail(400, 'Invalid post.');
  const { image, thumb } = imageSchema.parse(input);
  const data = jpegBytes(image, 2700000), card = jpegBytes(thumb, 600000);
  const { db } = await database();
  if (await db.collection('blogImages').countDocuments({ postId }) >= MAX_IMAGES_PER_POST) fail(409, `A post can have up to ${MAX_IMAGES_PER_POST} photos.`);
  const id = randomUUID();
  await db.collection('blogImages').insertOne({ _id: id, postId, data, card, size: data.length, uploadedBy: actor, uploadedAt: new Date() });
  return { id, src: `/api/blog-images/${id}/full/`, card: `/api/blog-images/${id}/card/` };
}
export async function readBlogImage(id, variant) {
  if (!z.string().uuid().safeParse(id).success) fail(404, 'Photo not found.');
  const { db } = await database();
  const image = await db.collection('blogImages').findOne({ _id: id }, { projection: variant === 'card' ? { card: 1 } : { data: 1 } });
  if (!image) fail(404, 'Photo not found.');
  return Buffer.from((variant === 'card' ? image.card : image.data).buffer);
}
