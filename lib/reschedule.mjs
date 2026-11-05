import { DateTime } from 'luxon';
import { z } from 'zod';
import { hash } from './auth.mjs';
import { database, transaction } from './db.mjs';
import { scheduleLock, planHorizonDays } from './bookings.mjs';
import { daySlots, openDates, localTime, ZONE } from './schedule.mjs';
import { fail } from './validation.mjs';
import { bookingEmail, queueEmail } from './email.mjs';
import { getStaff } from './staff.mjs';
const tokenSchema = z.string().regex(/^[a-f0-9]{64}$/);
const changeSchema = z.object({ token: tokenSchema, startsAt: z.string().datetime(), expectedStartsAt: z.string().datetime() });
export function assertChangeAllowed(booking, now = new Date()) {
  if (!booking || booking.status !== 'confirmed') fail(404, 'This appointment link is invalid or the booking is closed.');
  if (new Date(booking.startsAt).getTime() - now.getTime() < 48 * 3600000) fail(409, 'Online changes close 48 hours before your appointment. Please use the contact form to ask Dwight for help.');
}
async function findBooking(db, token, session) {
  tokenSchema.parse(token);
  const tokenHash = hash(token);
  return db.collection('bookings').findOne({ $or: [{ rescheduleTokenHash: tokenHash }, { altTokenHashes: tokenHash }] }, { session });
}
async function slotsFor(db, booking, date, schedule, session) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) fail(400, 'Choose a valid date.');
  const day = DateTime.fromISO(date, { zone: ZONE });
  if (!day.isValid || day.toISODate() !== date) fail(400, 'Choose a valid date.');
  const busy = await db.collection('bookings').find({ _id: { $ne: booking._id }, status: { $ne: 'cancelled' }, startsAt: { $lt: day.plus({ days: 1 }).toJSDate() }, occupiedUntil: { $gt: day.toJSDate() } }, { session }).toArray();
  return daySlots(date, { ...booking.service, active: true }, changeSchedule(schedule, booking), busy);
}
const changeSchedule = (schedule, booking) => ({ ...schedule, leadHours: Math.max(48, schedule.leadHours), ...(booking?.visit === 2 ? { horizonDays: Math.max(schedule.horizonDays, planHorizonDays()) } : {}) });
async function datesFor(db, booking, schedule) {
  const today = DateTime.now().setZone(ZONE).startOf('day');
  const rules = changeSchedule(schedule, booking);
  const busy = await db.collection('bookings').find({ _id: { $ne: booking._id }, status: { $ne: 'cancelled' }, startsAt: { $lt: today.plus({ days: rules.horizonDays + 1 }).toJSDate() }, occupiedUntil: { $gt: today.toJSDate() } }).toArray();
  return openDates({ ...booking.service, active: true }, rules, busy);
}
export async function getChangeDetails(token, date) {
  const { db } = await database();
  const booking = await findBooking(db, token);
  assertChangeAllowed(booking);
  const schedule = await db.collection('settings').findOne({ _id: 'schedule' });
  const today = DateTime.now().setZone(ZONE);
  return { service: booking.service.name, priceCents: booking.service.priceCents, startsAt: booking.startsAt, when: localTime(booking.startsAt), needsConfirmation: booking.visit === 2 && !booking.customerConfirmedAt, minDate: today.plus({ hours: 48 }).toISODate(), maxDate: today.plus({ days: schedule.horizonDays }).toISODate(), ...(date ? { slots: await slotsFor(db, booking, date, schedule) } : { dates: await datesFor(db, booking, schedule) }) };
}
export async function changeAppointment(input) {
  const data = changeSchema.parse(input);
  return transaction(async (db, session) => {
    const schedule = await scheduleLock(db, session);
    const booking = await findBooking(db, data.token, session);
    assertChangeAllowed(booking);
    // A retry after a successful change returns the same result without extra mail.
    if (booking.startsAt.getTime() === new Date(data.startsAt).getTime()) return { when: localTime(booking.startsAt), ids: [] };
    if (booking.startsAt.getTime() !== new Date(data.expectedStartsAt).getTime()) fail(409, 'This appointment has changed. Reopen your link to load its latest time.');
    const date = DateTime.fromISO(data.startsAt, { zone: ZONE }).toISODate();
    const slot = (await slotsFor(db, booking, date, schedule, session)).find(s => new Date(s.startsAt).getTime() === new Date(data.startsAt).getTime());
    if (!slot) fail(409, 'That time is no longer available. Choose another time.');
    const version = (booking.rescheduleVersion || 0) + 1;
    const changed = { ...booking, startsAt: new Date(slot.startsAt), endsAt: new Date(slot.endsAt), occupiedUntil: new Date(slot.occupiedUntil), rescheduleVersion: version, updatedAt: new Date() };
    await db.collection('bookings').updateOne({ _id: booking._id }, { $set: { startsAt: changed.startsAt, endsAt: changed.endsAt, occupiedUntil: changed.occupiedUntil, rescheduleVersion: version, updatedAt: changed.updatedAt, ...(booking.visit === 2 ? { customerConfirmedAt: changed.updatedAt } : {}) } }, { session });
    const staff = await getStaff(db, session);
    const ids = [`${booking._id}-rescheduled-${version}-customer`, `${booking._id}-rescheduled-${version}-admin`];
    await queueEmail(db, bookingEmail(changed, 'rescheduled', false, { staff, rescheduleToken: data.token }), { session, id: ids[0] });
    await queueEmail(db, bookingEmail(changed, 'rescheduled', true, { staff }), { session, id: ids[1] });
    await db.collection('audit').insertOne({ actor: 'customer-link', action: 'booking.rescheduled', target: booking._id, previousStartsAt: booking.startsAt, startsAt: changed.startsAt, at: new Date() }, { session });
    return { when: localTime(changed.startsAt), ids };
  });
}
// The customer confirms a seasonal plan's second cleaning from the reminder email.
export async function confirmVisit(input) {
  const { token } = z.object({ token: tokenSchema }).parse(input);
  return transaction(async (db, session) => {
    const booking = await findBooking(db, token, session);
    if (!booking || booking.status !== 'confirmed' || booking.startsAt <= new Date()) fail(404, 'This appointment link is invalid or the booking is closed.');
    if (booking.customerConfirmedAt) return { when: localTime(booking.startsAt), ids: [] };
    const now = new Date();
    await db.collection('bookings').updateOne({ _id: booking._id }, { $set: { customerConfirmedAt: now, updatedAt: now } }, { session });
    const id = `${booking._id}-customer-confirmed-admin`;
    await queueEmail(db, { to: 'dwight@dwightsgutters.com', subject: `Second cleaning confirmed — ${booking.name}`, text: `${booking.name} confirmed their second cleaning on ${localTime(booking.startsAt)} at ${booking.address}, ${booking.city}.`, html: `<p>${booking.name.replace(/[<&>]/g, '')} confirmed their second cleaning on <strong>${localTime(booking.startsAt)}</strong> at ${booking.address.replace(/[<&>]/g, '')}, ${booking.city.replace(/[<&>]/g, '')}.</p>` }, { session, id });
    await db.collection('audit').insertOne({ actor: 'customer-link', action: 'booking.customer-confirmed', target: booking._id, at: now }, { session });
    return { when: localTime(booking.startsAt), ids: [id] };
  });
}
