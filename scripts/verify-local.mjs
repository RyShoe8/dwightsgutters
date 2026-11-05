// Exercise the HTTP boundary against dev:local only. Never targets a remote site.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { MongoClient } from 'mongodb';
import { randomUUID } from 'node:crypto';
import { DateTime } from 'luxon';
const runtime = JSON.parse(await readFile('.local/runtime.json', 'utf8'));
assert.match(runtime.uri, /^mongodb:\/\/127\.0\.0\.1:/);
assert.equal(runtime.database, 'dwights_gutters_local');
const client = await new MongoClient(runtime.uri).connect();
const db = client.db(runtime.database), origin = 'http://127.0.0.1:3000';
let cookie = '';
async function call(path, method = 'GET', data, headers = {}) {
  const [pathname,query]=path.split('?');
  const response = await fetch(`${origin}/api/${pathname}/${query?'?'+query:''}`, { method, headers: { Origin: origin, Cookie: cookie, ...(data ? { 'Content-Type': 'application/json' } : {}), ...headers }, ...(data ? { body: JSON.stringify(data) } : {}) });
  return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie') };
}
const originalSchedule = await db.collection('settings').findOne({ _id: 'schedule' });
const originalCoverage = await db.collection('settings').findOne({ _id: 'coverage' });
const originalService = await db.collection('services').findOne({ _id: 'gutter-cleaning' });
try {
  assert.equal((await call('admin/config')).status, 401);
  assert.equal((await call('admin/coverage', 'PUT', { enabledZips: [], revision: 0 })).status, 401);
  assert.equal((await call('auth/request', 'POST', { email: 'dwight@dwightsgutters.com' }, { Origin: 'https://invalid.example' })).status, 403);
  assert.equal((await call('auth/request', 'POST', { email: 'dwight@dwightsgutters.com' })).status, 200);
  const mail = await db.collection('outbox').findOne({ kind: 'login' }, { sort: { createdAt: -1 } });
  assert.equal(mail.status, 'captured');
  const saved = JSON.parse(await readFile(`.local/mail/${mail._id}.json`, 'utf8'));
  const token = saved.text.match(/token=([a-f0-9]+)/)[1];
  const login = await call('auth/redeem', 'POST', { token }); assert.equal(login.status, 200); assert.match(login.cookie, /HttpOnly/i); cookie = login.cookie.split(';')[0];
  assert.equal((await call('auth/redeem', 'POST', { token })).status, 401);
  const config = (await call('admin/config')).data;
  assert.equal((await call('admin/services/gutter-cleaning', 'PUT', { name: 'Gutter cleaning', priceCents: 15000, durationMinutes: 120, active: true })).status, 200);
  assert.equal((await call('admin/schedule', 'PUT', { ...config.schedule, enabled: true, weekly: config.schedule.weekly.map(d => ({ ...d, enabled: true })), exceptions: [] })).status, 200);
  const date = DateTime.now().setZone('America/Chicago').plus({ days: 4 }).toISODate();
  const slotsResponse = await fetch(`${origin}/api/slots/?service=gutter-cleaning&date=${date}`);
  const { slots } = await slotsResponse.json(); assert.ok(slots.length);
  const payload = { requestId: randomUUID(), serviceId: 'gutter-cleaning', startsAt: slots[0].startsAt, expectedPriceCents: 15000, name: 'Local HTTP verification', email: 'local-http@example.com', contact: 'Email', address: '123 Test Lane', city: 'Austin', zip: '78701', stories: 'One story', guards: 'No', notes: '', consent: true };
  assert.equal((await call('admin/coverage', 'PUT', { enabledZips: [], revision: config.coverage.revision })).status, 200);
  assert.deepEqual((await call('coverage')).data.enabledZips, []);
  assert.equal((await call('bookings', 'POST', payload)).status, 409);
  assert.equal((await call('admin/coverage', 'PUT', { enabledZips: config.coverage.enabledZips, revision: config.coverage.revision + 1 })).status, 200);
  const result = await call('bookings', 'POST', payload); assert.equal(result.status, 201, JSON.stringify(result.data)); assert.equal(result.data.emailStatus, 'captured');
  assert.equal((await call('bookings', 'POST', payload)).data.emailStatus, 'captured');
  assert.equal((await call('admin/bookings')).data.total >= 1, true);
  assert.equal((await call('admin/customers')).data.total >= 1, true);
  assert.equal((await call(`admin/bookings/${result.data.reference}`, 'PATCH', { status: 'cancelled' })).status, 200);
  assert.equal((await call('cron/email')).status, 401);
  // Verify actual HTTP permissions rather than only testing the permission helper.
  const ownerCookie=cookie,staffEmail='security-local-staff@example.com';
  assert.equal((await call('admin/team','PUT',{email:staffEmail,name:'Local security Staff',role:'staff',enabled:true})).status,200);
  cookie='';assert.equal((await call('auth/request','POST',{email:staffEmail})).status,200);
  const staffMail=await db.collection('outbox').findOne({kind:'login',to:staffEmail},{sort:{createdAt:-1}});
  const staffSaved=JSON.parse(await readFile(`.local/mail/${staffMail._id}.json`,'utf8'));
  const staffLogin=await call('auth/redeem','POST',{token:staffSaved.text.match(/token=([a-f0-9]+)/)[1]});
  assert.equal(staffLogin.status,200);cookie=staffLogin.cookie.split(';')[0];
  assert.equal((await call('admin/config')).data.role,'staff');
  assert.equal((await call('admin/bookings')).status,200);
  for(const path of ['admin/team','admin/payments','admin/customers','admin/email','admin/nucleas/service-metrics'])assert.equal((await call(path)).status,403,path);
  assert.equal((await call('admin/team','PUT',{email:staffEmail,name:'Self promotion',role:'owner',enabled:true})).status,403);
  assert.equal((await call('admin/my-schedule?email=dwight%40dwightsgutters.com')).status,403);
  assert.equal((await call('admin/replies?type=inquiry&id=missing')).status,403);
  assert.equal((await call(`admin/bookings/${result.data.reference}`,'DELETE')).status,403);
  assert.equal((await call('auth/request','POST',{email:{$ne:null}})).status,400);
  cookie=ownerCookie;
  assert.equal((await call('admin/team','PUT',{email:staffEmail,name:'Local security Staff',role:'staff',enabled:false})).status,200);
  const privatePage=await fetch(`${origin}/admin/sign-in/`);
  assert.match(privatePage.headers.get('content-security-policy'),/connect-src 'self'/);
  assert.match(privatePage.headers.get('strict-transport-security'),/max-age=/);
  const privateHtml=await privatePage.text();
  assert.ok(!/<script[^>]+src=["'][^"']*(?:cookie-script|analytics\.ahrefs|googletagmanager)/i.test(privateHtml));

  assert.equal((await call('auth/logout', 'POST', {})).status, 200);
  assert.equal((await call('admin/config')).status, 401);
  console.log('HTTP security and regression verification passed: authorization, CSRF, magic-link login/replay, pricing, availability, booking, email capture, CRM, cancellation, logout.');
} finally {
  // Restore the original local configuration, retaining clearly labeled test history.
  await db.collection('settings').replaceOne({ _id: 'coverage' }, originalCoverage);
  await db.collection('settings').replaceOne({ _id: 'schedule' }, originalSchedule);
  await db.collection('services').replaceOne({ _id: 'gutter-cleaning' }, originalService);
  await client.close();
}
