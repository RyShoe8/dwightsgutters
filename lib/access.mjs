import {z} from 'zod';
import {DateTime} from 'luxon';
import {database,transaction} from './db.mjs';
import {emailSchema,fail,scheduleSchema} from './validation.mjs';
export const primaryOwner='dwight@dwightsgutters.com';
export const roleFor=admin => admin?._id===primaryOwner ? 'owner' : admin?.role==='owner' ? 'owner' : 'staff';
export async function getAccess(email){
 const {db}=await database(); const admin=await db.collection('admins').findOne({_id:email,enabled:true});
 if(!admin) fail(401,'Please sign in to continue.');
 return {email,role:roleFor(admin)};
}
export function authorizeRoute(role,route,method){
 if(role==='owner') return;
 const allowed=(route==='admin/config'&&method==='GET') || (route==='admin/my-schedule'&&['GET','PUT'].includes(method)) || (route==='admin/bookings'&&['GET','POST'].includes(method)) || (['admin/booking-dates','admin/booking-slots'].includes(route)&&method==='GET') || (/^admin\/bookings\/[^/]+(?:\/(?:confirm|text|photos))?$/.test(route)&&['GET','POST','PATCH'].includes(method)) || (/^admin\/job-photos\/[^/]+\/(?:thumb|full)$/.test(route)&&method==='GET') || (/^admin\/job-photos\/[^/]+$/.test(route)&&method==='DELETE') || (route==='admin/record'&&method==='GET') || (route==='admin/replies'&&['GET','POST'].includes(method));
 if(!allowed) fail(403,'Only an Owner can access this area.');
}
export function authorizeTarget(role,type){if(role!=='owner'&&type!=='booking')fail(403,'Staff can access bookings only.');}
export async function listTeam(){const {db}=await database();const items=await db.collection('admins').find({},{projection:{name:1,role:1,enabled:1}}).sort({name:1}).toArray();return items.map(a=>({...a,role:roleFor(a)}));}
const memberSchema=z.object({email:emailSchema,name:z.string().trim().min(1).max(100),role:z.enum(['owner','staff']),enabled:z.boolean()});
export async function saveMember(input,actor){
 const data=memberSchema.parse(input);
 return transaction(async(db,session)=>{
  // Serialize membership changes, including requests racing an Owner's demotion.
  await db.collection('settings').updateOne({_id:'access'},{$inc:{revision:1}},{upsert:true,session});
  const editor=await db.collection('admins').findOne({_id:actor,enabled:true},{session});
  if(!editor||roleFor(editor)!=='owner')fail(403,'Only an Owner can manage staff access.');
  if(data.email===primaryOwner&&(data.role!=='owner'||!data.enabled))fail(409,'Dwight must remain an enabled Owner.');
  if(data.email===actor&&(!data.enabled||data.role!=='owner'))fail(409,'Another Owner must change your access.');
  await db.collection('admins').updateOne({_id:data.email},{$set:{name:data.name,role:data.role,enabled:data.enabled,updatedAt:new Date()},$setOnInsert:{createdAt:new Date()}},{upsert:true,session});
  if(!data.enabled){await db.collection('sessions').deleteMany({email:data.email},{session});await db.collection('loginTokens').deleteMany({email:data.email},{session});}
  await db.collection('audit').insertOne({actor,action:'staff.access.updated',target:data.email,at:new Date()},{session});
  return {ok:true};
 });
}
export async function personalSchedule(actor,input){
 const {db}=await database();
 if(input===undefined)return db.collection('staffSchedules').findOne({_id:actor});
 const data=scheduleSchema.parse(input);
 if(data.exceptions.some(d=>!DateTime.fromISO(d.date).isValid))fail(400,'An exception date is invalid.');
 await db.collection('staffSchedules').updateOne({_id:actor},{$set:{...data,timezone:'America/Chicago',updatedAt:new Date()}},{upsert:true});
 return {ok:true};
}
