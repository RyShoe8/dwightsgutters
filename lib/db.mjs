import { MongoClient } from 'mongodb';
export async function database() {
  if (!process.env.MONGODB_URI) throw Object.assign(new Error('Online booking is not configured yet. Please email Dwight.'), { status: 503 });
  if (!globalThis.dwightMongo) {
    const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000, maxPoolSize: 10 });
    globalThis.dwightMongo = client.connect().catch(error => { globalThis.dwightMongo = undefined; throw error; });
  }
  const client = await globalThis.dwightMongo;
  return { client, db: client.db(process.env.MONGODB_DB || 'dwights_gutters') };
}
export async function transaction(work) {
  const { client, db } = await database();
  const session = client.startSession();
  try { return await session.withTransaction(() => work(db, session), { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } }); }
  finally { await session.endSession(); }
}
// Run once per server process; retries after failure. All seed writes are insert-only.
export async function ensureInitialized() {
  if (!globalThis.dwightSeed) globalThis.dwightSeed = seed().catch(error => { globalThis.dwightSeed = undefined; throw error; });
  return globalThis.dwightSeed;
}
export async function seed() {
  const { db } = await database();
  await db.collection('customers').createIndex({ email: 1 }, { unique: true });
  await db.collection('bookings').createIndex({ startsAt: 1, occupiedUntil: 1, status: 1 });
  await db.collection('bookings').createIndex({ customerId: 1, startsAt: -1 });
  for (const collection of ['sessions', 'loginTokens', 'limits']) await db.collection(collection).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await db.collection('outbox').createIndex({ status: 1, nextAttemptAt: 1 });
  await db.collection('outbox').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await db.collection('admins').updateOne({ _id: 'dwight@dwightsgutters.com' }, { $setOnInsert: { name: 'Dwight', enabled: true, createdAt: new Date() } }, { upsert: true });
  for (const [id, name] of [['gutter-cleaning', 'Gutter cleaning'], ['downspout-concern', 'Downspout concern'], ['seasonal-upkeep', 'Seasonal upkeep']]) {
    await db.collection('services').updateOne({ _id: id }, { $setOnInsert: { name, priceCents: null, durationMinutes: 120, active: false } }, { upsert: true });
  }
  await db.collection('settings').updateOne({ _id: 'schedule' }, { $setOnInsert: {
    revision: 0, enabled: false, timezone: 'America/Chicago', leadHours: 24, horizonDays: 60, bufferMinutes: 30,
    weekly: Array.from({ length: 7 }, (_, i) => ({ day: i + 1, enabled: false, start: '09:00', end: '17:00' })), exceptions: [],
  } }, { upsert: true });
}
