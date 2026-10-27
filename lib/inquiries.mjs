import { z } from 'zod';
import { database } from './db.mjs';
import { emailSchema } from './validation.mjs';
export const inquirySchema = z.object({ requestId: z.string().uuid(), name: z.string().trim().min(1).max(160), email: emailSchema, callback: z.boolean(), phone: z.string().trim().max(40).default(''), message: z.string().trim().min(10).max(4000), website: z.string().max(0).default(''), consent: z.literal(true) }).refine(v => !v.callback || v.phone.replace(/\D/g, '').length >= 7, { message: 'Enter a phone number for your callback.', path: ['phone'] });
export async function saveInquiry(input, kind = 'inquiry') {
 const data = inquirySchema.parse(input); const { db } = await database();
 const { requestId, website, ...details } = data;
 await db.collection('inquiries').updateOne({ _id: requestId }, { $setOnInsert: { ...details, kind, createdAt: new Date() } }, { upsert: true });
 return { reference: requestId };
}
export async function listContacts({ kind = 'customers', search = '', page = 0 } = {}) {
 const { db } = await database();
 const escaped = search.slice(0,100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
 const match = escaped ? { $or: ['name','email','phone'].map(key => ({ [key]: { $regex: escaped, $options: 'i' } })) } : {};
 if (kind === 'inquiries') { const filter = {...match, kind:'inquiry'}; return {items:await db.collection('inquiries').find(filter).sort({createdAt:-1}).skip(page*25).limit(25).toArray(),total:await db.collection('inquiries').countDocuments(filter)}; }
 const pipeline = [{$match:match},{$lookup:{from:'bookings',localField:'_id',foreignField:'customerId',as:'history'}},{$match:{'history.0':{$exists:kind==='customers'}}},{$project:{history:0}}];
 if(kind==='leads') pipeline.push({$unionWith:{coll:'inquiries',pipeline:[{$match:{...match,kind:'lead'}},{$lookup:{from:'bookings',localField:'email',foreignField:'email',as:'history'}},{$match:{'history.0':{$exists:false}}},{$project:{history:0}}]}});
 pipeline.push({$sort:{createdAt:-1}},{$facet:{items:[{$skip:page*25},{$limit:25}],count:[{$count:'total'}]}});
 const [result]=await db.collection('customers').aggregate(pipeline).toArray(); return {items:result.items,total:result.count[0]?.total||0};
}
