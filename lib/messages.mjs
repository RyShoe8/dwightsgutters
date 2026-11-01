import { DateTime } from 'luxon';
import { database, transaction } from './db.mjs';
import { fail } from './validation.mjs';
import { appUrl, escapeHtml, frame, queueEmail } from './email.mjs';
import { localTime, money, ZONE } from './schedule.mjs';
import { businessPhone, reviewLinks } from './business.mjs';
import { hoursLabel } from './pricing.mjs';
import { addChangeTokens } from './bookings.mjs';
const firstName = name => String(name).trim().split(/\s+/)[0];
const changeUrl = token => `${appUrl()}/book/change/#token=${token}`;
const button = (url, label, dark = false) => `<p style="margin:22px 0"><a href="${url}" style="display:inline-block;background:${dark ? '#142d4e' : '#f47721'};color:${dark ? '#fff' : '#142d4e'};padding:14px 22px;border-radius:5px;font-weight:bold;text-decoration:none">${label}</a></p>`;
const signoff = `Dwight · Dwight’s Gutters · ${businessPhone}`;

// Text messages Dwight copies into his phone for customers who prefer phone contact.
export function confirmationText(booking, url, second, secondUrl) {
  return [
    `Hi ${firstName(booking.name)}! This is Dwight with Dwight’s Gutters. You’re all set:`,
    `${second ? 'First cleaning' : booking.service.name}: ${localTime(booking.startsAt)}`,
    ...(second ? [`Second cleaning: ${localTime(second.startsAt)} (${money(second.service.priceCents)}${second.service.discountCents ? `, you save ${money(second.service.discountCents)}` : ''})`] : []),
    `Address: ${booking.address}, ${booking.city}`,
    `Starting price: ${money(booking.service.priceCents)}. I’ll confirm the final price before I start, and nothing is due until the job’s done.`,
    `Need a different time? ${url}${secondUrl ? ` (second cleaning: ${secondUrl})` : ''} Online changes work up to 48 hours ahead, or just reply here.`,
    'Thanks!', signoff,
  ].join('\n');
}
export function invoiceText(booking) {
  const { invoice } = booking;
  return [
    `Hi ${firstName(booking.name)}! Thanks for having Dwight’s Gutters out. Here’s your invoice ${invoice.number}:`,
    `${booking.service.name}`,
    `Total: ${money(invoice.totalCents)}${invoice.hourly ? ` (${invoice.hourly.name}: ${hoursLabel(invoice.hourly.hours)} at ${money(invoice.hourly.hourlyRateCents)}/hour)` : ''}`,
    'Ways to pay:',
    ...invoice.payments.map(p => `• ${p.type}: ${p.url || p.instructions}`),
    'Questions? Just reply. Thank you!', signoff,
  ].join('\n');
}
// Builds the confirmation or invoice text for one booking. Confirmation texts get fresh
// change-appointment links (earlier links keep working).
export async function bookingText(id, kind) {
  const { db } = await database();
  const booking = await db.collection('bookings').findOne({ _id: id });
  if (!booking) fail(404, 'Booking not found.');
  if (kind === 'invoice') {
    if (!booking.invoice) fail(409, 'This booking doesn’t have an invoice yet.');
    return invoiceText(booking);
  }
  if (booking.status !== 'confirmed') fail(409, 'Confirm this booking before texting the customer.');
  const group = booking.planId ? await db.collection('bookings').find({ planId: booking.planId, status: 'confirmed' }).sort({ visit: 1 }).toArray() : [booking];
  const tokens = await addChangeTokens(db, group);
  return confirmationText(group[0], changeUrl(tokens[0]), group[1], group[1] && changeUrl(tokens[1]));
}

