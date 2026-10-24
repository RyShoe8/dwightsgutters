import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { database } from './db.mjs';
import { localTime, money } from './schedule.mjs';
export const escapeHtml = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
export function appUrl() {
  const url = new URL(process.env.APP_URL || 'http://127.0.0.1:3000');
  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') throw new Error('APP_URL must use HTTPS in production.');
  return url.origin;
}
export function emailReady() { return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM) || (process.env.NODE_ENV !== 'production' && process.env.EMAIL_TRANSPORT === 'file'); }
function frame(title, content) {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="utf-8"></head><body style="margin:0;background:#eaf5fa;font-family:Arial,sans-serif;color:#142d4e"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="padding:32px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:auto;background:white;border-radius:12px;overflow:hidden"><tr><td style="padding:32px;border-bottom:4px solid #168ccd"><img src="${appUrl()}/assets/logo.png" alt="Dwight's Gutters" width="240" style="max-width:100%;height:auto"></td></tr><tr><td style="padding:32px"><p style="color:#168ccd;font-size:11px;letter-spacing:2px;font-weight:bold">AUSTIN & SURROUNDING CITIES</p><h1 style="font-size:28px;line-height:1.2">${escapeHtml(title)}</h1>${content}</td></tr><tr><td style="padding:24px 32px;background:#142d4e;color:#fff;font-size:13px;line-height:1.8">Clean gutters. One less thing on your list.<br><a href="mailto:dwight@dwightsgutters.com" style="color:#fff">dwight@dwightsgutters.com</a><br>Dwight’s Gutters · Austin, Texas</td></tr></table></td></tr></table></body></html>`;
}
export function bookingEmail(booking, kind = 'confirmation', admin = false) {
  const cancelled = kind === 'cancellation';
  const title = cancelled ? 'Your booking has been cancelled.' : 'You’re on the calendar.';
  const rows = [['Booking reference', booking._id], ['Service', booking.service.name], ['When', localTime(booking.startsAt)], ['Location', `${booking.address}, ${booking.city}, TX ${booking.zip}`], ['Starting price', money(booking.service.priceCents)]];
  const text = `${admin ? 'Admin notification\n' : ''}${title}\nHi ${booking.name},\n${rows.map(([k, v]) => `${k}: ${v}`).join('\n')}\n${cancelled ? 'This appointment is no longer reserved.' : 'Your appointment is reserved. Dwight will review your property details and confirm the final scope and price before work begins. No payment has been collected.'}\nQuestions or changes? Reply to dwight@dwightsgutters.com.`;
  const html = frame(admin ? (cancelled ? 'Booking cancelled' : 'New booking received') : title, `<p style="line-height:1.7">Hi ${admin ? 'Dwight' : escapeHtml(booking.name)},</p><p style="line-height:1.7">${cancelled ? 'This appointment is no longer reserved.' : 'The appointment is reserved. Final scope and price will be confirmed before work begins. No payment has been collected.'}</p><table role="presentation" width="100%" cellspacing="0" cellpadding="12" style="background:#f5f8fa;font-size:14px">${rows.map(([k, v]) => `<tr><td style="border-bottom:1px solid #dce5eb;color:#617181">${k}</td><td style="border-bottom:1px solid #dce5eb;font-weight:bold">${escapeHtml(v)}</td></tr>`).join('')}</table>${admin ? `<p>Customer: ${escapeHtml(booking.name)} · ${escapeHtml(booking.email)}<br>Phone: ${escapeHtml(booking.phone || 'Not provided')}</p><a href="${appUrl()}/admin/" style="color:#168ccd">Open admin</a>` : '<p style="line-height:1.7">Need to make a change? Reply to this email and Dwight will help.</p>'}`);
  return { to: admin ? 'dwight@dwightsgutters.com' : booking.email, subject: `${cancelled ? 'Booking cancelled' : 'Booking confirmed'} — Dwight’s Gutters`, text, html };
}
export function loginEmail(email, token) {
  const url = `${appUrl()}/admin/sign-in/#token=${token}`;
  return { to: email, subject: 'Your Dwight’s Gutters admin sign-in link', text: `Sign in to Dwight's Gutters: ${url}\nThis single-use link expires in 15 minutes. If you did not request it, ignore this email.`, html: frame('Welcome back.', `<p style="line-height:1.7">Use this single-use link to access your admin. It expires in 15 minutes.</p><p style="padding:20px 0"><a href="${url}" style="display:inline-block;background:#168ccd;color:white;padding:16px 24px;border-radius:5px;text-decoration:none;font-weight:bold">Sign in to admin →</a></p><p style="font-size:13px;color:#617181">If you didn’t request this email, you can ignore it.</p>`) };
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
