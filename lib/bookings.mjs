import { randomUUID, randomBytes } from 'node:crypto';
import { DateTime } from 'luxon';
import { database, transaction } from './db.mjs';
import { bookingSchema, adminBookingSchema, scheduleSchema, serviceSchema, customerSchema, fail } from './validation.mjs';
import { daySlots, openDates, ZONE, localTime } from './schedule.mjs';
import { bookingEmail, invoiceEmail, queueEmail, emailReady } from './email.mjs';
import { reviewEmail } from './messages.mjs';
import { getStaff, staffPhone } from './staff.mjs';
import { getPayments } from './payments.mjs';
import { invoicePaymentOptions, paymentReceivedMethods } from './paymentOptions.mjs';
import { priceFor, minutesFor, storyOptions, isHourly, hourlyParts, addOnMinutes, isPlan } from './pricing.mjs';
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
  const service = found && { ...found, priceCents: priceFor(found, stories), durationMinutes: minutesFor(found, stories) };
  const ids = [...new Set(addOnIds)];
  if (!service || !ids.length) return service;
  const addOns = await db.collection('services').find({ _id: { $in: ids.filter(id => id !== serviceId) }, appliesTo: serviceId }, { session }).toArray();
  if (addOns.length !== ids.length || addOns.some(a => !a.active || a.priceCents === null || !a.appliesTo?.includes(serviceId))) fail(409, 'That add-on isn’t available with this service. Refresh and try again.');
  const sum = values => values.reduce((total, value) => total + value, 0);
  return { ...service, name: [service.name, ...addOns.map(a => a.name)].join(' + '), priceCents: service.priceCents === null ? null : service.priceCents + sum(addOns.map(a => a.priceCents)), durationMinutes: service.durationMinutes + sum(addOns.map(addOnMinutes)), addOns: addOns.map(a => ({ id: a._id, name: a.name, priceCents: a.priceCents, durationMinutes: addOnMinutes(a), ...(isHourly(a) ? { hourlyRateCents: a.hourlyRateCents } : {}) })) };
}
// Seasonal upkeep's second cleaning: the base service, discounted, with no add-ons. It may
// be booked well past the normal "book ahead" window, but at least 60 days after the first.
export const PLAN_HORIZON_MONTHS = 8, SECOND_VISIT_MIN_DAYS = 60;
export const planHorizonDays = (now = new Date()) => { const today = DateTime.fromJSDate(now, { zone: ZONE }).startOf('day'); return Math.round(today.plus({ months: PLAN_HORIZON_MONTHS }).diff(today, 'days').days); };
const planSchedule = schedule => ({ ...schedule, horizonDays: Math.max(schedule.horizonDays, planHorizonDays()) });
// Staff adding a booking can skip the online rules (booking switched off, minimum notice, how far
// ahead), but still work within business hours and can't double-book.
const ADMIN_HORIZON_DAYS = 365;
const adminSchedule = schedule => schedule && ({ ...schedule, enabled: true, leadHours: 0, horizonDays: Math.max(schedule.horizonDays, ADMIN_HORIZON_DAYS) });
export async function secondVisitService(db, serviceId, stories = 'One story', session) {
  const base = await db.collection('services').findOne({ _id: serviceId, kind: { $ne: 'addon' } }, { session });
  if (!isPlan(base)) return null;
  const price = priceFor(base, stories), discountCents = Math.min(price ?? 0, base.secondVisitDiscountCents || 0);
  return { ...base, durationMinutes: minutesFor(base, stories), name: `${base.name} (cleaning 2 of 2)`, priceCents: price === null ? null : price - discountCents, discountCents };
}
const earliestSecondDate = firstDate => DateTime.fromISO(firstDate, { zone: ZONE }).plus({ days: SECOND_VISIT_MIN_DAYS }).toISODate();
const busyOn = (db, day, session) => db.collection('bookings').find({ status: { $ne: 'cancelled' }, startsAt: { $lt: day.plus({ days: 1 }).toJSDate() }, occupiedUntil: { $gt: day.toJSDate() } }, { session }).toArray();
const knownStories = stories => storyOptions.includes(stories) ? stories : storyOptions[0];
export async function availableSlots(serviceId, date, addOnIds = [], { visit = 1, stories, admin = false } = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) fail(400, 'Choose a valid date.');
  const { db } = await database();
  const service = visit === 2 ? await secondVisitService(db, serviceId, knownStories(stories)) : await bookableService(db, serviceId, addOnIds, undefined, knownStories(stories));
  const saved = await db.collection('settings').findOne({ _id: 'schedule' }), schedule = admin ? adminSchedule(saved) : saved;
  const day = DateTime.fromISO(date, { zone: ZONE });
  if (!day.isValid || day.toISODate() !== date) fail(400, 'Choose a valid date.');
  return daySlots(date, service, visit === 2 && schedule ? planSchedule(schedule) : schedule, await busyOn(db, day));
}
export async function availableDates(serviceId, addOnIds = [], { visit = 1, after, stories, admin = false } = {}) {
  const { db } = await database();
  const saved = await db.collection('settings').findOne({ _id: 'schedule' }), schedule = admin ? adminSchedule(saved) : saved;
  if (!schedule) return [];
  if (visit === 2 && !/^\d{4}-\d{2}-\d{2}$/.test(after || '')) fail(400, 'Choose your first cleaning date first.');
  const service = visit === 2 ? await secondVisitService(db, serviceId, knownStories(stories)) : await bookableService(db, serviceId, addOnIds, undefined, knownStories(stories));
  const rules = visit === 2 ? planSchedule(schedule) : schedule;
  const today = DateTime.now().setZone(ZONE).startOf('day');
  const bookings = await db.collection('bookings').find({ status: { $ne: 'cancelled' }, startsAt: { $lt: today.plus({ days: rules.horizonDays + 1 }).toJSDate() }, occupiedUntil: { $gt: today.toJSDate() } }).toArray();
  const dates = openDates(service, rules, bookings);
  return visit === 2 ? dates.filter(d => d >= earliestSecondDate(after)) : dates;
}
// How the customer hears about this booking: by email, or by a text Dwight sends.
export const deliveryFor = booking => booking.contact === 'Phone' ? 'text' : 'email';
function receipt(booking, second) {
  return { reference: booking._id, startsAt: booking.startsAt, when: localTime(booking.startsAt), service: booking.service.name, priceCents: booking.service.priceCents, status: booking.status, delivery: deliveryFor(booking), emailStatus: 'queued', ...(second ? { second: { when: localTime(second.startsAt), priceCents: second.service.priceCents, discountCents: second.service.discountCents } } : {}) };
}
// With an actor, a signed-in owner or staff member is adding the booking for a customer.
export async function createBooking(input, actor = null) {
  const data = (actor ? adminBookingSchema : bookingSchema).parse(input);
  if (!emailReady()) fail(503, actor ? 'Email isn’t set up yet, so bookings can’t be added.' : 'Online booking is not available yet. Please email Dwight.');
  const fingerprint = hash(JSON.stringify(data));
  const tokens = [randomBytes(32).toString('hex'), randomBytes(32).toString('hex')];
  return transaction(async (db, session) => {
    const saved = await scheduleLock(db, session), schedule = actor ? adminSchedule(saved) : saved;
    const existing = await db.collection('bookings').findOne({ _id: data.requestId }, { session });
    if (existing) {
      if (existing.fingerprint !== fingerprint) fail(409, 'This request has already been used. Refresh before making another booking.');
      return receipt(existing, existing.planId ? await db.collection('bookings').findOne({ planId: existing.planId, visit: 2 }, { session }) : null);
    }
    const coverage = await db.collection('settings').findOne({ _id: 'coverage' }, { session });
    if (!actor && !enabledCoverage(coverage).includes(data.zip)) fail(409, 'Online booking is not available in this ZIP code. Please email Dwight to ask about coverage.');
    const service = await bookableService(db, data.serviceId, data.addOnIds, session, data.stories);
    if (!service?.active || service.priceCents === null) fail(409, 'This service is not currently available.');
    const date = DateTime.fromISO(data.startsAt, { zone: ZONE }).toISODate();
    const slot = daySlots(date, service, schedule, await busyOn(db, DateTime.fromISO(date, { zone: ZONE }), session)).find(s => new Date(s.startsAt).getTime() === new Date(data.startsAt).getTime());
    if (!slot) fail(409, 'That time is no longer available. Please choose another time.');
    let secondService = null, secondSlot = null;
    if (isPlan(service)) {
      if (!data.secondStartsAt) fail(400, 'Choose a date and time for your second cleaning.');
      secondService = await secondVisitService(db, data.serviceId, data.stories, session);
      const date2 = DateTime.fromISO(data.secondStartsAt, { zone: ZONE }).toISODate();
      if (date2 < earliestSecondDate(date)) fail(409, `Your second cleaning needs to be at least ${SECOND_VISIT_MIN_DAYS} days after the first.`);
      secondSlot = daySlots(date2, { ...secondService, active: true }, planSchedule(schedule), await busyOn(db, DateTime.fromISO(date2, { zone: ZONE }), session)).find(s => new Date(s.startsAt).getTime() === new Date(data.secondStartsAt).getTime());
      if (!secondSlot) fail(409, 'That second-cleaning time is no longer available. Please choose another time.');
    }
    if (data.expectedPriceCents !== service.priceCents + (secondService?.priceCents || 0)) fail(409, 'The service price has changed. Refresh and review the new price.');
    const now = new Date();
    let customer = await db.collection('customers').findOne(data.email ? { email: data.email } : { phone: data.phone }, { session });
    // Staff adding an email for someone we only knew by phone updates that customer. Public forms can't.
    const phoneOnly = !customer && actor && data.email && data.phone ? await db.collection('customers').findOne({ phone: data.phone, email: { $exists: false } }, { session }) : null;
    if (phoneOnly) customer = { ...phoneOnly, email: data.email };
    if (!customer) {
      customer = { _id: randomUUID(), name: data.name, ...(data.email ? { email: data.email } : {}), phone: data.phone, address: data.address, city: data.city, zip: data.zip, status: 'active', notes: '', createdAt: now, updatedAt: now };
      await db.collection('customers').insertOne(customer, { session });
    }
    // Bookings with notes wait for Dwight to read them and confirm; others confirm instantly.
    // Staff adding a booking wrote any note themselves, so there's nothing to review.
    const status = data.notes && !actor ? 'pending' : 'confirmed';
    const origin = now => actor ? { addedBy: actor, confirmedBy: actor, confirmedAt: now } : { consentAt: now };
    // Public forms never overwrite an existing CRM contact's private notes or identity.
    const { requestId, expectedPriceCents, consent, website, addOnIds, secondStartsAt, ...details } = data;
    const plan = secondService ? { planId: requestId } : {};
    const booking = { _id: requestId, ...details, customerId: customer._id, service: { name: service.name, priceCents: service.priceCents, durationMinutes: service.durationMinutes, ...(isHourly(service) ? { hourlyRateCents: service.hourlyRateCents } : {}), ...(service.addOns ? { addOns: service.addOns } : {}) }, startsAt: new Date(slot.startsAt), endsAt: new Date(slot.endsAt), occupiedUntil: new Date(slot.occupiedUntil), status, fingerprint, rescheduleTokenHash: hash(tokens[0]), rescheduleVersion: 0, ...origin(now), createdAt: now, updatedAt: now, ...plan, ...(secondService ? { visit: 1 } : {}) };
    const second = secondService && { _id: `${requestId}-2`, ...details, customerId: customer._id, service: { name: secondService.name, priceCents: secondService.priceCents, durationMinutes: secondService.durationMinutes, discountCents: secondService.discountCents }, startsAt: new Date(secondSlot.startsAt), endsAt: new Date(secondSlot.endsAt), occupiedUntil: new Date(secondSlot.occupiedUntil), status, rescheduleTokenHash: hash(tokens[1]), rescheduleVersion: 0, ...origin(now), createdAt: now, updatedAt: now, ...plan, visit: 2 };
    await db.collection('bookings').insertMany(second ? [booking, second] : [booking], { session });
    // Fill missing CRM address fields from a booking, but preserve addresses an
    // admin already entered (a repeat customer may book another property).
    const missingAddress = Object.fromEntries(['address', 'city', 'zip'].filter(key => !customer[key]).map(key => [key, data[key]]));
    await db.collection('customers').updateOne({ _id: customer._id }, { $set: { lastBookingAt: now, ...missingAddress, ...(phoneOnly ? { email: data.email } : {}) } }, { session });
    const staff = await getStaff(db, session);
    if (status === 'confirmed' && deliveryFor(booking) === 'email') await queueEmail(db, bookingEmail(booking, 'confirmation', false, { staff, rescheduleToken: tokens[0], second: second && { booking: second, rescheduleToken: tokens[1] } }), { session, id: `${requestId}-confirmation-customer` });
    await queueEmail(db, bookingEmail(booking, 'confirmation', true, { staff, second: second && { booking: second } }), { session, id: `${requestId}-confirmation-admin` });
    if (actor) await audit(db, session, actor, 'booking.added', requestId);
    return receipt(booking, second);
  });
}
// Dwight confirms a booking that had notes (and its second cleaning, for a plan). Email
// customers get their confirmation; phone customers get a text Dwight sends himself.
export async function confirmBooking(id, actor) {
  return transaction(async (db, session) => {
    const booking = await db.collection('bookings').findOne({ _id: id }, { session });
    if (!booking) fail(404, 'Booking not found.');
    const group = booking.planId ? await db.collection('bookings').find({ planId: booking.planId }, { session }).sort({ visit: 1 }).toArray() : [booking];
    const [lead, second] = group;
    if (lead.status === 'confirmed') return { bookingId: lead._id, delivery: deliveryFor(lead), alreadyConfirmed: true };
    if (lead.status !== 'pending') fail(409, 'Only bookings waiting for confirmation can be confirmed.');
    const now = new Date();
    await db.collection('bookings').updateMany({ _id: { $in: group.map(b => b._id) }, status: 'pending' }, { $set: { status: 'confirmed', confirmedAt: now, confirmedBy: actor, updatedAt: now } }, { session });
    if (deliveryFor(lead) === 'email') {
      const links = await addChangeTokens(db, group, session);
      await queueEmail(db, bookingEmail({ ...lead, status: 'confirmed' }, 'confirmation', false, { staff: await getStaff(db, session), rescheduleToken: links[0], second: second && { booking: second, rescheduleToken: links[1] } }), { session, id: `${lead._id}-confirmation-customer` });
    }
    await audit(db, session, actor, 'booking.confirmed', lead._id);
    return { bookingId: lead._id, delivery: deliveryFor(lead) };
  });
}
// Extra change-appointment links for emails and texts sent after booking. The original link
// keeps working; only the last few extra links are kept.
export async function addChangeTokens(db, bookings, session) {
  const tokens = bookings.map(() => randomBytes(32).toString('hex'));
  for (const [i, b] of bookings.entries()) await db.collection('bookings').updateOne({ _id: b._id }, { $push: { altTokenHashes: { $each: [hash(tokens[i])], $slice: -5 } } }, { session });
  return tokens;
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
  const hours = invoiceInput.hours;
  if (status === 'completed' && hours !== undefined && !(Number.isFinite(hours) && hours > 0 && hours <= 24 && Number.isInteger(hours * 4))) fail(400, 'Enter repair hours in quarter-hour steps, up to 24.');
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
    if (booking.status === status) return { invoice: booking.invoice || null, delivery: deliveryFor(booking) };
    if (status === 'completed' && booking.status === 'pending') fail(409, 'Confirm this booking before completing it.');
    if (!['confirmed', 'pending'].includes(booking.status)) fail(409, 'This booking is already closed.');
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
      // Hours are recorded on the invoice for hourly work such as gutter repair.
      const [hourlyPart] = hourlyParts(booking.service);
      invoice = { number, totalCents: invoiceInput.totalCents, issuedAt: now, phone: staffPhone(staff), payments, issuedBy: actor, ...(hourlyPart && hours !== undefined ? { hourly: { name: hourlyPart.name, hours, hourlyRateCents: hourlyPart.hourlyRateCents } } : {}) };
      if (deliveryFor(booking) === 'email') await queueEmail(db, invoiceEmail({ ...booking, invoice }), { session, id: `${id}-invoice-customer`, kind: 'invoice' });
    }
    await db.collection('bookings').updateOne({ _id: id }, { $set: { status, updatedAt: now, ...(invoice ? { invoice, completedAt: now } : {}) } }, { session });
    if (status === 'cancelled') {
      await queueEmail(db, bookingEmail(booking, 'cancellation', false, { staff }), { session, id: `${id}-cancellation-customer` });
      await queueEmail(db, bookingEmail(booking, 'cancellation', true, { staff }), { session, id: `${id}-cancellation-admin` });
    }
    await audit(db, session, actor, `booking.${status}`, id);
    return { invoice: invoice || null, delivery: deliveryFor(booking) };
  });
}
export async function saveCustomer(id, input, actor) {
  const data = customerSchema.parse(input);
  return transaction(async (db, session) => {
    const { email, ...fields } = data;
    const result = await db.collection('customers').updateOne({ _id: id }, { $set: { ...fields, ...(email ? { email } : {}), updatedAt: new Date() }, ...(email ? {} : { $unset: { email: '' } }), $setOnInsert: { createdAt: new Date() } }, { upsert: !id || input.create === true, session });
    if (!result.matchedCount && !result.upsertedCount) fail(404, 'Customer not found.');
    await audit(db, session, actor, 'customer.saved', id);
  });
}
async function audit(db, session, actor, action, target) {
  await db.collection('audit').insertOne({ actor, action, target, at: new Date() }, { session });
}
// Records how a completed job was paid. The first record wins; a null method clears it so
// Dwight can correct a mistake.
export async function recordPayment(id, method, actor, details = {}) {
  if (method !== null && !paymentReceivedMethods.includes(method)) fail(400, 'Choose how the payment was received.');
  return transaction(async (db, session) => {
    const booking = await db.collection('bookings').findOne({ _id: id }, { session });
    if (!booking) fail(404, 'Booking not found.');
    if (booking.status !== 'completed' || !booking.invoice) fail(409, 'Only completed bookings with an invoice can be marked paid.');
    if(actor==='stripe' && (details.currency!=='usd' || !Number.isInteger(details.amountCents) || details.amountCents!==booking.invoice.totalCents)) fail(409,'Stripe payment does not match this invoice. Review it in Stripe before recording payment.');
    if (method === null) {
      await db.collection('bookings').updateOne({ _id: id }, { $unset: { payment: '' }, $set: { updatedAt: new Date() } }, { session });
      await audit(db, session, actor, 'booking.payment.cleared', id);
      return { payment: null };
    }
    if (booking.payment) return { payment: booking.payment };
    const payment = { method, amountCents: details.amountCents ?? booking.invoice.totalCents, paidAt: new Date(), recordedBy: actor, ...(details.reference ? { reference: details.reference } : {}) };
    const askReview = !booking.reviewRequestedAt;
    await db.collection('bookings').updateOne({ _id: id }, { $set: { payment, updatedAt: new Date(), ...(askReview ? { reviewRequestedAt: new Date() } : {}) } }, { session });
    if (askReview) await queueEmail(db, reviewEmail(booking), { session, id: `${id}-review-request`, kind: 'review' });
    await audit(db, session, actor, 'booking.paid', id);
    return { payment };
  });
}
// A paid checkout from an invoice's Stripe link marks that booking paid. Events for
// unknown or open bookings are acknowledged and ignored so Stripe doesn't retry them.
export async function handleStripeEvent(event) {
  if (!['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event?.type)) return { received: true };
  const checkout = event.data?.object || {};
  const bookingId = checkout.metadata?.booking_id;
  if (checkout.payment_status !== 'paid' || typeof bookingId!=='string' || !bookingId || bookingId.length>160 || typeof checkout.id!=='string') return { received: true };
  try { return { received: true, ...(await recordPayment(bookingId, 'Stripe', 'stripe', { amountCents: checkout.amount_total, reference: checkout.id, currency:checkout.currency })) }; }
  catch (error) { if ([404, 409].includes(error.status)) return { received: true }; throw error; }
}

// Deleting a booking releases its reserved time without sending cancellation mail.
export async function deleteBooking(id, actor) {
  return transaction(async (db, session) => {
    await scheduleLock(db, session);
    const booking=await db.collection('bookings').findOne({_id:id},{session});
    if(!booking) fail(404,'Booking not found.');
    const group=booking.planId ? await db.collection('bookings').find({planId:booking.planId},{session}).toArray() : [booking];
    if(group.some(b=>b.invoice||b.payment)) fail(409,'Bookings with invoices or payments must be retained for your financial records.');
    const ids=group.map(b=>b._id);
    const prefix=ids.map(id=>id.replace(/[^a-zA-Z0-9_-]/g, ch => String.fromCharCode(92)+ch));
    const replyIds=await db.collection('replies').find({targetType:'booking',targetId:{$in:ids}},{session,projection:{outboxId:1}}).toArray();
    const mailFilter={$or:[{_id:{$regex:`^(?:${prefix.join('|')})-`}},{_id:{$in:replyIds.map(r=>r.outboxId)}}]};
    if(await db.collection('outbox').findOne({...mailFilter,status:'sending'},{session})) fail(409,'An email for this booking is being sent. Try deleting again shortly.');
    await db.collection('outbox').updateMany({...mailFilter,status:'pending'},{$set:{status:'failed',lastError:'Stopped because the booking was deleted.'},$unset:{html:'',text:''}},{session});
    await db.collection('bookings').deleteMany({_id:{$in:ids}},{session});
    await db.collection('jobPhotos').deleteMany({bookingId:{$in:ids}},{session});
    await db.collection('replies').deleteMany({targetType:'booking',targetId:{$in:ids}},{session});
    for(const target of ids) await audit(db,session,actor,'booking.deleted',target);
    return {deleted:ids};
  });
}
export async function deleteCustomer(id, actor) {
  return transaction(async (db,session)=>{
    // Serialize against new bookings before checking for attached history.
    await scheduleLock(db,session);
    if(await db.collection('bookings').findOne({customerId:id},{session})) fail(409,'Delete this customer’s bookings first. Customers with booking history cannot be deleted.');
    const result=await db.collection('customers').deleteOne({_id:id},{session});
    if(!result.deletedCount) fail(404,'Customer not found.');
    await audit(db,session,actor,'customer.deleted',id);
    return {ok:true};
  });
}