// Sent once when a completed job is paid. The $25 credit is a thank-you for every paid job,
// never conditional on a review: Google and Yelp prohibit incentivized reviews.
export function reviewEmail(booking) {
  const name = escapeHtml(firstName(booking.name));
  const text = `Hi ${firstName(booking.name)},\nThank you for choosing Dwight’s Gutters! Your payment is received.\nAs a thank-you, take $25 off your next gutter cleaning. Just mention this email when you book, or reply to it.\nIf you have a minute, an honest review helps neighbors find a local, veteran-owned business:\nGoogle: ${reviewLinks.google}\nYelp: ${reviewLinks.yelp}\nThe $25 credit is yours either way.\n${signoff}`;
  const html = frame('Thank you!', `<p>Hi ${name},</p><p style="line-height:1.7">Thank you for choosing Dwight’s Gutters. Your payment is received.</p><p style="background:#fff2e8;padding:16px;border-radius:6px;line-height:1.6"><strong>$25 off your next gutter cleaning.</strong><br>As a thank-you, just mention this email when you book, or reply to it.</p><p style="line-height:1.7">If you have a minute, would you share how it went? An honest review helps neighbors find a local, veteran-owned business. It takes about a minute:</p>${button(reviewLinks.google, 'Review us on Google →')}${button(reviewLinks.yelp, 'Review us on Yelp →', true)}<p style="font-size:13px;color:#617181">The $25 credit is yours either way.</p>`);
  return { to: booking.email, subject: 'Thank you from Dwight’s Gutters — $25 off your next cleaning', text, html };
}
// A month before a seasonal plan's second cleaning: confirm it, or pick a new time.
export function reminderEmail(booking, token) {
  const url = changeUrl(token);
  const text = `Hi ${firstName(booking.name)},\nYour second seasonal gutter cleaning is coming up on ${localTime(booking.startsAt)} at ${booking.address}, ${booking.city}.\nPlease confirm it still works, or choose a new time: ${url}\nPrice: ${money(booking.service.priceCents)}${booking.service.discountCents ? ` (you save ${money(booking.service.discountCents)})` : ''}.\n${signoff}`;
  const html = frame('Your second cleaning is coming up.', `<p>Hi ${escapeHtml(firstName(booking.name))},</p><p style="line-height:1.7">Your second seasonal gutter cleaning is scheduled for <strong>${escapeHtml(localTime(booking.startsAt))}</strong> at ${escapeHtml(`${booking.address}, ${booking.city}`)}.</p><p>Price: <strong>${money(booking.service.priceCents)}</strong>${booking.service.discountCents ? ` (you save ${money(booking.service.discountCents)})` : ''}</p><p style="line-height:1.7">Please confirm this time still works. If it doesn’t, you can pick a new one on the same page.</p>${button(url, 'Confirm or change my cleaning →')}<p style="font-size:13px">Online changes close 48 hours before your appointment. You can also reply to this email.</p>`);
  return { to: booking.email, subject: 'Please confirm your second gutter cleaning', text, html };
}
// About six months after a single cleaning, a friendly nudge to book again.
export function followUpEmail(booking) {
  const url = `${appUrl()}/book/?service=Gutter+cleaning`;
  const text = `Hi ${firstName(booking.name)},\nIt’s been about six months since we cleaned the gutters at ${booking.address}. Central Texas trees don’t take a break, and most homes do well with a cleaning twice a year.\nReady for the next one? Book online: ${url}\nTip: choose Seasonal upkeep to book two cleanings at once and save $50 on the second.\nDon’t want reminders like this? Reply “stop” and we won’t send more.\n${signoff}`;
  const html = frame('Time for another cleaning?', `<p>Hi ${escapeHtml(firstName(booking.name))},</p><p style="line-height:1.7">It’s been about six months since we cleaned the gutters at ${escapeHtml(booking.address)}. Central Texas trees don’t take a break, and most homes do well with a cleaning twice a year.</p>${button(url, 'Book my next cleaning →')}<p style="line-height:1.7"><strong>Tip:</strong> choose Seasonal upkeep to book two cleanings at once and save $50 on the second.</p><p style="font-size:12px;color:#617181">Don’t want reminders like this? Reply “stop” and we won’t send more.</p>`);
  return { to: booking.email, subject: 'Time for another gutter cleaning?', text, html };
}

// Runs from the email cron: queues second-cleaning reminders and six-month follow-ups.
// Each booking is marked inside the same transaction so it's emailed at most once.
export async function runScheduledMessages(now = new Date()) {
  const { db } = await database();
  const queued = [];
  const remindBy = DateTime.fromJSDate(now, { zone: ZONE }).plus({ months: 1 }).toJSDate();
  const reminders = await db.collection('bookings').find({ visit: 2, status: 'confirmed', reminderSentAt: { $exists: false }, customerConfirmedAt: { $exists: false }, startsAt: { $gt: now, $lte: remindBy } }).limit(25).toArray();
  for (const { _id } of reminders) {
    await transaction(async (db, session) => {
      const booking = await db.collection('bookings').findOne({ _id, reminderSentAt: { $exists: false } }, { session });
      if (!booking) return;
      const [token] = await addChangeTokens(db, [booking], session);
      queued.push(await queueEmail(db, reminderEmail(booking, token), { session, id: `${_id}-reminder`, kind: 'reminder' }));
      await db.collection('bookings').updateOne({ _id }, { $set: { reminderSentAt: now } }, { session });
    });
  }
  const cutoff = DateTime.fromJSDate(now, { zone: ZONE }).minus({ months: 6 }).toJSDate();
  const cleanings = await db.collection('bookings').find({ status: 'completed', serviceId: 'gutter-cleaning', planId: { $exists: false }, followUpSentAt: { $exists: false }, startsAt: { $lte: cutoff } }).limit(25).toArray();
  for (const { _id } of cleanings) {
    await transaction(async (db, session) => {
      const booking = await db.collection('bookings').findOne({ _id, followUpSentAt: { $exists: false } }, { session });
      if (!booking) return;
      const rebooked = await db.collection('bookings').findOne({ customerId: booking.customerId, _id: { $ne: _id }, status: { $ne: 'cancelled' }, startsAt: { $gt: booking.startsAt } }, { session });
      const customer = await db.collection('customers').findOne({ _id: booking.customerId }, { session });
      const skip = rebooked ? 'rebooked' : customer?.marketingOptOut ? 'opted-out' : null;
      if (!skip) queued.push(await queueEmail(db, followUpEmail(booking), { session, id: `${_id}-followup`, kind: 'followup' }));
      await db.collection('bookings').updateOne({ _id }, { $set: { followUpSentAt: now, ...(skip ? { followUpSkipped: skip } : {}) } }, { session });
    });
  }
  return queued;
}
