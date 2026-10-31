import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { database, transaction } from './db.mjs';
import { emailSchema, fail } from './validation.mjs';
import { loginEmail, queueEmail, flushOutbox, appUrl, emailReady } from './email.mjs';
export const hash = value => createHash('sha256').update(value).digest('hex');
export const cookieName = 'dwight_admin';
// Sessions slide: admin activity keeps pushing expiry out, so regular use stays signed in.
const sessionDays = 90;
export const sessionOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: sessionDays * 86400 };
const sessionExpiry = () => new Date(Date.now() + sessionDays * 86400000);
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
  const code = String(randomInt(0, 100000000)).padStart(8, '0');
  const codeSalt = randomBytes(16).toString('hex');
  const id = await transaction(async (db, session) => {
    await db.collection('loginTokens').deleteMany({ email }, { session });
    await db.collection('loginTokens').insertOne({ _id: hash(token), email, codeSalt, codeHash: hash(`${codeSalt}:${code}`), attempts: 0, expiresAt: new Date(Date.now() + 15 * 60000) }, { session });
    return queueEmail(db, loginEmail(email, token, code), { session, kind: 'login' });
  });
  await flushOutbox({ ids: [id], limit: 1 });
}
export async function redeemToken(token) {
  if (!/^[a-f0-9]{64}$/.test(token || '')) fail(400, 'This sign-in link is invalid or expired.');
  return redeemLogin({ _id: hash(token) });
}
export async function redeemCode(inputEmail, inputCode) {
  const email = emailSchema.parse(inputEmail);
  await limit(`login-code:${email}`, 10, 900);
  const code = typeof inputCode === 'string' ? inputCode.trim() : '';
  if (!/^\d{8}$/.test(code)) fail(400, 'Enter the 8-digit code from your latest sign-in email.');
  const { db } = await database();
  const login = await db.collection('loginTokens').findOneAndUpdate({ email, expiresAt: { $gt: new Date() }, attempts: { $lt: 5 }, codeHash: { $exists: true } }, { $inc: { attempts: 1 } }, { returnDocument: 'after' });
  if (!login || !safeEqual(login.codeHash, hash(`${login.codeSalt}:${code}`))) fail(401, 'This code is invalid or expired. Request a new sign-in email if needed.');
  return redeemLogin({ _id: login._id, codeHash: login.codeHash });
}
async function redeemLogin(filter) {
  const secret = randomBytes(32).toString('hex');
  await transaction(async (db, session) => {
    const login = await db.collection('loginTokens').findOneAndDelete({ ...filter, expiresAt: { $gt: new Date() } }, { session });
    if (!login || !await db.collection('admins').findOne({ _id: login.email, enabled: true }, { session })) fail(401, 'This sign-in link is invalid or expired.');
    await db.collection('sessions').insertOne({ _id: hash(secret), email: login.email, expiresAt: sessionExpiry() }, { session });
  });
  return secret;
}
export async function requireAdmin(secret) {
  if (!secret || !/^[a-f0-9]{64}$/.test(secret)) fail(401, 'Please sign in to continue.');
  const { db } = await database();
  const session = await db.collection('sessions').findOne({ _id: hash(secret), expiresAt: { $gt: new Date() } });
  if (!session || !await db.collection('admins').findOne({ _id: session.email, enabled: true })) fail(401, 'Please sign in to continue.');
  // Renew at most hourly rather than writing on every request.
  if (session.expiresAt.getTime() < sessionExpiry().getTime() - 3600000) await db.collection('sessions').updateOne({ _id: session._id }, { $set: { expiresAt: sessionExpiry() } });
  return session.email;
}
