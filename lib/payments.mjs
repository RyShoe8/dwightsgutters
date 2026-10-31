import { z } from 'zod';
import { database, transaction } from './db.mjs';
import { fail } from './validation.mjs';
import { defaultPaymentSettings, otherPaymentTypes } from './paymentOptions.mjs';
const paymentUrl = z.union([z.literal(''), z.string().trim().max(2000).url().refine(value => {
  const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password;
}, 'Use an HTTPS payment link without credentials.')]);
const instructions = z.string().trim().max(1000);
const provider = z.object({ enabled: z.boolean(), url: paymentUrl, instructions }).refine(value => !value.enabled || Boolean(value.url), 'Add a payment link before enabling this method.');
const otherMethod = z.object({ type: z.enum(otherPaymentTypes), url: paymentUrl, instructions }).superRefine((value, ctx) => {
  if (['Card / digital wallet', 'PayPal'].includes(value.type) && !value.url) ctx.addIssue({ code: 'custom', message: `${value.type} needs a payment link.` });
  if (['Zelle', 'Check', 'Bank transfer', 'Other'].includes(value.type) && !value.instructions) ctx.addIssue({ code: 'custom', message: `Add instructions for ${value.type}.` });
});
export const paymentSettingsSchema = z.object({ revision: z.number().int().min(0), stripe: provider, venmo: provider, otherMethods: z.array(otherMethod).max(12) });
export async function getPayments(db, session) {
  if (!db) ({ db } = await database());
  const stored = await db.collection('settings').findOne({ _id: 'payments' }, { session });
  if (stored) return paymentSettingsSchema.parse(stored);
  // Preserve options configured in the earlier Staff settings until the first
  // Payments save. Do not guess which processor a generic card link belongs to.
  const legacy = await db.collection('settings').findOne({ _id: 'staff' }, { session });
  const methods = legacy?.payments || [];
  const venmo = methods.find(p => p.type === 'Venmo');
  return paymentSettingsSchema.parse({ ...defaultPaymentSettings, venmo: venmo ? { enabled: true, url: venmo.url, instructions: venmo.instructions } : defaultPaymentSettings.venmo, otherMethods: methods.filter(p => p.type !== 'Venmo') });
}
export async function savePayments(input, actor) {
  const data = paymentSettingsSchema.parse(input);
  return transaction(async (db, session) => {
    const existing = await db.collection('settings').findOne({ _id: 'payments' }, { session });
    if ((existing?.revision || 0) !== data.revision) fail(409, 'Payment settings changed in another session. Reload before saving.');
    const next = { ...data, revision: data.revision + 1 };
    await db.collection('settings').updateOne({ _id: 'payments' }, { $set: { ...next, updatedAt: new Date(), updatedBy: actor } }, { upsert: true, session });
    await db.collection('audit').insertOne({ actor, action: 'payments.updated', target: 'payments', at: new Date() }, { session });
    return next;
  });
}
