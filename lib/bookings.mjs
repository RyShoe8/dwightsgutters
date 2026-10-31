import { randomUUID, randomBytes } from 'node:crypto';
import { DateTime } from 'luxon';
import { database, transaction } from './db.mjs';
import { bookingSchema, scheduleSchema, serviceSchema, customerSchema, fail } from './validation.mjs';
import { daySlots, openDates, ZONE, localTime } from './schedule.mjs';
import { bookingEmail, invoiceEmail, queueEmail, emailReady } from './email.mjs';
import { getStaff, staffPhone } from './staff.mjs';
import { getPayments } from './payments.mjs';
import { invoicePaymentOptions } from './paymentOptions.mjs';
import { priceFor } from './pricing.mjs';
import { createInvoiceLink, stripeMinimumCents } from './stripe.mjs';
import { hash } from './auth.mjs';
import { coverageZips, enabledCoverage } from './coverage-data.mjs';
// Every availability-affecting write takes this shared transaction lock. Mongo retries
// write conflicts, so a second booking always re-reads the first booking's committed slot.
export async function scheduleLock(db, session) {
  const config = await db.collection('settings').findOneAndUpdate({ _id: 'schedule' }, { $inc: { revision: 1 } }, { session, returnDocument: 'after' });
  if (!config) fail(503, 'The booking system needs initial setup.');
  return config;
}
// A bookable service plus any chosen add-ons, combined into one price and duration.
export async function bookableService(db, serviceId, addOnIds = [], session, stories = 'One story') {
  const found = await db.collection('services').findOne({ _id: serviceId, kind: { $ne: 'addon' } }, { session });
  const service = found && { ...found, priceCents: priceFor(found, stories) };
  const ids = [...new Set(addOnIds)];
  if (!service || !ids.length) return service;
  const addOns = await db.collection('services').find({ _id: { $in: ids }, kind: 'addon' }, { session }).toArray();
  if (addOns.length !== ids.length || addOns.some(a => !a.active || a.priceCents === null || !a.appliesTo?.includes(serviceId))) fail(409, 'That add-on isn’t available with this service. Refresh and try again.');
  const sum = key => addOns.reduce((total, a) => total + a[key], 0);
  return { ...service, name: [service.name, ...addOns.map(a => a.name)].join(' + '), priceCents: service.priceCents === null ? null : service.priceCents + sum('priceCents'), durationMinutes: service.durationMinutes + sum('durationMinutes'), addOns: addOns.map(a => ({ id: a._id, name: a.name, priceCents: a.priceCents, durationMinutes: a.durationMinutes })) };
}
export async function availableSlots(serviceId, date, addOnIds = []) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) fail(400, 'Choose a valid date.');
  const { db } = await database();
  const service = await bookableService(db, serviceId, addOnIds);
  const schedule = await db.collection('settings').findOne({ _id: 'schedule' });
  const day = DateTime.fromISO(date, { zone: ZONE });
  if (!day.isValid || day.toISODate() !== date) fail(400, 'Choose a valid date.');
  const bookings = await db.collection('bookings').find({ status: { $ne: 'cancelled' }, startsAt: { $lt: day.plus({ days: 1 }).toJSDate() }, occupiedUntil: { $gt: day.toJSDate() } }).toArray();
  return daySlots(date, service, schedule, bookings);
}
export async function availableDates(serviceId, addOnIds = []) {
  const { db } = await database();
  const service = await bookableService(db, serviceId, addOnIds);
  const schedule = await db.collection('settings').findOne({ _id: 'schedule' });
  if (!schedule) return [];
  const today = DateTime.now().setZone(ZONE).startOf('day');
  const bookings = await db.collection('bookings').find({ status: { $ne: 'cancelled' }, startsAt: { $lt: today.plus({ days: schedule.horizonDays + 1 }).toJSDate() }, occupiedUntil: { $gt: today.toJSDate() } }).toArray();
  return openDates(service, schedule, bookings);
}
function receipt(booking) {
  return { reference: booking._id, startsAt: booking.startsAt, when: localTime(booking.startsAt), service: booking.service.name, priceCents: booking.service.priceCents, status: booking.status, emailStatus: 'queued' };
}
export async function createBooking(input) {
  const data = bookingSchema.parse(input);
  if (!emailReady()) fail(503, 'Online booking is not available yet. Please email Dwight.');
  const fingerprint = hash(JSON.stringify(data));
  const rescheduleToken = randomBytes(32).toString('hex');
  return transaction(async (db, session) => {
    const schedule = await scheduleLock(db, session);
    const existing = await db.collection('bookings').findOne({ _id: data.requestId }, { session });
    if (existing) {
      if (existing.fingerprint !== fingerprint) fail(409, 'This request has already been used. Refresh before making another booking.');
      return receipt(existing);
    }
    const coverage = await db.collection('settings').findOne({ _id: 'coverage' }, { session });
    if (!enabledCoverage(coverage).includes(data.zip)) fail(409, 'Online booking is not available in this ZIP code. Please email Dwight to ask about coverage.');
    const service = await bookableService(db, data.serviceId, data.addOnIds, session, data.stories);
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
    const { requestId, expectedPriceCents, consent, website, addOnIds, ...details } = data;
    const booking = { _id: requestId, ...details, customerId: customer._id, service: { name: service.name, priceCents: service.priceCents, durationMinutes: service.durationMinutes, ...(service.addOns ? { addOns: service.addOns } : {}) }, startsAt: new Date(slot.startsAt), endsAt: new Date(slot.endsAt), occupiedUntil: new Date(slot.occupiedUntil), status: 'confirmed', fingerprint, rescheduleTokenHash: hash(rescheduleToken), rescheduleVersion: 0, consentAt: now, createdAt: now, updatedAt: now };
    await db.collection('bookings').insertOne(booking, { session });
    await db.collection('customers').updateOne({ _id: customer._id }, { $set: { lastBookingAt: now } }, { session });
    const staff = await getStaff(db, session);
    await queueEmail(db, bookingEmail(booking, 'confirmation', false, { staff, rescheduleToken }), { session, id: `${requestId}-confirmation-customer` });
    await queueEmail(db, bookingEmail(booking, 'confirmation', true, { staff }), { session, id: `${requestId}-confirmation-admin` });
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
export async function saveCoverage(input, actor) {
  if (!input || !Number.isInteger(input.revision) || !Array.isArray(input.enabledZips) || input.enabledZips.length > coverageZips.length || input.enabledZips.some(zip => !coverageZips.includes(zip)) || new Set(input.enabledZips).size !== input.enabledZips.length) fail(400, 'Choose valid ZIP codes from the service-area directory.');
  return transaction(async (db, session) => {
    await scheduleLock(db, session);
    const result = await db.collection('settings').updateOne({ _id: 'coverage', revision: input.revision }, { $set: { enabledZips: [...input.enabledZips].sort(), updatedAt: new Date() }, $inc: { revision: 1 } }, { session });
    if (!result.matchedCount) fail(409, 'Coverage was changed by another admin. Reload coverage before saving again.');
    await audit(db, session, actor, 'coverage.updated', 'coverage');
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
export async function updateBooking(id, status, actor, invoiceInput = {}) {
  if (!['completed', 'cancelled'].includes(status)) fail(400, 'Choose completed or cancelled.');
  const validTotal = Number.isInteger(invoiceInput.totalCents) && invoiceInput.totalCents >= 0 && invoiceInput.totalCents <= 1000000;
  // Stripe is called before the transaction so retries never repeat a network call;
  // its idempotency key returns the same link for the same booking and total.
  let stripeUrl = null;
  if (status === 'completed') {
    const { db } = await database();
    const booking = await db.collection('bookings').findOne({ _id: id });
    if (validTotal && booking?.status === 'confirmed' && booking.startsAt <= new Date() && invoiceInput.totalCents >= stripeMinimumCents && (await getPayments(db)).stripe.enabled) {
      stripeUrl = await createInvoiceLink({ bookingId: id, totalCents: invoiceInput.totalCents, description: `${booking.service.name} · ${booking.address}, ${booking.city}` });
    }
  }
  return transaction(async (db, session) => {
    await scheduleLock(db, session);
    const booking = await db.collection('bookings').findOne({ _id: id }, { session });
    if (!booking) fail(404, 'Booking not found.');
    if (booking.status === status) return { invoice: booking.invoice || null };
    if (booking.status !== 'confirmed') fail(409, 'This booking is already closed.');
    if (status === 'completed' && booking.startsAt > new Date()) fail(409, 'A future appointment cannot be marked completed.');
    const staff = await getStaff(db, session);
    const now = new Date();
    let invoice;
    if (status === 'completed') {
      if (!validTotal) fail(400, 'Confirm a final invoice total between $0 and $10,000.');
      const settings = await getPayments(db, session);
      if (!invoicePaymentOptions(settings, { totalCents: invoiceInput.totalCents, stripeUrl }).length) fail(409, 'Add accepted payment options in Payments before sending an invoice.');
      const year = DateTime.fromJSDate(now, { zone: ZONE }).year;
      const counter = await db.collection('settings').findOneAndUpdate({ _id: `invoice-sequence-${year}` }, { $inc: { value: 1 } }, { upsert: true, returnDocument: 'after', session });
      const number = `DG-${year}-${String(counter.value).padStart(5, '0')}`;
      const payments = invoicePaymentOptions(settings, { totalCents: invoiceInput.totalCents, note: `Invoice ${number}`, stripeUrl });
      invoice = { number, totalCents: invoiceInput.totalCents, issuedAt: now, phone: staffPhone(staff), payments, issuedBy: actor };
      await queueEmail(db, invoiceEmail({ ...booking, invoice }), { session, id: `${id}-invoice-customer`, kind: 'invoice' });
    }
    await db.collection('bookings').updateOne({ _id: id }, { $set: { status, updatedAt: now, ...(invoice ? { invoice, completedAt: now } : {}) } }, { session });
    if (status === 'cancelled') {
      await queueEmail(db, bookingEmail(booking, 'cancellation', false, { staff }), { session, id: `${id}-cancellation-customer` });
      await queueEmail(db, bookingEmail(booking, 'cancellation', true, { staff }), { session, id: `${id}-cancellation-admin` });
    }
    await audit(db, session, actor, `booking.${status}`, id);
    return { invoice: invoice || null };
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
