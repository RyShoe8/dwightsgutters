import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { DateTime } from 'luxon';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { database, seed } from '../lib/db.mjs';
import { createBooking, availableSlots, updateBooking, saveService } from '../lib/bookings.mjs';
import { assertChangeAllowed, getChangeDetails, changeAppointment } from '../lib/reschedule.mjs';
import { openDates } from '../lib/schedule.mjs';
import { getStaff, saveStaff } from '../lib/staff.mjs';
import { getPayments, savePayments, paymentSettingsSchema } from '../lib/payments.mjs';
import { defaultPaymentSettings, defaultFees, invoicePaymentOptions } from '../lib/paymentOptions.mjs';
import { hash } from '../lib/auth.mjs';
import { flushOutbox, invoiceEmail } from '../lib/email.mjs';
const actor='dwight@dwightsgutters.com';
let repl,db;
const date = days => DateTime.now().setZone('America/Chicago').plus({days}).toISODate();
before(async()=>{
 process.env.EMAIL_TRANSPORT='file';process.env.APP_URL='http://127.0.0.1:3000';process.env.MONGODB_DB=`appointment_${randomUUID()}`;
 repl=await MongoMemoryReplSet.create({replSet:{count:1,storageEngine:'wiredTiger'}});process.env.MONGODB_URI=repl.getUri();
 ({db}=await database());await seed();
 await db.collection('settings').updateOne({_id:'schedule'},{$set:{enabled:true,leadHours:1,horizonDays:60,bufferMinutes:30,weekly:Array.from({length:7},(_,i)=>({day:i+1,enabled:true,start:'09:00',end:'17:00'})),exceptions:[]}});
 await db.collection('settings').updateOne({_id:'coverage'},{$set:{enabledZips:['78701']}});
 await saveService('gutter-cleaning',{name:'Gutter cleaning',priceCents:15000,durationMinutes:120,active:true},actor);
});
after(async()=>{if(db)await db.dropDatabase();if(globalThis.dwightMongo)await(await globalThis.dwightMongo).close();await repl?.stop();});
async function book(days){
 const [slot]=await availableSlots('gutter-cleaning',date(days));const service=await db.collection('services').findOne({_id:'gutter-cleaning'});
 const input={requestId:randomUUID(),serviceId:'gutter-cleaning',startsAt:slot.startsAt,expectedPriceCents:service.priceCents,name:'Test Customer',email:`test-${randomUUID()}@example.com`,phone:'',contact:'Email',address:'123 Test Ln',city:'Austin',zip:'78701',stories:'One story',guards:'No',notes:'',consent:true};
 const receipt=await createBooking(input);const mail=await db.collection('outbox').findOne({_id:`${receipt.reference}-confirmation-customer`});const token=mail.text.match(/#token=([a-f0-9]{64})/)[1];
 return {receipt,mail,token,input};
}
test('confirmation includes service, starting price, Austin time, private change link and contact details',async()=>{
 const b=await book(3);
 for(const value of ['Gutter cleaning','$150.00','Appointment:','48 hours','/contact/','(737) 425-1697'])assert.ok(b.mail.text.includes(value),value);
 assert.ok(b.mail.html.includes('/book/change/#token='));assert.ok(b.mail.html.includes('Contact Dwight'));
 const stored=await db.collection('bookings').findOne({_id:b.receipt.reference});assert.equal(stored.rescheduleTokenHash,hash(b.token));assert.ok(!JSON.stringify(stored).includes(b.token));
 await createBooking(b.input);assert.equal(await db.collection('outbox').countDocuments({_id:b.mail._id}),1);
});
test('48-hour boundary is enforced using elapsed time, and closed bookings cannot change',()=>{
 const now=new Date('2026-11-01T06:00:00Z');
 assert.doesNotThrow(()=>assertChangeAllowed({status:'confirmed',startsAt:new Date(+now+48*3600000)},now));
 assert.throws(()=>assertChangeAllowed({status:'confirmed',startsAt:new Date(+now+48*3600000-1)},now),/48 hours/);
 assert.throws(()=>assertChangeAllowed({status:'completed',startsAt:new Date(+now+72*3600000)},now),/closed/);
});
test('rescheduling preserves price, releases the old time, queues updates once and rejects stale tabs',async()=>{
 const b=await book(4);await saveService('gutter-cleaning',{name:'Updated cleaning',priceCents:19000,durationMinutes:180,active:true},actor);
 const details=await getChangeDetails(b.token,date(8));assert.equal(details.priceCents,15000);assert.equal(details.service,'Gutter cleaning');
 const target=details.slots[0];const input={token:b.token,startsAt:target.startsAt,expectedStartsAt:b.receipt.startsAt.toISOString()};
 const result=await changeAppointment(input);assert.equal(result.ids.length,2);
 assert.deepEqual((await changeAppointment(input)).ids,[]);
 const updated=await db.collection('bookings').findOne({_id:b.receipt.reference});assert.equal(updated.service.priceCents,15000);assert.equal(updated.service.durationMinutes,120);assert.equal(updated.startsAt.toISOString(),new Date(target.startsAt).toISOString());
 assert.ok((await availableSlots('gutter-cleaning',date(4))).some(s=>new Date(s.startsAt).getTime()===new Date(b.receipt.startsAt).getTime()));
 await assert.rejects(changeAppointment({...input,startsAt:details.slots[1].startsAt}),/has changed/);
 await assert.rejects(changeAppointment({...input,startsAt:DateTime.now().plus({hours:24}).toUTC().toISO(),expectedStartsAt:updated.startsAt.toISOString()}),/no longer available/);
 await db.collection('bookings').updateOne({_id:b.receipt.reference},{$set:{startsAt:new Date(Date.now()+47*3600000),endsAt:new Date(Date.now()+49*3600000),occupiedUntil:new Date(Date.now()+49.5*3600000)}});
 await assert.rejects(getChangeDetails(b.token),/48 hours/);
});
test('competing reschedules and a new booking reserve one target atomically',async()=>{
 const a=await book(5),b=await book(6);const detail=await getChangeDetails(a.token,date(10));const startsAt=detail.slots[0].startsAt;
 const results=await Promise.allSettled([changeAppointment({token:a.token,startsAt,expectedStartsAt:a.receipt.startsAt.toISOString()}),changeAppointment({token:b.token,startsAt,expectedStartsAt:b.receipt.startsAt.toISOString()}),createBooking({...b.input,requestId:randomUUID(),startsAt,expectedPriceCents:19000})]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.equal(await db.collection('bookings').countDocuments({startsAt:new Date(startsAt),status:'confirmed'}),1);
});
test('completion requires configured payment options and saves one immutable final invoice',async()=>{
 const b=await book(12);const before=await db.collection('bookings').findOne({_id:b.receipt.reference});
 await assert.rejects(updateBooking(b.receipt.reference,'completed',actor,{totalCents:17500}),/future/);
 await db.collection('bookings').updateOne({_id:b.receipt.reference},{$set:{startsAt:new Date(Date.now()-4*3600000),endsAt:new Date(Date.now()+3600000),occupiedUntil:new Date(Date.now()+5400000)}});
 await assert.rejects(updateBooking(b.receipt.reference,'completed',actor,{totalCents:17500}),/payment options/);
 assert.equal((await db.collection('bookings').findOne({_id:b.receipt.reference})).status,'confirmed');
 const payments=[{type:'Card / digital wallet',url:'https://payments.example.test/pay',instructions:'Card, Apple Pay and Google Pay if supported by the provider.'},{type:'PayPal',url:'https://paypal.example.test/dwight',instructions:'PayPal link'},{type:'Venmo',url:'https://venmo.example.test/dwight',instructions:'Venmo link'},{type:'Zelle',url:'',instructions:'Use the email on your invoice.'},{type:'Cash',url:'',instructions:'Arrange with Dwight.'},{type:'Check',url:'',instructions:'Payable to the business.'},{type:'Bank transfer',url:'',instructions:'Contact Dwight for transfer details.'}];
 await saveStaff({name:'Dwight',phone:'5125550199'},actor);
 await savePayments({...defaultPaymentSettings,venmo:{...defaultPaymentSettings.venmo,enabled:true,username:'@Dwights-Gutters',instructions:'Venmo link'},otherMethods:payments.filter(p=>p.type!=='Venmo').map(p=>({...defaultFees[p.type],...p}))},actor);
 await assert.rejects(updateBooking(b.receipt.reference,'completed',actor,{totalCents:-1}),/final invoice total/);
 const results=await Promise.all([updateBooking(b.receipt.reference,'completed',actor,{totalCents:17500}),updateBooking(b.receipt.reference,'completed',actor,{totalCents:17500})]);
 assert.equal(results[0].invoice.number,results[1].invoice.number);
 assert.equal(await db.collection('outbox').countDocuments({_id:`${b.receipt.reference}-invoice-customer`}),1);
 const stored=await db.collection('bookings').findOne({_id:b.receipt.reference});assert.equal(stored.invoice.totalCents,17500);
 assert.deepEqual(stored.invoice.payments.map(p=>p.type),['Zelle','Cash','Check','Bank transfer','Venmo','Card / digital wallet','PayPal']);
 const venmo=new URL(stored.invoice.payments.find(p=>p.type==='Venmo').url);assert.equal(venmo.searchParams.get('amount'),'175.00');assert.equal(venmo.searchParams.get('recipients'),'Dwights-Gutters');assert.equal(venmo.searchParams.get('note'),`Invoice ${stored.invoice.number}`);assert.equal(stored.service.priceCents,before.service.priceCents);
 await saveStaff({name:'Dwight',phone:'5125550123'},actor);
 await savePayments({...await getPayments(),venmo:{...defaultPaymentSettings.venmo,enabled:false},otherMethods:[{...defaultFees.Cash,type:'Cash',url:'',instructions:'Cash only'}]},actor);
 const again=await updateBooking(b.receipt.reference,'completed',actor,{totalCents:20000});assert.equal(again.invoice.totalCents,17500);assert.equal(again.invoice.phone,'5125550199');
 const [sent]=await flushOutbox({ids:[`${b.receipt.reference}-invoice-customer`],limit:1});assert.equal(sent.status,'captured');
 const captured=JSON.parse(await readFile(`.local/mail/${b.receipt.reference}-invoice-customer.json`,'utf8'));
 assert.ok(captured.text.includes('$175.00'));const capturedHtml=await readFile(`.local/mail/${b.receipt.reference}-invoice-customer.html`,'utf8');assert.ok(capturedHtml.includes('Pay $175.00 with Venmo'));assert.ok(capturedHtml.includes('enter $175.00'));assert.ok(captured.text.includes('/contact/'));assert.ok(captured.text.includes('5125550199'));for(const p of payments)assert.ok(captured.text.includes(p.type));
 const escaped=invoiceEmail({...stored,name:'<script>bad</script>'});assert.ok(escaped.html.includes('&lt;script&gt;'));assert.ok(!escaped.html.includes('<script>'));
 await seed();assert.equal((await getStaff()).phone,'5125550123');
});
test('payment validation rejects unsafe links and incomplete instructions',()=>{
 for(const method of [{type:'Card / digital wallet',url:'',instructions:''},{type:'PayPal',url:'javascript:alert(1)',instructions:''},{type:'Check',url:'',instructions:''}].map(m=>({...defaultFees[m.type],...m})))assert.equal(paymentSettingsSchema.safeParse({...defaultPaymentSettings,otherMethods:[method]}).success,false);
});

test('Stripe needs a connected key, Venmo needs a username, and settings survive staff changes',async()=>{
 const before=await getPayments();
 await assert.rejects(savePayments({...before,stripe:{...before.stripe,enabled:true}},actor),/STRIPE_SECRET_KEY/);
 process.env.STRIPE_SECRET_KEY='sk_test_sample';
 try{
  const config=await savePayments({...before,stripe:{...before.stripe,enabled:true},venmo:{...before.venmo,enabled:true,username:'sample-business'}},actor);
  const active=invoicePaymentOptions(config,{totalCents:15000,stripeUrl:'https://buy.stripe.com/test_link'});assert.ok(active.some(p=>p.type==='Stripe'&&p.exact));assert.ok(active.some(p=>p.type==='Venmo'&&p.exact));
  assert.ok(!invoicePaymentOptions(config,{totalCents:15000}).some(p=>p.type==='Stripe'));
  await saveStaff({name:'Dwight',phone:'5125550188'},actor);assert.deepEqual(await getPayments(),config);
  await assert.rejects(savePayments({...config,revision:before.revision},actor),/changed/);
  const results=await Promise.allSettled([savePayments({...config,stripe:{...config.stripe,enabled:false}},actor),savePayments({...config,venmo:{...config.venmo,enabled:false}},actor)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal((await getPayments()).revision,config.revision+1);
 }finally{delete process.env.STRIPE_SECRET_KEY;}
 for(const invalid of [{...defaultPaymentSettings,venmo:{...defaultPaymentSettings.venmo,enabled:true}},{...defaultPaymentSettings,venmo:{...defaultPaymentSettings.venmo,username:'bad name!'}},{...defaultPaymentSettings,stripe:{...defaultPaymentSettings.stripe,feePercent:-1}}])assert.equal(paymentSettingsSchema.safeParse(invalid).success,false);
});
test('PayPal.Me links carry the amount and fees order options for the actual total',()=>{
 const settings={...defaultPaymentSettings,otherMethods:[{...defaultFees.PayPal,type:'PayPal',url:'https://paypal.me/DwightsGutters',instructions:''},{...defaultFees['Card / digital wallet'],type:'Card / digital wallet',url:'https://square.link/u/abc',instructions:''},{type:'Other',url:'',instructions:'Flat-fee app',feePercent:0,feeCents:500}]};
 const small=invoicePaymentOptions(settings,{totalCents:1000});
 assert.equal(small.find(p=>p.type==='PayPal').url,'https://paypal.me/DwightsGutters/10.00');assert.equal(small.find(p=>p.type==='PayPal').exact,true);assert.equal(small.find(p=>p.type==='Card / digital wallet').exact,false);
 assert.equal(small.at(-1).type,'Other');
 assert.equal(invoicePaymentOptions(settings,{totalCents:100000})[0].type,'Other');
 assert.equal(invoicePaymentOptions({...settings,otherMethods:[{...settings.otherMethods[0],url:'https://www.paypal.com/paypalme/Dwight'}]},{totalCents:2550})[0].url,'https://www.paypal.com/paypalme/Dwight/25.50');
});
test('saved settings from the earlier link-based Payments migrate without losing Venmo',async()=>{
 await db.collection('settings').replaceOne({_id:'payments'},{revision:7,stripe:{enabled:true,url:'https://buy.stripe.com/old',instructions:'Old'},venmo:{enabled:true,url:'https://venmo.com/u/Old-Business',instructions:'Note it'},otherMethods:[{type:'Cash',url:'',instructions:'Cash ok'}]},{upsert:true});
 const migrated=await getPayments();
 assert.equal(migrated.revision,7);assert.equal(migrated.venmo.username,'Old-Business');assert.equal(migrated.venmo.enabled,true);assert.equal(migrated.venmo.feePercent,1.9);assert.equal(migrated.otherMethods[0].feeCents,0);assert.ok(!('url' in migrated.stripe));
});
test('older Staff payment options migrate without guessing the card processor or overwriting prior invoices',async()=>{
 await db.collection('settings').deleteOne({_id:'payments'});
 const legacy=[{type:'Venmo',url:'https://venmo.com/legacy-business',instructions:'Reference invoice.'},{type:'Card / digital wallet',url:'https://payments.example.test/legacy',instructions:''},{type:'Cash',url:'',instructions:'Cash accepted.'}];
 await db.collection('settings').updateOne({_id:'staff'},{$set:{payments:legacy}});
 const migrated=await getPayments();assert.equal(migrated.stripe.enabled,false);assert.equal(migrated.venmo.enabled,true);assert.equal(migrated.otherMethods.length,2);
 await savePayments({...migrated,venmo:{...migrated.venmo,enabled:false}},actor);
 assert.equal((await getPayments()).venmo.enabled,false);
 const invoice=await db.collection('bookings').findOne({status:'completed'});assert.ok(invoice.invoice.payments.some(p=>p.type==='Venmo'));
});
test('downspout add-on joins a cleaning with its price and time, and is refused on other services',async()=>{
 await saveService('downspout-concern',{name:'Downspout concern',priceCents:4000,durationMinutes:30,active:true},actor);
 await saveService('gutter-repair',{name:'Gutter repair',priceCents:9500,durationMinutes:60,active:true},actor);
 const cleaning=await db.collection('services').findOne({_id:'gutter-cleaning'});
 const [slot]=await availableSlots('gutter-cleaning',date(20),['downspout-concern']);
 assert.equal((new Date(slot.endsAt)-new Date(slot.startsAt))/60000,cleaning.durationMinutes+30);
 const input={requestId:randomUUID(),serviceId:'gutter-cleaning',addOnIds:['downspout-concern'],startsAt:slot.startsAt,expectedPriceCents:cleaning.priceCents,name:'Add On',email:`addon-${randomUUID()}@example.com`,phone:'',contact:'Email',address:'9 Spout St',city:'Austin',zip:'78701',stories:'One story',guards:'No',notes:'',consent:true};
 await assert.rejects(createBooking(input),/price has changed/);
 const receipt=await createBooking({...input,requestId:randomUUID(),expectedPriceCents:cleaning.priceCents+4000});
 const stored=await db.collection('bookings').findOne({_id:receipt.reference});
 assert.equal(stored.service.name,`${cleaning.name} + Downspout concern`);assert.equal(stored.service.priceCents,cleaning.priceCents+4000);assert.equal(stored.service.addOns[0].id,'downspout-concern');
 await assert.rejects(availableSlots('gutter-repair',date(21),['downspout-concern']),/add-on/);
 assert.ok((await availableSlots('gutter-repair',date(21))).length);
 await seed();const addon=await db.collection('services').findOne({_id:'downspout-concern'});assert.equal(addon.kind,'addon');assert.equal(addon.priceCents,4000);
});
test('completing a booking creates a one-time Stripe link for the exact total; a Stripe failure keeps it open',async()=>{
 const realFetch=globalThis.fetch,calls=[];process.env.STRIPE_SECRET_KEY='sk_test_sample';
 try{
  const current=await getPayments();await savePayments({...current,stripe:{...current.stripe,enabled:true},otherMethods:[{...defaultFees.Cash,type:'Cash',url:'',instructions:'Cash ok'}]},actor);
  const b=await book(22);await db.collection('bookings').updateOne({_id:b.receipt.reference},{$set:{startsAt:new Date(Date.now()-3600000)}});
  globalThis.fetch=async()=>({ok:false,json:async()=>({error:{message:'Invalid API key'}})});
  await assert.rejects(updateBooking(b.receipt.reference,'completed',actor,{totalCents:21000}),/Invalid API key/);
  assert.equal((await db.collection('bookings').findOne({_id:b.receipt.reference})).status,'confirmed');
  globalThis.fetch=async(url,init)=>{calls.push({url,key:init.headers['Idempotency-Key'],body:Object.fromEntries(init.body)});return{ok:true,json:async()=>url.endsWith('/prices')?{id:'price_123'}:{url:'https://buy.stripe.com/test_exact'}};};
  const [first,second]=await Promise.all([updateBooking(b.receipt.reference,'completed',actor,{totalCents:21000}),updateBooking(b.receipt.reference,'completed',actor,{totalCents:21000})]);
  assert.equal(first.invoice.number,second.invoice.number);
  const stripe=first.invoice.payments.find(p=>p.type==='Stripe');assert.equal(stripe.url,'https://buy.stripe.com/test_exact');assert.equal(stripe.exact,true);
  assert.deepEqual(first.invoice.payments.map(p=>p.type),['Cash','Stripe']);
  const price=calls.find(c=>c.url.endsWith('/prices'));assert.equal(price.body.unit_amount,'21000');assert.equal(price.body.currency,'usd');assert.ok(price.key.includes(b.receipt.reference));
  const link=calls.find(c=>c.url.endsWith('/payment_links'));assert.equal(link.body['line_items[0][price]'],'price_123');assert.equal(link.body['restrictions[completed_sessions][limit]'],'1');
  assert.equal(new Set(calls.filter(c=>c.url.endsWith('/prices')).map(c=>c.key)).size,1);
 }finally{globalThis.fetch=realFetch;delete process.env.STRIPE_SECRET_KEY;}
});
test('calendar dates skip closed weekdays, the minimum notice window and days past the horizon',()=>{
 const schedule={enabled:true,leadHours:48,horizonDays:14,bufferMinutes:0,weekly:Array.from({length:7},(_,i)=>({day:i+1,enabled:i+1!==6,start:'09:00',end:'17:00'})),exceptions:[]};
 const dates=openDates({active:true,priceCents:100,durationMinutes:60},schedule,[],new Date('2026-10-31T15:00:00Z'));
 assert.equal(dates[0],'2026-11-02');for(const closed of ['2026-10-31','2026-11-01','2026-11-07','2026-11-14'])assert.ok(!dates.includes(closed),closed);
 assert.equal(dates.at(-1),'2026-11-13');assert.deepEqual(openDates({active:true,priceCents:100,durationMinutes:60},{...schedule,enabled:false}),[]);
});
test('appointment changes offer only dates at least 48 hours out',async()=>{
 const b=await book(30);const details=await getChangeDetails(b.token);
 assert.ok(details.dates.length);assert.ok(details.dates.every(d=>d>=DateTime.now().setZone('America/Chicago').plus({hours:48}).toISODate()));
});
