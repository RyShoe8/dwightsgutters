import { randomUUID } from 'node:crypto';
import { DateTime } from 'luxon';
import { database, transaction } from './db.mjs';
import { bookingSchema, scheduleSchema, serviceSchema, customerSchema, fail } from './validation.mjs';
import { daySlots, ZONE, localTime } from './schedule.mjs';
import { bookingEmail, queueEmail, emailReady } from './email.mjs';
import { hash } from './auth.mjs';
// Every availability-affecting write takes this shared transaction lock. Mongo retries
// write conflicts, so a second booking always re-reads the first booking's committed slot.
async function scheduleLock(db, session) {
  const config = await db.collection('settings').findOneAndUpdate({ _id: 'schedule' }, { $inc: { revision: 1 } }, { session, returnDocument: 'after' });
  if (!config) fail(503, 'The booking system needs initial setup.');
  return config;
}
export async function availableSlots(serviceId, date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) fail(400, 'Choose a valid date.');
  const { db } = await database();
  const service = await db.collection('services').findOne({ _id: serviceId });
  const schedule = await db.collection('settings').findOne({ _id: 'schedule' });
  const day = DateTime.fromISO(date, { zone: ZONE });
  if (!day.isValid || day.toISODate() !== date) fail(400, 'Choose a valid date.');
  const bookings = await db.collection('bookings').find({ status: { $ne: 'cancelled' }, startsAt: { $lt: day.plus({ days: 1 }).toJSDate() }, occupiedUntil: { $gt: day.toJSDate() } }).toArray();
  return daySlots(date, service, schedule, bookings);
}
function receipt(booking) {
  return { reference: booking._id, startsAt: booking.startsAt, when: localTime(booking.startsAt), service: booking.service.name, priceCents: booking.service.priceCents, status: booking.status, emailStatus: 'queued' };
}
export async function createBooking(input) {
  const data = bookingSchema.parse(input);
  if (!emailReady()) fail(503, 'Online booking is not available yet. Please email Dwight.');
  const fingerprint = hash(JSON.stringify(data));
  return transaction(async (db, session) => {
    const schedule = await scheduleLock(db, session);
    const existing = await db.collection('bookings').findOne({ _id: data.requestId }, { session });
    if (existing) {
      if (existing.fingerprint !== fingerprint) fail(409, 'This request has already been used. Refresh before making another booking.');
      return receipt(existing);
    }
    const service = await db.collection('services').findOne({ _id: data.serviceId }, { session });
    if (!service?.active || service.priceCents === null) fail(409, 'This service is not currently available.');
    if (data.expectedPriceCents !== service.priceCents) fail(409, 'The service price has changed. Refresh and review the new price.');
    const date = DateTime.fromISO(data.startsAt, { zone: ZONE }).toISODate();
    const day = DateTime.fromISO(date, { zone: ZONE });
    const busy = await db.collection('bookings').find({ status: { $ne: 'cancelled' }, startsAt: { $lt: day.plus({ days: 1 }).toJSDate() }, occupiedUntil: { $gt: day.toJSDate() } }, { session }).toArray();
    const slot = daySlots(date, service, schedule, busy).find(s => new Date(s.startsAt).getTime() === new Date(data.startsAt).getTime());
    if (!slot) fail(409, 'That time is no longer available. Please choose another time.');
    const now = new Date();
    let customer = await db.collection('customers').findOne({ email: data.email }, { session });
    if (!customer) {
      customer = { _id: randomUUID(), name: data.name, email: data.email, phone: data.phone, status: 'active', notes: '', createdAt: now, updatedAt: now };
      await db.collection('customers').insertOne(customer, { session });
    }
    // Public forms never overwrite an existing CRM contact's private notes or identity.
    const { requestId, expectedPriceCents, consent, website, ...details } = data;
    const booking = { _id: requestId, ...details, customerId: customer._id, service: { name: service.name, priceCents: service.priceCents, durationMinutes: service.durationMinutes }, startsAt: new Date(slot.startsAt), endsAt: new Date(slot.endsAt), occupiedUntil: new Date(slot.occupiedUntil), status: 'confirmed', fingerprint, consentAt: now, createdAt: now, updatedAt: now };
    await db.collection('bookings').insertOne(booking, { session });
    await db.collection('customers').updateOne({ _id: customer._id }, { $set: { lastBookingAt: now } }, { session });
    await queueEmail(db, bookingEmail(booking), { session, id: `${requestId}-confirmation-customer` });
    await queueEmail(db, bookingEmail(booking, 'confirmation', true), { session, id: `${requestId}-confirmation-admin` });
    return receipt(booking);
  });
}
export async function saveService(id, input, actor) {
  const data = serviceSchema.parse(input);
  return transaction(async (db, session) => {
    await scheduleLock(db, session);
    const result = await db.collection('services').updateOne({ _id: id }, { $set: { ...data, updatedAt: new Date() } }, { session });
    if (!result.matchedCount) fail(404, 'Service not found.');
    await audit(db, session, actor, 'service.updated', id);
  });
}
export async function saveSchedule(input, actor) {
  const data = scheduleSchema.parse(input);
  if (data.exceptions.some(d => !DateTime.fromISO(d.date).isValid)) fail(400, 'An exception date is invalid.');
  return transaction(async (db, session) => {
    await scheduleLock(db, session);
    await db.collection('settings').updateOne({ _id: 'schedule' }, { $set: { ...data, timezone: ZONE } }, { session });
    await audit(db, session, actor, 'schedule.updated', 'schedule');
  });
}
export async function updateBooking(id, status, actor) {
  if (!['completed', 'cancelled'].includes(status)) fail(400, 'Choose completed or cancelled.');
  return transaction(async (db, session) => {
    await scheduleLock(db, session);
    const booking = await db.collection('bookings').findOne({ _id: id }, { session });
    if (!booking) fail(404, 'Booking not found.');
    if (booking.status === status) return;
    if (booking.status !== 'confirmed') fail(409, 'This booking is already closed.');
    if (status === 'completed' && booking.endsAt > new Date()) fail(409, 'A future appointment cannot be marked completed.');
    await db.collection('bookings').updateOne({ _id: id }, { $set: { status, updatedAt: new Date() } }, { session });
    if (status === 'cancelled') {
      await queueEmail(db, bookingEmail(booking, 'cancellation'), { session, id: `${id}-cancellation-customer` });
      await queueEmail(db, bookingEmail(booking, 'cancellation', true), { session, id: `${id}-cancellation-admin` });
    }
    await audit(db, session, actor, `booking.${status}`, id);
  });
}
export async function saveCustomer(id, input, actor) {
  const data = customerSchema.parse(input);
  return transaction(async (db, session) => {
    const result = await db.collection('customers').updateOne({ _id: id }, { $set: { ...data, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } }, { upsert: !id || input.create === true, session });
    if (!result.matchedCount && !result.upsertedCount) fail(404, 'Customer not found.');
    await audit(db, session, actor, 'customer.saved', id);
  });
}
async function audit(db, session, actor, action, target) {
  await db.collection('audit').insertOne({ actor, action, target, at: new Date() }, { session });
}
