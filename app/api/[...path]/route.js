import { cookies } from 'next/headers';
import { randomUUID } from 'node:crypto';
import { DateTime } from 'luxon';
import { ZodError } from 'zod';
import { database, ensureInitialized } from '../../../lib/db.mjs';
import { assertOrigin, requireAdmin, requestLogin, redeemToken, cookieName, sessionOptions, hash, limit, safeEqual } from '../../../lib/auth.mjs';
import { availableSlots, createBooking, saveService, saveSchedule, saveCoverage, updateBooking, saveCustomer } from '../../../lib/bookings.mjs';
import { enabledCoverage } from '../../../lib/coverage-data.mjs';
import { emailReady, flushOutbox } from '../../../lib/email.mjs';
import { fail } from '../../../lib/validation.mjs';
import { ZONE } from '../../../lib/schedule.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const json = (value, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
async function body(request) {
  if (!request.headers.get('content-type')?.includes('application/json')) fail(415, 'Send JSON data.');
  const reader = request.body?.getReader();
  if (!reader) fail(400, 'Missing request body.');
  const chunks = []; let size = 0;
  while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 65536) { await reader.cancel(); fail(413, 'Request is too large.'); } chunks.push(Buffer.from(value)); }
  try { return JSON.parse(Buffer.concat(chunks).toString()); } catch { fail(400, 'Invalid JSON.'); }
}
async function handler(request, context) {
  try {
    const { path } = await context.params; const route = path.join('/'); const method = request.method;
    const url = new URL(request.url);
    if (route === 'cron/email' && ['GET', 'POST'].includes(method)) {
      if (!safeEqual(request.headers.get('authorization'), process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : '')) fail(401, 'Unauthorized');
      await ensureInitialized();
      return json({ results: await flushOutbox({ limit: 3 }) });
    }
    if (method !== 'GET') assertOrigin(request);
    await ensureInitialized();
    if (route === 'coverage' && method === 'GET') {
      const { db } = await database();
      const coverage = await db.collection('settings').findOne({ _id: 'coverage' });
      return json({ enabledZips: enabledCoverage(coverage), updatedAt: coverage?.updatedAt || null });
    }
    if (route === 'catalog' && method === 'GET') {
      const { db } = await database();
      const services = await db.collection('services').find({ active: true, priceCents: { $ne: null } }, { projection: { updatedAt: 0 } }).toArray();
      const schedule = await db.collection('settings').findOne({ _id: 'schedule' });
      const enabledZips = enabledCoverage(await db.collection('settings').findOne({ _id: 'coverage' }));
      const today = DateTime.now().setZone(ZONE);
      return json({ services, enabledZips, enabled: Boolean(schedule?.enabled && services.length && enabledZips.length && emailReady()), timezone: ZONE, minDate: today.toISODate(), maxDate: today.plus({ days: schedule?.horizonDays || 60 }).toISODate() });
    }
    if (route === 'slots' && method === 'GET') return json({ slots: await availableSlots(url.searchParams.get('service'), url.searchParams.get('date')) });
    if (route === 'bookings' && method === 'POST') {
      const data = await body(request);
      await limit('booking-global', 300);
      await limit(`booking-email:${String(data.email || '').trim().toLowerCase()}`, 12);
      const booking = await createBooking(data);
      // Booking is committed. A mail/database retry failure must not turn success into
      // an error that invites a customer to reserve a second appointment.
      try { await flushOutbox({ ids: [`${booking.reference}-confirmation-customer`, `${booking.reference}-confirmation-admin`], limit: 2 }); }
      catch { console.error('Confirmation processing deferred to outbox retry.'); }
      let mail;
      try { const { db } = await database(); mail = await db.collection('outbox').findOne({ _id: `${booking.reference}-confirmation-customer` }, { projection: { status: 1 } }); } catch {}
      return json({ ...booking, emailStatus: mail?.status || 'queued' }, 201);
    }
    if (route === 'auth/request' && method === 'POST') { await requestLogin((await body(request)).email); return json({ message: 'If this email has admin access, a sign-in link will arrive shortly.' }); }
    if (route === 'auth/redeem' && method === 'POST') {
      await limit('redeem-global', 300);
      const token = await redeemToken((await body(request)).token);
      (await cookies()).set(cookieName, token, sessionOptions); return json({ ok: true });
    }
    if (route === 'auth/logout' && method === 'POST') {
      const jar = await cookies(); const secret = jar.get(cookieName)?.value;
      if (secret) { const { db } = await database(); await db.collection('sessions').deleteOne({ _id: hash(secret) }); }
      jar.set(cookieName, '', { ...sessionOptions, maxAge: 0 }); return json({ ok: true });
    }
    if (path[0] !== 'admin') fail(404, 'Not found.');
    const actor = await requireAdmin((await cookies()).get(cookieName)?.value);
    const { db } = await database();
    if (route === 'admin/config' && method === 'GET') return json({ actor, services: await db.collection('services').find().toArray(), schedule: await db.collection('settings').findOne({ _id: 'schedule' }), coverage: await db.collection('settings').findOne({ _id: 'coverage' }), emailReady: emailReady() });
    if (route === 'admin/coverage' && method === 'PUT') { await saveCoverage(await body(request), actor); return json({ ok: true }); }
    if (route === 'admin/bookings' && method === 'GET') {
      const page = Math.max(0, Math.min(10000, Number(url.searchParams.get('page')) || 0));
      const filter = {}; const status = url.searchParams.get('status');
      if (['confirmed', 'completed', 'cancelled'].includes(status)) filter.status = status;
      if (url.searchParams.get('customerId')) filter.customerId = url.searchParams.get('customerId');
      return json({ items: await db.collection('bookings').find(filter, { projection: { fingerprint: 0 } }).sort({ startsAt: -1 }).skip(page * 25).limit(25).toArray(), total: await db.collection('bookings').countDocuments(filter) });
    }
    if (route === 'admin/customers' && method === 'GET') {
      const query = (url.searchParams.get('q') || '').slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const filter = query ? { $or: ['name', 'email', 'phone'].map(key => ({ [key]: { $regex: query, $options: 'i' } })) } : {};
      const page = Math.max(0, Math.min(10000, Number(url.searchParams.get('page')) || 0));
      return json({ items: await db.collection('customers').find(filter).sort({ createdAt: -1 }).skip(page * 25).limit(25).toArray(), total: await db.collection('customers').countDocuments(filter) });
    }
    if (route === 'admin/customers' && method === 'POST') { const id = randomUUID(); await saveCustomer(id, { ...await body(request), create: true }, actor); return json({ id }, 201); }
    if (path[1] === 'customers' && path.length === 3 && method === 'PUT') { const data = await body(request); delete data.create; await saveCustomer(path[2], data, actor); return json({ ok: true }); }
    if (path[1] === 'services' && path.length === 3 && method === 'PUT') { await saveService(path[2], await body(request), actor); return json({ ok: true }); }
    if (route === 'admin/schedule' && method === 'PUT') { await saveSchedule(await body(request), actor); return json({ ok: true }); }
    if (path[1] === 'bookings' && path.length === 3 && method === 'PATCH') { await updateBooking(path[2], (await body(request)).status, actor); await flushOutbox({ ids: [`${path[2]}-cancellation-customer`, `${path[2]}-cancellation-admin`], limit: 2 }); return json({ ok: true }); }
    if (route === 'admin/email' && method === 'GET') return json({ items: await db.collection('outbox').find({ kind: 'booking' }, { projection: { html: 0, text: 0 } }).sort({ createdAt: -1 }).limit(50).toArray() });
    if (route === 'admin/email/retry' && method === 'POST') return json({ results: await flushOutbox() });
    fail(404, 'Not found.');
  } catch (error) {
    if (error instanceof ZodError) return json({ error: error.issues.map(i => `${i.path.join('.') || 'Form'}: ${i.message}`).join(' ') }, 400);
    if (error.code === 11000) return json({ error: 'A record with those details already exists. Refresh and try again.' }, 409);
    if (error.status) return json({ error: error.message }, error.status);
    console.error('Backend request failed:', error.name, error.code || 'unexpected');
    return json({ error: 'The system is temporarily unavailable. Please try again or email Dwight.' }, 503);
  }
}
export { handler as GET, handler as POST, handler as PUT, handler as PATCH };
