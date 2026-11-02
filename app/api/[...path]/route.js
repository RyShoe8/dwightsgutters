import {getAccess,authorizeRoute,authorizeTarget,listTeam,saveMember,personalSchedule} from '../../../lib/access.mjs';
import { deleteBooking, deleteCustomer } from '../../../lib/bookings.mjs';
import { listReplies, queueReply } from '../../../lib/replies.mjs';
import { listBookings } from '../../../lib/adminBookings.mjs';
import { saveInquiry, listContacts } from '../../../lib/inquiries.mjs';
import { getReviews, saveReviews } from '../../../lib/reviews.mjs';
import { initialReviews } from '../../../lib/reviewSnapshot.mjs';
import { getStaff, saveStaff } from '../../../lib/staff.mjs';
import { getPayments, savePayments } from '../../../lib/payments.mjs';
import { stripeReady, verifyStripeEvent } from '../../../lib/stripe.mjs';
import { getChangeDetails, changeAppointment, confirmVisit } from '../../../lib/reschedule.mjs';
import { bookingText, runScheduledMessages } from '../../../lib/messages.mjs';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'node:crypto';
import { DateTime } from 'luxon';
import { ZodError } from 'zod';
import { database, ensureInitialized } from '../../../lib/db.mjs';
import { assertOrigin, requireAdmin, requestLogin, redeemToken, redeemCode, cookieName, sessionOptions, hash, limit, safeEqual } from '../../../lib/auth.mjs';
import { availableSlots, availableDates, createBooking, saveService, saveSchedule, saveCoverage, updateBooking, saveCustomer, recordPayment, handleStripeEvent, confirmBooking } from '../../../lib/bookings.mjs';
import { enabledCoverage } from '../../../lib/coverage-data.mjs';
import { emailReady, flushOutbox } from '../../../lib/email.mjs';
import { fail } from '../../../lib/validation.mjs';
import { ZONE } from '../../../lib/schedule.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
// Landing pages, the sitemap and llms.txt show coverage, prices and reviews; refresh them on save.
const refreshMarketing = () => { try { revalidatePath('/', 'layout'); } catch { console.error('Marketing page refresh deferred to the hourly revalidation.'); } };
const json = (value, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
async function text(request, limit = 65536) {
  if (!request.headers.get('content-type')?.includes('application/json')) fail(415, 'Send JSON data.');
  const reader = request.body?.getReader();
  if (!reader) fail(400, 'Missing request body.');
  const chunks = []; let size = 0;
  while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > limit) { await reader.cancel(); fail(413, 'Request is too large.'); } chunks.push(Buffer.from(value)); }
  return Buffer.concat(chunks).toString();
}
async function body(request) {
  const raw = await text(request);
  try { return JSON.parse(raw); } catch { fail(400, 'Invalid JSON.'); }
}
async function handler(request, context) {
  try {
    const { path } = await context.params; const route = path.join('/'); const method = request.method;
    const url = new URL(request.url);
    if (route === 'reviews' && method === 'GET') {
      // The verified launch snapshot keeps testimonials visible during a DB outage.
      try { return json(await getReviews()); }
      catch { return json(initialReviews); }
    }
    if (route === 'cron/email' && ['GET', 'POST'].includes(method)) {
      if (!safeEqual(request.headers.get('authorization'), process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : '')) fail(401, 'Unauthorized');
      await ensureInitialized();
      const scheduled = await runScheduledMessages();
      return json({ scheduled: scheduled.length, results: await flushOutbox({ limit: 25 }) });
    }
    // Stripe calls this when an invoice link is paid; the signature replaces the origin check.
    if (route === 'webhooks/stripe' && method === 'POST') {
      const event = verifyStripeEvent(await text(request, 262144), request.headers.get('stripe-signature'));
      await ensureInitialized();
      const result = await handleStripeEvent(event);
      if (result.payment) try { await flushOutbox({ ids: [`${event.data.object.metadata.booking_id}-review-request`], limit: 3 }); } catch { console.error('Email processing deferred to outbox retry.'); }
      return json(result);
    }
    if (method !== 'GET') assertOrigin(request);
    await ensureInitialized();
    if (['reschedule/details', 'reschedule/change', 'reschedule/confirm'].includes(route) && method === 'POST') {
      const data = await body(request);
      await limit('reschedule-global', 300);
      await limit(`reschedule:${hash(String(data.token || '').slice(0, 100))}`, 60, 900);
      if (route === 'reschedule/details') return json(await getChangeDetails(data.token, data.date));
      if (route === 'reschedule/confirm') { const confirmed = await confirmVisit(data); try { await flushOutbox({ ids: confirmed.ids, limit: 3 }); } catch { console.error('Email processing deferred to outbox retry.'); } return json({ when: confirmed.when }); }
      const changed = await changeAppointment(data);
      try { await flushOutbox({ ids: changed.ids, limit: 2 }); } catch { console.error('Rescheduling email processing deferred to outbox retry.'); }
      return json({ when: changed.when });
    }
    if (route === 'coverage' && method === 'GET') {
      const { db } = await database();
      const coverage = await db.collection('settings').findOne({ _id: 'coverage' });
      return json({ enabledZips: enabledCoverage(coverage), updatedAt: coverage?.updatedAt || null });
    }
    if (['inquiries', 'booking-requests'].includes(route) && method === 'POST') {
      const data = await body(request);
      await limit('contact-global', 300); await limit('contact:' + String(data.email || '').trim().toLowerCase(), 10);
      const inquiry = await saveInquiry(data, 'inquiry');
      try { await flushOutbox({ids:[`${inquiry.reference}-inquiry-admin`],limit:1}); } catch { console.error('Inquiry notification deferred to outbox retry.'); }
      return json(inquiry, 201);
    }
    if (route === 'catalog' && method === 'GET') {
      const { db } = await database();
      const offered = await db.collection('services').find({ active: true, priceCents: { $ne: null } }, { projection: { updatedAt: 0 } }).toArray();
      const services = offered.filter(s => s.kind !== 'addon'), addOns = offered.filter(s => s.appliesTo?.length);
      const schedule = await db.collection('settings').findOne({ _id: 'schedule' });
      const enabledZips = enabledCoverage(await db.collection('settings').findOne({ _id: 'coverage' }));
      const today = DateTime.now().setZone(ZONE);
      return json({ services, addOns, enabledZips, enabled: Boolean(schedule?.enabled && services.length && enabledZips.length && emailReady()), timezone: ZONE, minDate: today.toISODate(), maxDate: today.plus({ days: schedule?.horizonDays || 60 }).toISODate() });
    }
    const addOnIds = (url.searchParams.get('addOns') || '').split(',').filter(Boolean).slice(0, 5);
    const visit = url.searchParams.get('visit') === '2' ? 2 : 1;
    if (route === 'slots' && method === 'GET') return json({ slots: await availableSlots(url.searchParams.get('service'), url.searchParams.get('date'), addOnIds, { visit }) });
    if (route === 'dates' && method === 'GET') return json({ dates: await availableDates(url.searchParams.get('service'), addOnIds, { visit, after: url.searchParams.get('after') }) });
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
      return json({ ...booking, emailStatus: booking.status === 'confirmed' && booking.delivery === 'email' ? mail?.status || 'queued' : null }, 201);
    }
    if (route === 'auth/request' && method === 'POST') { await requestLogin((await body(request)).email); return json({ message: 'If this email has admin access, a sign-in link and code will arrive shortly.' }); }
    if (['auth/redeem', 'auth/code'].includes(route) && method === 'POST') {
      await limit('redeem-global', 300);
      const data = await body(request);
      const token = route === 'auth/code' ? await redeemCode(data.email, data.code) : await redeemToken(data.token);
      (await cookies()).set(cookieName, token, sessionOptions); return json({ ok: true });
    }
    if (route === 'auth/logout' && method === 'POST') {
      const jar = await cookies(); const secret = jar.get(cookieName)?.value;
      if (secret) { const { db } = await database(); await db.collection('sessions').deleteOne({ _id: hash(secret) }); }
      jar.set(cookieName, '', { ...sessionOptions, maxAge: 0 }); return json({ ok: true });
    }
    if (path[0] !== 'admin') fail(404, 'Not found.');
    const jar = await cookies(); const secret = jar.get(cookieName)?.value;
    const actor = await requireAdmin(secret);
    const access=await getAccess(actor);
    authorizeRoute(access.role,route,method);
    jar.set(cookieName, secret, sessionOptions);
    const { db } = await database();
    if (route === 'admin/replies' && method === 'GET') {authorizeTarget(access.role,url.searchParams.get('type')); return json(await listReplies({ type: url.searchParams.get('type'), id: url.searchParams.get('id') }));}
    if (route === 'admin/replies' && method === 'POST') {
      await limit('admin-replies:' + actor, 100);
      const data=await body(request); authorizeTarget(access.role,data.type);
      const reply = await queueReply(data, actor);
      let status = 'pending';
      try {
        await flushOutbox({ ids: [reply.outboxId], limit: 1 });
        status = (await db.collection('outbox').findOne({ _id: reply.outboxId }, { projection: { status: 1 } }))?.status || 'pending';
      } catch { console.error('Admin reply processing deferred to outbox retry.'); }
      return json({ status });
    }
    if (route === 'admin/reviews' && method === 'GET') return json(await getReviews());
    if (route === 'admin/reviews' && method === 'PUT') { const saved = await saveReviews(await body(request), actor); refreshMarketing(); return json(saved); }
    if (route === 'admin/team' && method === 'GET') return json({items:await listTeam()});
    if (route === 'admin/team' && method === 'PUT') return json(await saveMember(await body(request),actor));
    if (route === 'admin/my-schedule' && ['GET','PUT'].includes(method)) {
      const target=url.searchParams.get('email')||actor;
      if(target!==actor&&access.role!=='owner') fail(403,'Staff can edit only their own availability.');
      if(!await db.collection('admins').findOne({_id:target}))fail(404,'Team member not found.');
      return method==='GET' ? json({schedule:await personalSchedule(target)}) : json(await personalSchedule(target,await body(request)));
    }
    if (route === 'admin/config' && method === 'GET' && access.role!=='owner') return json({actor,role:access.role,services:[],schedule:null,coverage:null,payments:await getPayments(db),emailReady:emailReady(),stripeReady:stripeReady()});
    if (route === 'admin/config' && method === 'GET') return json({ actor, role:access.role, staff: await getStaff(db), payments: await getPayments(db), services: await db.collection('services').find().toArray(), schedule: await db.collection('settings').findOne({ _id: 'schedule' }), coverage: await db.collection('settings').findOne({ _id: 'coverage' }), emailReady: emailReady(), stripeReady: stripeReady() });
    if (route === 'admin/payments' && method === 'GET') return json(await getPayments(db));
    if (route === 'admin/payments' && method === 'PUT') return json(await savePayments(await body(request), actor));
    if (route === 'admin/staff' && method === 'PUT') return json(await saveStaff(await body(request), actor));
    if (route === 'admin/coverage' && method === 'PUT') { await saveCoverage(await body(request), actor); refreshMarketing(); return json({ ok: true }); }
    if (route === 'admin/record' && method === 'GET') {
      const type=url.searchParams.get('type'), id=url.searchParams.get('id');
      authorizeTarget(access.role,type);
      if (!['booking','inquiry'].includes(type)||!id||id.length>160) fail(400,'Choose a valid record.');
      const record=await db.collection(type==='booking'?'bookings':'inquiries').findOne({_id:id},{projection:{fingerprint:0,rescheduleTokenHash:0,altTokenHashes:0}});
      if(!record) fail(404,'This record could not be found.');
      return json(record);
    }
    if (route === 'admin/bookings' && method === 'GET') {
      const page = Math.max(0, Math.min(10000, Number(url.searchParams.get('page')) || 0));
      return json(await listBookings({ page, status: url.searchParams.get('status') || 'all', id: url.searchParams.get('id') || undefined, customerId: url.searchParams.get('customerId') || undefined }));
    }
    if (route === 'admin/customers' && method === 'GET') {
      return json(await listContacts({ kind: ['customers', 'inquiries'].includes(url.searchParams.get('kind')) ? url.searchParams.get('kind') : 'customers', search: url.searchParams.get('q') || '', page: Math.max(0, Math.min(10000, Number(url.searchParams.get('page')) || 0)) }));

    }
    if (route === 'admin/customers' && method === 'POST') { const id = randomUUID(); await saveCustomer(id, { ...await body(request), create: true }, actor); return json({ id }, 201); }
    if (path[1] === 'customers' && path.length === 3 && method === 'DELETE') return json(await deleteCustomer(path[2],actor));
    if (path[1] === 'bookings' && path.length === 3 && method === 'DELETE') return json(await deleteBooking(path[2],actor));
    if (path[1] === 'customers' && path.length === 3 && method === 'PUT') { const data = await body(request); delete data.create; await saveCustomer(path[2], data, actor); return json({ ok: true }); }
    if (path[1] === 'services' && path.length === 3 && method === 'PUT') { await saveService(path[2], await body(request), actor); refreshMarketing(); return json({ ok: true }); }
    if (route === 'admin/schedule' && method === 'PUT') { await saveSchedule(await body(request), actor); return json({ ok: true }); }
    if (path[1] === 'bookings' && path[3] === 'payment' && path.length === 4 && method === 'POST') { const result = await recordPayment(path[2], (await body(request)).method ?? null, actor); if (result.payment) try { await flushOutbox({ ids: [`${path[2]}-review-request`], limit: 3 }); } catch { console.error('Email processing deferred to outbox retry.'); } return json(result); }
    if (path[1] === 'bookings' && path[3] === 'confirm' && path.length === 4 && method === 'POST') {
      const result = await confirmBooking(path[2], actor);
      if (result.delivery === 'email') try { await flushOutbox({ ids: [`${result.bookingId}-confirmation-customer`], limit: 3 }); } catch { console.error('Email processing deferred to outbox retry.'); }
      return json({ ...result, ...(result.delivery === 'text' ? { textMessage: await bookingText(result.bookingId, 'confirmation') } : {}) });
    }
    if (path[1] === 'bookings' && path[3] === 'text' && path.length === 4 && method === 'GET') return json({ textMessage: await bookingText(path[2], url.searchParams.get('kind') === 'invoice' ? 'invoice' : 'confirmation') });
    if (path[1] === 'bookings' && path.length === 3 && method === 'PATCH') {
      const data = await body(request);
      const result = await updateBooking(path[2], data.status, actor, data);
      const ids = data.status === 'completed' ? [`${path[2]}-invoice-customer`] : [`${path[2]}-cancellation-customer`, `${path[2]}-cancellation-admin`];
      try { await flushOutbox({ ids, limit: 2 }); } catch { console.error('Booking email processing deferred to outbox retry.'); }
      return json({ ok: true, ...result, ...(data.status === 'completed' && result.delivery === 'text' ? { textMessage: await bookingText(path[2], 'invoice') } : {}) });
    }
    if (route === 'admin/email' && method === 'GET') return json({ items: await db.collection('outbox').find({ kind: { $in: ['booking', 'invoice', 'reminder', 'followup', 'review', 'reply', 'notification'] } }, { projection: { html: 0, text: 0 } }).sort({ createdAt: -1 }).limit(50).toArray() });
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
