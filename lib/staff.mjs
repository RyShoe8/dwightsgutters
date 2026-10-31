import { z } from 'zod';
import { database } from './db.mjs';
import { businessPhone } from './business.mjs';
export const defaultStaff = { name: 'Dwight', phone: '' };
export const staffSchema = z.object({
  name: z.string().trim().min(1).max(100),
  phone: z.string().trim().max(40).refine(value => !value || value.replace(/\D/g, '').length >= 7, 'Enter a phone number or leave blank to use the main business number.'),
});
export const staffPhone = staff => staff?.phone || businessPhone;
export async function getStaff(db, session) {
  if (!db) ({ db } = await database());
  const stored = await db.collection('settings').findOne({ _id: 'staff' }, { session });
  return staffSchema.parse(stored || defaultStaff);
}
export async function saveStaff(input, actor) {
  const data = staffSchema.parse(input);
  const { db } = await database();
  await db.collection('settings').updateOne({ _id: 'staff' }, { $set: { ...data, updatedBy: actor, updatedAt: new Date() } }, { upsert: true });
  return data;
}
