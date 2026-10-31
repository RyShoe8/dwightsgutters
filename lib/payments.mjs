import { z } from 'zod';
import { database, transaction } from './db.mjs';
import { fail } from './validation.mjs';
import { defaultFees, defaultPaymentSettings, otherPaymentTypes } from './paymentOptions.mjs';
import { stripeReady } from './stripe.mjs';
const paymentUrl = z.union([z.literal(''), z.string().trim().max(2000).url().refine(value => {
  const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password;
}, 'Use an HTTPS payment link without credentials.')]);
const instructions = z.string().trim().max(1000);
const fee = { feePercent: z.number().min(0).max(20), feeCents: z.number().int().min(0).max(1000) };
const stripe = z.object({ enabled: z.boolean(), instructions, ...fee });
const venmo = z.object({ enabled: z.boolean(), username: z.string().trim().regex(/^(@?[A-Za-z0-9_-]{5,30})?$/, 'Enter your Venmo username, like @DwightsGutters.'), instructions, ...fee })
  .refine(value => !value.enabled || Boolean(value.username), 'Add your Venmo username before enabling Venmo.');
const otherMethod = z.object({ type: z.enum(otherPaymentTypes), url: paymentUrl, instructions, ...fee }).superRefine((value, ctx) => {
  if (['Card / digital wallet', 'PayPal'].includes(value.type) && !value.url) ctx.addIssue({ code: 'custom', message: `${value.type} needs a payment link.` });
  if (['Zelle', 'Check', 'Bank transfer', 'Other'].includes(value.type) && !value.instructions) ctx.addIssue({ code: 'custom', message: `Add instructions for ${value.type}.` });
});
export const paymentSettingsSchema = z.object({ revision: z.number().int().min(0), stripe, venmo, otherMethods: z.array(otherMethod).max(12) });
const venmoUsername = url => (url || '').match(/venmo\.com\/(?:u\/)?@?([A-Za-z0-9_-]{5,30})\/?$/i)?.[1] || '';
const withFees = (method, type) => { const fees = defaultFees[type] || defaultFees.Other; return { ...method, feePercent: method.feePercent ?? fees.feePercent, feeCents: method.feeCents ?? fees.feeCents }; };
// Earlier versions stored a fixed Stripe link and a Venmo profile URL, neither of which
// can carry an invoice amount. Stripe now needs an API key; Venmo keeps its username.
function normalize(stored) {
  const legacyVenmo = stored.venmo || {};
  const username = legacyVenmo.username ?? venmoUsername(legacyVenmo.url);
  return {
    revision: stored.revision || 0,
    stripe: withFees({ enabled: Boolean(stored.stripe?.enabled), instructions: stored.stripe?.instructions ?? defaultPaymentSettings.stripe.instructions, feePercent: stored.stripe?.feePercent, feeCents: stored.stripe?.feeCents }, 'Stripe'),
    venmo: withFees({ enabled: Boolean(legacyVenmo.enabled && username), username, instructions: legacyVenmo.instructions ?? defaultPaymentSettings.venmo.instructions, feePercent: legacyVenmo.feePercent, feeCents: legacyVenmo.feeCents }, 'Venmo'),
    otherMethods: (stored.otherMethods || []).map(({ type, url = '', instructions = '', feePercent, feeCents }) => withFees({ type, url, instructions, feePercent, feeCents }, type)),
  };
}
const dropUndefined = value => JSON.parse(JSON.stringify(value));
export async function getPayments(db, session) {
  if (!db) ({ db } = await database());
  const stored = await db.collection('settings').findOne({ _id: 'payments' }, { session });
  if (stored) return paymentSettingsSchema.parse(normalize(dropUndefined(stored)));
  // Preserve options configured in the earlier Staff settings until the first
  // Payments save. Do not guess which processor a generic card link belongs to.
  const legacy = await db.collection('settings').findOne({ _id: 'staff' }, { session });
  const methods = legacy?.payments || [];
  const venmoMethod = methods.find(p => p.type === 'Venmo');
  return paymentSettingsSchema.parse(normalize({ ...defaultPaymentSettings, venmo: venmoMethod ? { enabled: true, url: venmoMethod.url, instructions: venmoMethod.instructions } : defaultPaymentSettings.venmo, otherMethods: methods.filter(p => p.type !== 'Venmo') }));
}
export async function savePayments(input, actor) {
  const data = paymentSettingsSchema.parse(input);
  if (data.stripe.enabled && !stripeReady()) fail(409, 'Connect Stripe before turning it on: add STRIPE_SECRET_KEY to the site settings.');
  return transaction(async (db, session) => {
    const existing = await db.collection('settings').findOne({ _id: 'payments' }, { session });
    if ((existing?.revision || 0) !== data.revision) fail(409, 'Payment settings changed in another session. Reload before saving.');
    const next = { ...data, revision: data.revision + 1 };
    await db.collection('settings').replaceOne({ _id: 'payments' }, { ...next, updatedAt: new Date(), updatedBy: actor }, { upsert: true, session });
    await db.collection('audit').insertOne({ actor, action: 'payments.updated', target: 'payments', at: new Date() }, { session });
    return next;
  });
}
