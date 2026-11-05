import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DateTime } from 'luxon';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

let repl, db, bookings, access;
const everyDay = Array.from({ length: 7 }, (_, index) => ({ day: index + 1, enabled: true, start: '08:00', end: '18:00' }));
const details = (startsAt, extra = {}) => ({ requestId: randomUUID(), serviceId: 'gutter-cleaning', addOnIds: [], startsAt, expectedPriceCents: 0, name: 'Called In', email: 'called-in@example.com', phone: '', contact: 'Email', address: '5 Oak St', city: 'Austin', zip: '99999', stories: 'One story', guards: 'Not sure', notes: 'Gate code is with the office', ...extra });

before(async () => {
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  process.env.MONGODB_URI = repl.getUri(); process.env.MONGODB_DB = 'adminbooking'; process.env.EMAIL_TRANSPORT = 'file'; process.env.APP_URL = 'http://localhost:3000';
  const { database, seed } = await import('../lib/db.mjs');
  await seed(); ({ db } = await database());
  bookings = await import('../lib/bookings.mjs'); access = await import('../lib/access.mjs');
  await db.collection('services').updateOne({ _id: 'gutter-cleaning' }, { $set: { active: true, priceCents: 15000 } });
  // Online booking is off, with long notice and a short window: nothing is open to customers.
  await db.collection('settings').updateOne({ _id: 'schedule' }, { $set: { enabled: false, leadHours: 720, horizonDays: 1, bufferMinutes: 0, weekly: everyDay, exceptions: [] } });
});
after(async () => { if (db) await db.dropDatabase(); if (globalThis.dwightMongo) await (await globalThis.dwightMongo).close(); await repl?.stop(); });

const openSlot = async (days = 3, serviceId = 'gutter-cleaning') => {
  const date = DateTime.now().setZone('America/Chicago').plus({ days }).toISODate();
  return (await bookings.availableSlots(serviceId, date, [], { admin: true }))[0];
};
const price = async (id = 'gutter-cleaning') => (await db.collection('services').findOne({ _id: id })).priceCents;

test('admin availability ignores the online rules that customers see', async () => {
  assert.deepEqual(await bookings.availableDates('gutter-cleaning'), []);
  const dates = await bookings.availableDates('gutter-cleaning', [], { admin: true });
  assert.ok(dates.length > 300);
  assert.ok(await openSlot());
  assert.deepEqual(await bookings.availableSlots('gutter-cleaning', dates[3]), []);
});

test('an added booking is confirmed, needs no consent and emails the customer', async () => {
  const slot = await openSlot();
  const input = details(slot.startsAt, { expectedPriceCents: await price() });
  const result = await bookings.createBooking(input, 'staff@example.com');
  assert.equal(result.status, 'confirmed');
  assert.equal(result.delivery, 'email');
  const saved = await db.collection('bookings').findOne({ _id: input.requestId });
  assert.equal(saved.addedBy, 'staff@example.com');
  assert.equal(saved.confirmedBy, 'staff@example.com');
  assert.equal(saved.consentAt, undefined);
  assert.equal(saved.notes, input.notes);
  assert.ok(await db.collection('customers').findOne({ email: input.email }));
  assert.ok(await db.collection('outbox').findOne({ _id: `${input.requestId}-confirmation-customer` }));
  assert.ok(await db.collection('audit').findOne({ action: 'booking.added', target: input.requestId, actor: 'staff@example.com' }));
});

test('an added booking cannot overlap another or fall outside business hours', async () => {
  const slot = await openSlot(4);
  const expectedPriceCents = await price();
  await bookings.createBooking(details(slot.startsAt, { expectedPriceCents }), 'staff@example.com');
  await assert.rejects(bookings.createBooking(details(slot.startsAt, { expectedPriceCents, email: 'second@example.com' }), 'staff@example.com'), error => error.status === 409);
  const night = DateTime.now().setZone('America/Chicago').plus({ days: 5 }).set({ hour: 22, minute: 0, second: 0, millisecond: 0 }).toUTC().toISO();
  await assert.rejects(bookings.createBooking(details(night, { expectedPriceCents }), 'staff@example.com'), error => error.status === 409);
});

test('a phone customer is left for staff to text', async () => {
  const slot = await openSlot(6);
  const input = details(slot.startsAt, { expectedPriceCents: await price(), contact: 'Phone', phone: '5125550123' });
  const result = await bookings.createBooking(input, 'staff@example.com');
  assert.equal(result.delivery, 'text');
  assert.equal(await db.collection('outbox').findOne({ _id: `${input.requestId}-confirmation-customer` }), null);
});

test('the same booking request online still follows the customer rules', async () => {
  const slot = await openSlot(7);
  const input = details(slot.startsAt, { expectedPriceCents: await price() });
  await assert.rejects(bookings.createBooking(input));
  await assert.rejects(bookings.createBooking({ ...input, consent: true }), error => error.status === 409);
  assert.equal(await db.collection('bookings').findOne({ _id: input.requestId }), null);
});

test('owners and staff can add bookings', () => {
  for (const role of ['owner', 'staff']) {
    assert.doesNotThrow(() => access.authorizeRoute(role, 'admin/bookings', 'POST'));
    assert.doesNotThrow(() => access.authorizeRoute(role, 'admin/booking-dates', 'GET'));
    assert.doesNotThrow(() => access.authorizeRoute(role, 'admin/booking-slots', 'GET'));
  }
});
