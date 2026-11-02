import { z } from 'zod';
import { adminNotification, queueEmail } from './email.mjs';
import { database, transaction } from './db.mjs';
import { emailSchema, phoneSchema } from './validation.mjs';
import { formatPhone } from './phone.mjs';
export const inquirySchema = z.object({ requestId: z.string().uuid(), name: z.string().trim().min(1).max(160), email: emailSchema, callback: z.boolean(), phone: phoneSchema.default(''), message: z.string().trim().min(10).max(4000), website: z.string().max(0).default(''), consent: z.literal(true) }).refine(v => !v.callback || v.phone.replace(/\D/g, '').length >= 7, { message: 'Enter a phone number for your callback.', path: ['phone'] });
export async function saveInquiry(input, kind = 'inquiry') {
 const data = inquirySchema.parse(input);
 const {requestId,website,...details} = data;
 return transaction(async (db,session)=>{
  const existing=await db.collection('inquiries').findOne({_id:requestId},{session});
  if(!existing){
   const record={_id:requestId,...details,kind,createdAt:new Date()};
   await db.collection('inquiries').insertOne(record,{session});
   await queueEmail(db,adminNotification('inquiry',record),{session,id:`${requestId}-inquiry-admin`,kind:'notification'});
  }
  return {reference:requestId};
 });
}
export async function listContacts({ kind = 'customers', search = '', page = 0 } = {}) {
 const { db } = await database();
 const escaped = search.slice(0,100).replace(/[^a-zA-Z0-9_ -]/g, character => String.fromCharCode(92) + character);
 let digits = search.replace(/\D/g,''); if(digits.length === 11 && digits.startsWith('1')) digits=digits.slice(1);
 const phoneSearch = digits.length >= 3 ? digits.split('').join('\\D*') : escaped;
 const match = escaped ? { $or: ['name','email','phone'].map(key => ({ [key]: { $regex: key === 'phone' ? phoneSearch : escaped, $options: 'i' } })) } : {};
 if (kind === 'inquiries') { const filter = {...match, kind:{$in:['inquiry','lead']}}; const items=await db.collection('inquiries').find(filter).sort({createdAt:-1}).skip(page*25).limit(25).toArray(); return {items:items.map(c=>({...c,phone:formatPhone(c.phone)})),total:await db.collection('inquiries').countDocuments(filter)}; }
 const pipeline = [{$match:match},{$lookup:{from:'bookings',let:{customerId:'$_id'},pipeline:[{$match:{$expr:{$eq:['$customerId','$$customerId']}}},{$sort:{createdAt:-1}},{$limit:1},{$project:{address:1,city:1,zip:1}}],as:'history'}},{$set:{address:{$ifNull:['$address',{$arrayElemAt:['$history.address',0]}]},city:{$ifNull:['$city',{$arrayElemAt:['$history.city',0]}]},zip:{$ifNull:['$zip',{$arrayElemAt:['$history.zip',0]}]}}},{$project:{history:0}}];
 pipeline.push({$sort:{createdAt:-1}},{$facet:{items:[{$skip:page*25},{$limit:25}],count:[{$count:'total'}]}});
 const [result]=await db.collection('customers').aggregate(pipeline).toArray(); return {items:result.items.map(c=>({...c,phone:formatPhone(c.phone)})),total:result.count[0]?.total||0};
}
