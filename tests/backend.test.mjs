import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { DateTime } from 'luxon';
import { database, seed } from '../lib/db.mjs';
import { daySlots } from '../lib/schedule.mjs';
import { saveCoverage, createBooking, availableSlots, saveService, saveSchedule, updateBooking, saveCustomer } from '../lib/bookings.mjs';
import { requestLogin, redeemToken, requireAdmin, hash, assertOrigin } from '../lib/auth.mjs';
import { flushOutbox, bookingEmail } from '../lib/email.mjs';
let repl, db;
const actor = 'dwight@dwightsgutters.com';
const date = DateTime.now().setZone('America/Chicago').plus({ days: 3 }).toISODate();
const config = { enabled: true, leadHours: 1, horizonDays: 60, bufferMinutes: 30, weekly: Array.from({ length: 7 }, (_, i) => ({ day: i + 1, enabled: true, start: '09:00', end: '17:00' })), exceptions: [] };
before(async () => {
  process.env.EMAIL_TRANSPORT = 'file'; process.env.APP_URL = 'http://127.0.0.1:3000'; process.env.MONGODB_DB = `test_${Date.now()}`;
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } }); process.env.MONGODB_URI = repl.getUri();
  ({ db } = await database()); await seed();
});
after(async () => { if (db) await db.dropDatabase(); if (globalThis.dwightMongo) await (await globalThis.dwightMongo).close(); await repl?.stop(); });
function payload(startsAt, overrides = {}) { return { requestId: randomUUID(), serviceId: 'gutter-cleaning', startsAt, expectedPriceCents: 15000, name: 'Integration Test', email: 'test@example.com', phone: '', contact: 'Email', address: '123 Test Lane', city: 'Austin', zip: '78701', stories: 'One story', guards: 'No', notes: '', consent: true, ...overrides }; }
test('seed is closed, unpriced, and idempotent', async () => {
  assert.equal(await db.collection('admins').countDocuments(), 2);
  assert.equal((await db.collection('admins').findOne({ _id: 'ryanschumacher@themediashop.co' })).enabled, true);
  assert.equal((await db.collection('settings').findOne({ _id: 'schedule' })).enabled, false);
  assert.equal((await db.collection('services').findOne()).priceCents, null);
  await saveService('gutter-cleaning', { name: 'Gutter cleaning', priceCents: 15000, durationMinutes: 120, active: true }, actor);
  await saveSchedule(config, actor); await seed();
  assert.equal((await db.collection('services').findOne({ _id: 'gutter-cleaning' })).priceCents, 15000);
});
test('admin access requires one-time token; expiry, replay, revocation and CSRF enforced', async () => {
  await assert.rejects(requireAdmin(''), /sign in/);
  assert.throws(() => assertOrigin(new Request('http://127.0.0.1:3000/api/admin', { headers: { origin: 'https://evil.example' } })), /this website/);
  await requestLogin(actor);
  const messages = await db.collection('outbox').find({ kind: 'login' }).toArray();
  assert.equal(messages.length, 1); assert.equal(messages[0].status, 'captured');
  const saved = JSON.parse(await readFile(`.local/mail/${messages[0]._id}.json`, 'utf8'));
  const token = saved.text.match(/token=([a-f0-9]+)/)[1];
  const secret = await redeemToken(token); assert.equal(await requireAdmin(secret), actor);
  await assert.rejects(redeemToken(token), /invalid or expired/);
  await db.collection('sessions').updateOne({ _id: hash(secret) }, { $set: { expiresAt: new Date(0) } });
  await assert.rejects(requireAdmin(secret), /sign in/);
  await requestLogin('outsider@example.com'); assert.equal(await db.collection('outbox').countDocuments({ kind: 'login' }), 1);
  const expired = 'a'.repeat(64); await db.collection('loginTokens').insertOne({ _id: hash(expired), email: actor, expiresAt: new Date(0) });
  await assert.rejects(redeemToken(expired), /invalid or expired/);
});
let booked, winningPayload;
test('concurrent bookings reserve exactly one slot, one customer and two confirmations', async () => {
  const [slot] = await availableSlots('gutter-cleaning', date); assert.ok(slot);
  const a = payload(slot.startsAt), b = payload(slot.startsAt, { email: 'second@example.com' });
  const results = await Promise.allSettled([createBooking(a), createBooking(b)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.find(r => r.status === 'rejected').reason.status, 409);
  const winner = results.findIndex(r => r.status === 'fulfilled'); winningPayload = winner === 0 ? a : b; booked = results[winner].value;
  assert.equal(await db.collection('bookings').countDocuments(), 1); assert.equal(await db.collection('customers').countDocuments(), 1);
  assert.equal(await db.collection('outbox').countDocuments({ kind: 'booking' }), 2);
  const remaining = await availableSlots('gutter-cleaning', date); assert.ok(remaining.every(s => new Date(s.startsAt) >= new Date(slot.occupiedUntil)));
});
test('retry is idempotent, conflicting reuse rejected, and price cannot be forged', async () => {
  assert.equal((await createBooking(winningPayload)).reference, booked.reference);
  await assert.rejects(createBooking({ ...winningPayload, name: 'Changed' }), /already been used/);
  assert.equal(await db.collection('bookings').countDocuments(), 1);
  const [slot] = await availableSlots('gutter-cleaning', date);
  await assert.rejects(createBooking(payload(slot.startsAt, { expectedPriceCents: 1 })), /price has changed/);
  await assert.rejects(createBooking(payload(slot.startsAt, { consent: false })));
  await assert.rejects(createBooking(payload(slot.startsAt, { website: 'spam' })));
});
test('service price changes preserve booking snapshot and cancellation releases slot atomically', async () => {
  await saveService('gutter-cleaning', { name: 'Gutter cleaning', priceCents: 17500, durationMinutes: 120, active: true }, actor);
  assert.equal((await db.collection('bookings').findOne({ _id: booked.reference })).service.priceCents, 15000);
  await assert.rejects(updateBooking(booked.reference, 'completed', actor), /future/);
  await updateBooking(booked.reference, 'cancelled', actor); await updateBooking(booked.reference, 'cancelled', actor);
  assert.ok((await availableSlots('gutter-cleaning', date)).some(s => s.startsAt === winningPayload.startsAt));
  assert.equal(await db.collection('outbox').countDocuments({ kind: 'booking' }), 4);
});
test('blackouts, closed switch, horizon, lead time and DST respect Austin calendar', async () => {
  await saveSchedule({ ...config, exceptions: [{ date, enabled: false, start: '09:00', end: '17:00' }] }, actor);
  assert.deepEqual(await availableSlots('gutter-cleaning', date), []);
  await assert.rejects(createBooking({ ...payload(winningPayload.startsAt), expectedPriceCents: 17500 }), /no longer available/);
  await saveSchedule({ ...config, enabled: false }, actor); assert.deepEqual(await availableSlots('gutter-cleaning', date), []);
  await saveSchedule(config, actor);
  const service = { active: true, priceCents: 10000, durationMinutes: 60 };
  const winter = daySlots('2027-03-13', service, { ...config, horizonDays: 180 }, [], new Date('2027-03-01T00:00:00Z'))[0];
  const summer = daySlots('2027-03-14', service, { ...config, horizonDays: 180 }, [], new Date('2027-03-01T00:00:00Z'))[0];
  assert.ok(winter.startsAt.includes('15:00:00')); assert.ok(summer.startsAt.includes('14:00:00'));
  assert.deepEqual(daySlots('2027-09-01', service, config, [], new Date('2027-03-01T00:00:00Z')), []);
  assert.deepEqual(daySlots('2027-03-01', service, { ...config, leadHours: 24 }, [], new Date('2027-03-01T12:00:00Z')), []);
});
test('CRM edit retains booking history, duplicate emails rejected', async () => {
  const c = await db.collection('customers').findOne();
  await saveCustomer(c._id, { name: 'Updated name', email: c.email, phone: '5125550100', status: 'active', notes: 'Private access note' }, actor);
  assert.equal((await db.collection('customers').findOne()).notes, 'Private access note');
  assert.equal((await db.collection('bookings').findOne()).name, 'Integration Test');
  await assert.rejects(saveCustomer(randomUUID(), { create: true, name: 'Duplicate', email: c.email, phone: '', status: 'lead', notes: '' }, actor));
});
test('outbox capture is idempotent, escaped email uses approved logo, failed delivery preserves booking', async () => {
  const b = await db.collection('bookings').findOne(); const mail = bookingEmail({ ...b, name: '<script>alert(1)</script>' });
  assert.ok(mail.html.includes('&lt;script&gt;')); assert.ok(!mail.html.includes('<script>')); assert.ok(mail.html.includes('/assets/logo.png'));
  delete process.env.EMAIL_TRANSPORT; delete process.env.RESEND_API_KEY;
  const failed = await flushOutbox({ ids: [`${b._id}-confirmation-customer`], limit: 1 }); assert.equal(failed[0].status, 'pending');
  assert.equal(await db.collection('bookings').countDocuments(), 1);
  process.env.EMAIL_TRANSPORT = 'file';
  await db.collection('outbox').updateMany({ kind: 'booking' }, { $set: { nextAttemptAt: new Date(0) } });
  await flushOutbox(); assert.equal(await db.collection('outbox').countDocuments({ kind: 'booking', status: 'captured' }), 4);
  assert.deepEqual(await flushOutbox(), []);
  assert.ok((await readdir('.local/mail')).some(f => f.endsWith('.html')));
});

test('coverage disables new bookings, preserves history and survives reseeding', async () => {
  const initial = await db.collection('settings').findOne({ _id: 'coverage' });
  assert.equal(initial.enabledZips.length, 55);
  await saveCoverage({ revision: initial.revision, enabledZips: initial.enabledZips.filter(z => z !== '78701') }, actor);
  await seed();
  assert.ok(!(await db.collection('settings').findOne({ _id: 'coverage' })).enabledZips.includes('78701'));
  const before = await db.collection('bookings').countDocuments();
  const customers = await db.collection('customers').countDocuments();
  const [slot] = await availableSlots('gutter-cleaning', date);
  await assert.rejects(createBooking(payload(slot.startsAt, { expectedPriceCents: 17500 })), /not available in this ZIP/);
  assert.equal(await db.collection('bookings').countDocuments(), before);
  assert.equal(await db.collection('customers').countDocuments(), customers);
  assert.equal((await createBooking(winningPayload)).reference, booked.reference);
  await assert.rejects(saveCoverage({ revision: initial.revision, enabledZips: initial.enabledZips }, actor), /another admin/);
  await assert.rejects(saveCoverage({ revision: initial.revision + 1, enabledZips: ['99999'] }, actor), /valid ZIP/);
  await saveCoverage({ revision: initial.revision + 1, enabledZips: initial.enabledZips }, actor);
  assert.ok((await db.collection('settings').findOne({ _id: 'coverage' })).enabledZips.includes('78701'));
});

// Contact submissions are separate from booked customers and never reserve a slot.
test('inquiries validate callback, reject spam, retry safely and appear only in their category', async () => {
 const { saveInquiry, listContacts } = await import('../lib/inquiries.mjs');
 const input = {requestId:randomUUID(), name:'Contact Test',email:'contact@example.com',callback:true,phone:'5125550199',message:'Please call about my gutters.',consent:true};
 await assert.rejects(saveInquiry({...input,phone:''}));
 await assert.rejects(saveInquiry({...input,website:'spam'}));
 await assert.rejects(saveInquiry({...input,consent:false}));
 await saveInquiry(input); await saveInquiry(input);
 assert.equal((await listContacts({kind:'inquiries',search:'contact@example.com'})).total,1);
 assert.equal((await listContacts({kind:'customers',search:'contact@example.com'})).total,0);
 await saveInquiry({...input,requestId:randomUUID(),email:'request@example.com'},'lead');
 assert.equal((await listContacts({kind:'leads',search:'request@example.com'})).total,1);
 assert.equal((await listContacts({kind:'inquiries',search:'request@example.com'})).total,0);
 const bookedCustomer = await db.collection('customers').findOne();
 assert.equal((await listContacts({kind:'customers',search:bookedCustomer.email})).total,1);
 assert.equal((await listContacts({kind:'leads',search:bookedCustomer.email})).total,0);
});

test('email codes share single-use credentials with links and enforce expiry and attempt limits', async () => {
 const { redeemCode } = await import('../lib/auth.mjs');
 const email = 'ryanschumacher@themediashop.co';
 async function latest() {
  await requestLogin(email);
  const tokenRecord = await db.collection('loginTokens').findOne({email});
  const mail = await db.collection('outbox').findOne({kind:'login',to:email},{sort:{createdAt:-1}});
  const saved = JSON.parse(await readFile(`.local/mail/${mail._id}.json`,'utf8'));
  return {record:tokenRecord, code:saved.text.match(/page: (\d{8})/)[1], token:saved.text.match(/token=([a-f0-9]+)/)[1]};
 }
 let login=await latest();
 assert.ok(!JSON.stringify(login.record).includes(`"${login.code}"`));
 const secret=await redeemCode(email,login.code); assert.equal(await requireAdmin(secret),email);
 await assert.rejects(redeemCode(email,login.code),/invalid or expired/);
 await assert.rejects(redeemToken(login.token),/invalid or expired/);
 login=await latest(); await redeemToken(login.token);
 await assert.rejects(redeemCode(email,login.code),/invalid or expired/);
 login=await latest();
 const wrong=login.code==='00000000'?'00000001':'00000000';
 for(let i=0;i<5;i++)await assert.rejects(redeemCode(email,wrong),/invalid or expired/);
 await assert.rejects(redeemCode(email,login.code),/invalid or expired/);
 // Locking the short code does not disable the unguessable emailed link.
 await redeemToken(login.token);
 await db.collection('limits').deleteOne({_id:hash(`login-code:${email}:${Math.floor(Date.now() / 900000)}`)});
 login=await latest();
 await db.collection('loginTokens').updateOne({_id:login.record._id},{$set:{expiresAt:new Date(0)}});
 await assert.rejects(redeemCode(email,login.code),/invalid or expired/);
 login=await latest();
 await db.collection('admins').updateOne({_id:email},{$set:{enabled:false}});
 await assert.rejects(redeemToken(login.token),/invalid or expired/);
 await assert.rejects(redeemCode(email,login.code),/invalid or expired/);
 await db.collection('admins').updateOne({_id:email},{$set:{enabled:true}});
});

test('requesting a new email invalidates the previous link and code', async () => {
 const {redeemCode}=await import('../lib/auth.mjs');
 await requestLogin(actor);
 const previous=await db.collection('loginTokens').findOne({email:actor});
 const mail=await db.collection('outbox').findOne({kind:'login',to:actor},{sort:{createdAt:-1}});
 const saved=JSON.parse(await readFile(`.local/mail/${mail._id}.json`,'utf8'));
 await requestLogin(actor);
 assert.equal(await db.collection('loginTokens').countDocuments({email:actor}),1);
 assert.equal(await db.collection('loginTokens').findOne({_id:previous._id}),null);
 await assert.rejects(redeemToken(saved.text.match(/token=([a-f0-9]+)/)[1]),/invalid or expired/);
 await assert.rejects(redeemCode(actor,saved.text.match(/page: (\d{8})/)[1]),/invalid or expired/);
});
