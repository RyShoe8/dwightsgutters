import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DateTime } from 'luxon';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

let repl, db, bookings, messages, validation;
const everyDay = Array.from({ length: 7 }, (_, index) => ({ day: index + 1, enabled: true, start: '08:00', end: '18:00' }));
let offset = 3;
const slot = async () => { const date = DateTime.now().setZone('America/Chicago').plus({ days: offset++ }).toISODate(); return (await bookings.availableSlots('gutter-cleaning', date))[0].startsAt; };
const form = async (extra = {}) => ({ requestId: randomUUID(), serviceId: 'gutter-cleaning', addOnIds: [], startsAt: await slot(), expectedPriceCents: 15000, name: 'Sam Customer', email: '', phone: '', address: '5 Oak St', city: 'Austin', zip: '78701', stories: 'One story', guards: 'Not sure', notes: '', consent: true, ...extra });

before(async () => {
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  process.env.MONGODB_URI = repl.getUri(); process.env.MONGODB_DB = 'emailorphone'; process.env.EMAIL_TRANSPORT = 'file'; process.env.APP_URL = 'http://localhost:3000';
  const { database, seed } = await import('../lib/db.mjs');
  await seed(); ({ db } = await database());
  bookings = await import('../lib/bookings.mjs'); messages = await import('../lib/messages.mjs'); validation = await import('../lib/validation.mjs');
  await db.collection('services').updateOne({ _id: 'gutter-cleaning' }, { $set: { active: true, priceCents: 15000 } });
  await db.collection('settings').updateOne({ _id: 'schedule' }, { $set: { enabled: true, leadHours: 1, horizonDays: 60, bufferMinutes: 0, weekly: everyDay, exceptions: [] } });
});
after(async () => { if (db) await db.dropDatabase(); if (globalThis.dwightMongo) await (await globalThis.dwightMongo).close(); await repl?.stop(); });

test('a booking needs an email or a phone number, and one alone sets the contact method', () => {
  const base = { requestId: randomUUID(), serviceId: 'x', startsAt: new Date().toISOString(), expectedPriceCents: 0, name: 'A', address: 'B', city: 'C', zip: '78701', stories: 'One story', guards: 'No', consent: true };
  assert.throws(() => validation.bookingSchema.parse({ ...base }), /email address or a phone number/);
  assert.throws(() => validation.bookingSchema.parse({ ...base, phone: '12' }), /valid phone/);
  assert.throws(() => validation.bookingSchema.parse({ ...base, email: 'nope' }), /valid email/);
  assert.equal(validation.bookingSchema.parse({ ...base, phone: '5125550100', contact: 'Email' }).contact, 'Phone');
  assert.equal(validation.bookingSchema.parse({ ...base, email: 'a@example.com', contact: 'Phone' }).contact, 'Email');
  assert.equal(validation.bookingSchema.parse({ ...base, email: 'a@example.com', phone: '5125550100', contact: 'Phone' }).contact, 'Phone');
});

test('phone-only customers can book online and stay separate from each other', async () => {
  const one = await form({ phone: '5125550101' }), two = await form({ phone: '5125550102' });
  assert.equal((await bookings.createBooking(one)).delivery, 'text');
  await bookings.createBooking(two);
  const first = await db.collection('customers').findOne({ phone: '512-555-0101' }), second = await db.collection('customers').findOne({ phone: '512-555-0102' });
  assert.ok(first && second); assert.notEqual(first._id, second._id);
  assert.equal('email' in first, false);
  assert.equal(await db.collection('outbox').findOne({ _id: `${one.requestId}-confirmation-customer` }), null);
  assert.ok(await db.collection('outbox').findOne({ _id: `${one.requestId}-confirmation-admin` }));
  const again = await form({ phone: '5125550101' });
  await bookings.createBooking(again);
  assert.equal((await db.collection('bookings').findOne({ _id: again.requestId })).customerId, first._id);
});

test('staff can add an email to a phone-only customer, but a public form cannot', async () => {
  await bookings.createBooking(await form({ phone: '5125550103' }));
  await bookings.createBooking(await form({ phone: '5125550103', email: 'public@example.com' }));
  assert.equal((await db.collection('customers').find({ phone: '512-555-0103' }).toArray()).length, 2);
  await bookings.createBooking(await form({ phone: '5125550104' }));
  const { consent, ...input } = await form({ phone: '5125550104', email: 'added@example.com' });
  await bookings.createBooking(input, 'staff@example.com');
  const customers = await db.collection('customers').find({ phone: '512-555-0104' }).toArray();
  assert.equal(customers.length, 1); assert.equal(customers[0].email, 'added@example.com');
});

test('customer records can be saved with either and removing the email clears it', async () => {
  const id = randomUUID();
  const record = { name: 'Record', email: '', phone: '5125550105', status: 'active', notes: '' };
  await bookings.saveCustomer(id, { ...record, create: true }, 'owner@example.com');
  await bookings.saveCustomer(randomUUID(), { ...record, phone: '5125550106', create: true }, 'owner@example.com');
  await bookings.saveCustomer(id, { ...record, email: 'record@example.com' }, 'owner@example.com');
  assert.equal((await db.collection('customers').findOne({ _id: id })).email, 'record@example.com');
  await bookings.saveCustomer(id, record, 'owner@example.com');
  assert.equal('email' in await db.collection('customers').findOne({ _id: id }), false);
  await assert.rejects(bookings.saveCustomer(id, { ...record, phone: '' }, 'owner@example.com'), /email address or a phone number/);
});

test('scheduled messages and cancellations skip customers with no email', async () => {
  const input = await form({ phone: '5125550107' });
  await bookings.createBooking(input);
  const now = new Date();
  await db.collection('bookings').updateOne({ _id: input.requestId }, { $set: { status: 'completed', startsAt: DateTime.fromJSDate(now).minus({ months: 7 }).toJSDate() } });
  const queued = await messages.runScheduledMessages(now);
  assert.equal(queued.includes(null), false);
  const saved = await db.collection('bookings').findOne({ _id: input.requestId });
  assert.ok(saved.followUpSentAt || saved.serviceId !== 'gutter-cleaning');
  assert.equal(await db.collection('outbox').findOne({ _id: `${input.requestId}-followup` }), null);
  const other = await form({ phone: '5125550108' });
  await bookings.createBooking(other);
  await bookings.updateBooking(other.requestId, 'cancelled', 'owner@example.com');
  assert.equal(await db.collection('outbox').findOne({ _id: `${other.requestId}-cancellation-customer` }), null);
  assert.ok(await db.collection('outbox').findOne({ _id: `${other.requestId}-cancellation-admin` }));
});

test('seed replaces the old email index and keeps emails unique', async () => {
  const { seed } = await import('../lib/db.mjs');
  await db.collection('customers').dropIndex('email_1');
  await db.collection('customers').deleteMany({ email: { $exists: false } });
  await db.collection('customers').createIndex({ email: 1 }, { unique: true });
  await seed();
  const index = (await db.collection('customers').indexes()).find(item => item.name === 'email_1');
  assert.ok(index.partialFilterExpression); assert.equal(index.unique, true);
  await db.collection('customers').insertMany([{ _id: randomUUID(), phone: '1' }, { _id: randomUUID(), phone: '2' }]);
  await db.collection('customers').insertOne({ _id: randomUUID(), email: 'unique@example.com' });
  await assert.rejects(db.collection('customers').insertOne({ _id: randomUUID(), email: 'unique@example.com' }));
});
