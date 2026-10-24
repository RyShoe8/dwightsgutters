import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { database, transaction } from './db.mjs';
import { emailSchema, fail } from './validation.mjs';
import { loginEmail, queueEmail, flushOutbox, appUrl, emailReady } from './email.mjs';
export const hash = value => createHash('sha256').update(value).digest('hex');
export const cookieName = 'dwight_admin';
export const sessionOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: 8 * 3600 };
export function assertOrigin(request) { if (request.headers.get('origin') !== appUrl()) fail(403, 'This request must come from this website.'); }
export function safeEqual(a, b) { return Boolean(a && b) && timingSafeEqual(Buffer.from(hash(a)), Buffer.from(hash(b))); }
export async function limit(key, maximum, seconds = 3600) {
  const { db } = await database();
  const bucket = Math.floor(Date.now() / (seconds * 1000));
  const item = await db.collection('limits').findOneAndUpdate({ _id: hash(`${key}:${bucket}`) }, { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((bucket + 2) * seconds * 1000) } }, { upsert: true, returnDocument: 'after' });
  if (item.count > maximum) fail(429, 'Too many attempts. Please try again later.');
}
export async function requestLogin(input) {
  const email = emailSchema.parse(input);
  await limit('login-global', 100); await limit(`login:${email}`, 5, 900);
  if (!emailReady()) fail(503, 'Admin email sign-in is not configured yet.');
  const { db } = await database();
  const admin = await db.collection('admins').findOne({ _id: email, enabled: true });
  if (!admin) return;
  const token = randomBytes(32).toString('hex');
  const id = await transaction(async (db, session) => {
    await db.collection('loginTokens').insertOne({ _id: hash(token), email, expiresAt: new Date(Date.now() + 15 * 60000) }, { session });
    return queueEmail(db, loginEmail(email, token), { session, kind: 'login' });
  });
  await flushOutbox({ ids: [id], limit: 1 });
}
export async function redeemToken(token) {
  if (!/^[a-f0-9]{64}$/.test(token || '')) fail(400, 'This sign-in link is invalid or expired.');
  const secret = randomBytes(32).toString('hex');
  await transaction(async (db, session) => {
    const login = await db.collection('loginTokens').findOneAndDelete({ _id: hash(token), expiresAt: { $gt: new Date() } }, { session });
    if (!login || !await db.collection('admins').findOne({ _id: login.email, enabled: true }, { session })) fail(401, 'This sign-in link is invalid or expired.');
    await db.collection('sessions').insertOne({ _id: hash(secret), email: login.email, expiresAt: new Date(Date.now() + 8 * 3600000) }, { session });
  });
  return secret;
}
export async function requireAdmin(secret) {
  if (!secret || !/^[a-f0-9]{64}$/.test(secret)) fail(401, 'Please sign in to continue.');
  const { db } = await database();
  const session = await db.collection('sessions').findOne({ _id: hash(secret), expiresAt: { $gt: new Date() } });
  if (!session || !await db.collection('admins').findOne({ _id: session.email, enabled: true })) fail(401, 'Please sign in to continue.');
  return session.email;
}
