import { DateTime } from 'luxon';
import { z } from 'zod';
import { hash } from './auth.mjs';
import { database, transaction } from './db.mjs';
import { scheduleLock } from './bookings.mjs';
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
  return db.collection('bookings').findOne({ rescheduleTokenHash: hash(token) }, { session });
}
async function slotsFor(db, booking, date, schedule, session) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) fail(400, 'Choose a valid date.');
  const day = DateTime.fromISO(date, { zone: ZONE });
  if (!day.isValid || day.toISODate() !== date) fail(400, 'Choose a valid date.');
  const busy = await db.collection('bookings').find({ _id: { $ne: booking._id }, status: { $ne: 'cancelled' }, startsAt: { $lt: day.plus({ days: 1 }).toJSDate() }, occupiedUntil: { $gt: day.toJSDate() } }, { session }).toArray();
  return daySlots(date, { ...booking.service, active: true }, changeSchedule(schedule), busy);
}
const changeSchedule = schedule => ({ ...schedule, leadHours: Math.max(48, schedule.leadHours) });
async function datesFor(db, booking, schedule) {
  const today = DateTime.now().setZone(ZONE).startOf('day');
  const busy = await db.collection('bookings').find({ _id: { $ne: booking._id }, status: { $ne: 'cancelled' }, startsAt: { $lt: today.plus({ days: schedule.horizonDays + 1 }).toJSDate() }, occupiedUntil: { $gt: today.toJSDate() } }).toArray();
  return openDates({ ...booking.service, active: true }, changeSchedule(schedule), busy);
}
export async function getChangeDetails(token, date) {
  const { db } = await database();
  const booking = await findBooking(db, token);
  assertChangeAllowed(booking);
  const schedule = await db.collection('settings').findOne({ _id: 'schedule' });
  const today = DateTime.now().setZone(ZONE);
  return { service: booking.service.name, priceCents: booking.service.priceCents, startsAt: booking.startsAt, when: localTime(booking.startsAt), minDate: today.plus({ hours: 48 }).toISODate(), maxDate: today.plus({ days: schedule.horizonDays }).toISODate(), ...(date ? { slots: await slotsFor(db, booking, date, schedule) } : { dates: await datesFor(db, booking, schedule) }) };
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
    await db.collection('bookings').updateOne({ _id: booking._id }, { $set: { startsAt: changed.startsAt, endsAt: changed.endsAt, occupiedUntil: changed.occupiedUntil, rescheduleVersion: version, updatedAt: changed.updatedAt } }, { session });
    const staff = await getStaff(db, session);
    const ids = [`${booking._id}-rescheduled-${version}-customer`, `${booking._id}-rescheduled-${version}-admin`];
    await queueEmail(db, bookingEmail(changed, 'rescheduled', false, { staff, rescheduleToken: data.token }), { session, id: ids[0] });
    await queueEmail(db, bookingEmail(changed, 'rescheduled', true, { staff }), { session, id: ids[1] });
    await db.collection('audit').insertOne({ actor: 'customer-link', action: 'booking.rescheduled', target: booking._id, previousStartsAt: booking.startsAt, startsAt: changed.startsAt, at: new Date() }, { session });
    return { when: localTime(changed.startsAt), ids };
  });
}
