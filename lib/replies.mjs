import { z } from 'zod';
import { database, transaction } from './db.mjs';
import { emailSchema, fail } from './validation.mjs';
import { appUrl, escapeHtml, frame, queueEmail } from './email.mjs';
import { hash } from './auth.mjs';
import { getStaff, staffPhone } from './staff.mjs';
const targetSchema = z.object({ type: z.enum(['booking', 'inquiry']), id: z.string().min(1).max(160) });
const replySchema = targetSchema.extend({ requestId: z.string().uuid(), text: z.string().trim().min(1).max(4000) });
async function target(db, data, session) {
  const record = await db.collection(data.type === 'booking' ? 'bookings' : 'inquiries').findOne({ _id: data.id }, { session });
  if (!record) fail(404, 'This booking or inquiry was not found.');
  return record;
}
export async function listReplies(input) {
  const data = targetSchema.parse(input);
  const { db } = await database();
  const record = await target(db, data);
  const items = await db.collection('replies').aggregate([
    { $match: { targetType: data.type, targetId: data.id } }, { $sort: { createdAt: -1 } }, { $limit: 50 },
    { $lookup: { from: 'outbox', localField: 'outboxId', foreignField: '_id', as: 'delivery' } },
    { $set: { status: { $ifNull: [{ $arrayElemAt: ['$delivery.status', 0] }, 'queued'] } } },
    { $project: { delivery: 0, fingerprint: 0 } },
  ]).toArray();
  return { to: record.email, items };
}
export async function queueReply(input, actor) {
  const data = replySchema.parse(input);
  const fingerprint = hash(JSON.stringify({ type: data.type, id: data.id, text: data.text }));
  return transaction(async (db, session) => {
    const existing = await db.collection('replies').findOne({ _id: data.requestId }, { session });
    if (existing) {
      if (existing.fingerprint !== fingerprint) fail(409, 'This reply was already submitted with different text. Reopen the composer to send another reply.');
      return { outboxId: existing.outboxId };
    }
    const record = await target(db, data, session);
    const to = emailSchema.parse(record.email);
    const staff = await getStaff(db, session);
    const subject = `Re: ${data.type === 'booking' ? record.service?.name || 'Your booking' : 'Your inquiry'} — Dwight’s Gutters`.replace(/[\r\n]/g, ' ').slice(0, 200);
    const outboxId = `reply-${data.requestId}`;
    const text = `Hi ${record.name},\n\n${data.text}\n\n${staff.name} · Dwight’s Gutters\nPhone: ${staffPhone(staff)}\nContact: ${appUrl()}/contact/`;
    const html = frame('A message from Dwight’s Gutters', `<p>Hi ${escapeHtml(record.name)},</p><div style="line-height:1.8">${escapeHtml(data.text).replace(/\n/g, '<br>')}</div><p>${escapeHtml(staff.name)} · Dwight’s Gutters<br>Phone: ${escapeHtml(staffPhone(staff))}<br><a href="${appUrl()}/contact/">Contact Dwight →</a></p>`);
    await queueEmail(db, { to, subject, text, html }, { session, id: outboxId, kind: 'reply' });
    await db.collection('replies').insertOne({ _id: data.requestId, targetType: data.type, targetId: data.id, to, text: data.text, subject, actor, createdAt: new Date(), outboxId, fingerprint }, { session });
    return { outboxId };
  });
}
