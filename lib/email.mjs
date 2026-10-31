import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { database } from './db.mjs';
import { staffPhone } from './staff.mjs';
import { businessPhone, businessPhoneHref } from './business.mjs';
import { localTime, money } from './schedule.mjs';
export const escapeHtml = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
export function appUrl() {
  const configured = process.env.APP_URL?.trim();
  let url;
  try {
    url = new URL(configured || (process.env.NODE_ENV === 'production' ? '' : 'http://127.0.0.1:3000'));
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error();
    if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') throw new Error();
  } catch {
    throw Object.assign(new Error('APP_URL must be the full website origin (https://dwightsgutters.com in production), without a path, query, or credentials.'), { status: 503 });
  }
  return url.origin;
}
export function emailReady() { return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM) || (process.env.NODE_ENV !== 'production' && process.env.EMAIL_TRANSPORT === 'file'); }
export function frame(title, content) {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="utf-8"></head><body style="margin:0;background:#fff2e8;font-family:Arial,sans-serif;color:#142d4e"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="padding:32px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:auto;background:white;border-radius:12px;overflow:hidden"><tr><td style="padding:32px;border-bottom:4px solid #f47721"><img src="${appUrl()}/assets/logo.png" alt="Dwight's Gutters" width="240" style="max-width:100%;height:auto"></td></tr><tr><td style="padding:32px"><p style="color:#a6420b;font-size:11px;letter-spacing:2px;font-weight:bold">AUSTIN & SURROUNDING CITIES</p><h1 style="font-size:28px;line-height:1.2">${escapeHtml(title)}</h1>${content}</td></tr><tr><td style="padding:24px 32px;background:#142d4e;color:#fff;font-size:13px;line-height:1.8">Clean gutters. One less thing on your list.<br><a href="mailto:dwight@dwightsgutters.com" style="color:#fff">dwight@dwightsgutters.com</a> · <a href="${businessPhoneHref}" style="color:#fff">${businessPhone}</a><br>Dwight’s Gutters · Austin, Texas</td></tr></table></td></tr></table></body></html>`;
}
export function bookingEmail(booking, kind = 'confirmation', admin = false, options = {}) {
  const cancelled = kind === 'cancellation', changed = kind === 'rescheduled';
  const title = cancelled ? 'Your booking has been cancelled.' : changed ? 'Your appointment time has changed.' : 'You’re on the calendar.';
  const rows = [['Booking reference', booking._id], ['Service ordered', booking.service.name], ['Appointment', localTime(booking.startsAt)], ['Location', `${booking.address}, ${booking.city}, TX ${booking.zip}`], ['Starting price', money(booking.service.priceCents)]];
  const contactUrl = `${appUrl()}/contact/`;
  const phone = staffPhone(options.staff);
  const rescheduleUrl = options.rescheduleToken ? `${appUrl()}/book/change/#token=${options.rescheduleToken}` : null;
  const changeText = !cancelled && rescheduleUrl ? `Change your appointment: ${rescheduleUrl}\nOnline changes are available only at least 48 hours before your current appointment, and the new appointment must also be at least 48 hours away.` : '';
  const intro = cancelled ? 'This appointment is no longer reserved.' : 'Your appointment is reserved. The price shown is a starting price; Dwight will confirm the final scope and total before work. No payment has been collected.';
  const text = `${admin ? 'Admin notification\n' : ''}${title}\nHi ${admin ? 'Dwight' : booking.name},\n${rows.map(([k, v]) => k + ': ' + v).join('\n')}\n${intro}\n${changeText}\nContact Dwight: ${contactUrl}\nPhone: ${phone}`;
  const html = frame(admin ? (cancelled ? 'Booking cancelled' : changed ? 'Appointment rescheduled' : 'New booking received') : title,
    `<p>Hi ${admin ? 'Dwight' : escapeHtml(booking.name)},</p><p style="line-height:1.7">${intro}</p><table role="presentation" width="100%" cellspacing="0" cellpadding="12" style="background:#f5f8fa;font-size:14px">${rows.map(([k, v]) => '<tr><td style="border-bottom:1px solid #dce5eb;color:#617181">' + k + '</td><td style="border-bottom:1px solid #dce5eb;font-weight:bold">' + escapeHtml(v) + '</td></tr>').join('')}</table>${admin ? '<p>Customer: ' + escapeHtml(booking.name) + ' · ' + escapeHtml(booking.email) + '<br>Phone: ' + escapeHtml(booking.phone || 'Not provided') + '</p><a href="' + appUrl() + '/admin/">Open admin</a>' : (!cancelled && rescheduleUrl ? '<p><a href="' + rescheduleUrl + '" style="display:inline-block;background:#f47721;color:#142d4e;padding:14px 20px;border-radius:5px;font-weight:bold">Change appointment time →</a></p><p style="font-size:13px">Online changes close 48 hours before your appointment. Choose a new time at least 48 hours away. For changes inside that window, contact Dwight.</p>' : '')}<p><a href="${contactUrl}">Contact Dwight →</a><br>Phone: ${escapeHtml(phone)}</p>`);
  return { to: admin ? 'dwight@dwightsgutters.com' : booking.email, subject: `${cancelled ? 'Booking cancelled' : changed ? 'Appointment rescheduled' : 'Booking confirmed'} — Dwight’s Gutters`, text, html };
}
export function invoiceEmail(booking) {
  const invoice = booking.invoice;
  const contactUrl = `${appUrl()}/contact/`;
  const rows = [['Invoice number', invoice.number], ['Service completed', booking.service.name], ['Appointment', localTime(booking.startsAt)], ['Property', `${booking.address}, ${booking.city}, TX ${booking.zip}`], ['Final total', money(invoice.totalCents)]];
  const paymentText = invoice.payments.map(p => `${p.type}: ${p.instructions}${p.url ? ' — ' + p.url : ''}`).join('\n');
  const text = `Your job is complete. Thank you, ${booking.name}!\n${rows.map(([k,v]) => k + ': ' + v).join('\n')}\nPayment options:\n${paymentText}\nThis invoice is not a payment receipt. Please arrange payment using one of the options above.\nContact: ${contactUrl}\nPhone: ${invoice.phone}`;
  const html = frame('All done. Thank you!', `<p>Hi ${escapeHtml(booking.name)},</p><p>Your cleaning is complete. Here’s your invoice.</p><table role="presentation" width="100%" cellspacing="0" cellpadding="12" style="background:#f5f8fa">${rows.map(([k,v]) => '<tr><td>' + k + '</td><td><strong>' + escapeHtml(v) + '</strong></td></tr>').join('')}</table><h2 style="font-size:20px">Payment options</h2>${invoice.payments.map(p => '<p><strong>' + escapeHtml(p.type) + '</strong><br>' + escapeHtml(p.instructions).replace(/\n/g, '<br>') + (p.url ? '<br><a href="' + escapeHtml(p.url) + '">Pay with ' + escapeHtml(p.type) + ' →</a>' : '') + '</p>').join('')}<p style="font-size:13px">This invoice is not a payment receipt. Please arrange payment using one of the options above.</p><p><a href="${contactUrl}">Contact Dwight →</a><br>Phone: ${escapeHtml(invoice.phone)}</p>`);
  return {to:booking.email,subject: `Invoice ${invoice.number} — Dwight’s Gutters`,text,html};
}
export function loginEmail(email, token, code) {
  const url = `${appUrl()}/admin/sign-in/#token=${token}`;
  return { to: email, subject: 'Your Dwight’s Gutters admin sign-in link and code', text: `Sign in to Dwight's Gutters: ${url}\nOr enter this code on the sign-in page: ${code}\nThe link and code expire in 15 minutes. Only the latest sign-in email works; using either option invalidates both. If you did not request it, ignore this email.`, html: frame('Welcome back.', `<p style="line-height:1.7">Use the secure link below, or enter this code with your email on the sign-in page. Both expire in 15 minutes. Only your latest sign-in email works.</p><p style="padding:20px 0"><a href="${url}" style="display:inline-block;background:#f47721;color:#142d4e;padding:16px 24px;border-radius:5px;text-decoration:none;font-weight:bold">Sign in to admin →</a></p><p style="font-size:32px;font-weight:bold;letter-spacing:5px">${code}</p><p>Using the link or code signs you in once and invalidates both.</p><p style="font-size:13px;color:#617181">If you didn’t request this email, you can ignore it.</p>`) };
}
export async function queueEmail(db, message, options = {}) {
  const { session, id = randomUUID(), kind = 'booking' } = options;
  await db.collection('outbox').insertOne({ _id: id, ...message, kind, status: 'pending', attempts: 0, createdAt: new Date(), nextAttemptAt: new Date(), ...(kind === 'login' ? { expiresAt: new Date(Date.now() + 15 * 60000) } : {}) }, { session });
  return id;
}
export async function flushOutbox({ ids, limit = 10 } = {}) {
  const { db } = await database();
  const results = [];
  for (let i = 0; i < limit; i++) {
    const now = new Date();
    const message = await db.collection('outbox').findOneAndUpdate({
      ...(ids ? { _id: { $in: ids } } : {}),
      status: { $in: ['pending', 'sending'] }, nextAttemptAt: { $lte: now },
      $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: now } }],
    }, { $set: { status: 'sending', nextAttemptAt: new Date(Date.now() + 120000) }, $inc: { attempts: 1 } }, { returnDocument: 'after', sort: { createdAt: 1 } });
    if (!message) break;
    try {
      let providerId, status;
      if (process.env.NODE_ENV !== 'production' && process.env.EMAIL_TRANSPORT === 'file') {
        const folder = path.resolve('.local', 'mail');
        await mkdir(folder, { recursive: true });
        await writeFile(path.join(folder, `${message._id}.html`), message.html);
        await writeFile(path.join(folder, `${message._id}.json`), JSON.stringify({ to: message.to, subject: message.subject, text: message.text }, null, 2));
        status = 'captured';
      } else {
        if (!emailReady()) throw new Error('Email provider is not configured');
        // Resend deduplicates for 24 hours. Do not automatically retry ambiguous requests beyond that window.
        if (Date.now() - message.createdAt.getTime() > 23 * 3600000) throw new Error('Manual provider review required before resending an old message');
        const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': message._id }, body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [message.to], reply_to: 'dwight@dwightsgutters.com', subject: message.subject, html: message.html, text: message.text }), signal: AbortSignal.timeout(15000) });
        if (!response.ok) throw new Error(`Email provider returned HTTP ${response.status}`);
        providerId = (await response.json()).id;
        status = 'accepted';
      }
      await db.collection('outbox').updateOne({ _id: message._id }, { $set: { status, providerId: providerId || null, sentAt: new Date() }, $unset: { lastError: '', html: '', text: '' } });
      results.push({ id: message._id, status });
    } catch (error) {
      const status = message.attempts >= 8 || Date.now() - message.createdAt.getTime() > 23 * 3600000 ? 'failed' : 'pending';
      await db.collection('outbox').updateOne({ _id: message._id }, { $set: { status, lastError: error.message, nextAttemptAt: new Date(Date.now() + Math.min(3600000, 60000 * 2 ** message.attempts)) } });
      results.push({ id: message._id, status });
    }
  }
  return results;
}
