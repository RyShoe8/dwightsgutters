import { z } from 'zod';
import { storyOptions, cleaningServiceIds } from './pricing.mjs';
import { formatPhone } from './phone.mjs';
export const phoneSchema = z.string().trim().max(40).transform(formatPhone);
export const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
export const emailSchema = z.string().trim().toLowerCase().email().max(254);
const optionalEmail = z.string().trim().toLowerCase().max(254).refine(v => !v || z.string().email().safeParse(v).success, { message: 'Enter a valid email address.' }).default('');
const validPhone = v => !v.phone || v.phone.replace(/\D/g, '').length >= 7;
const EMAIL_OR_PHONE = 'Enter an email address or a phone number.';
const short = z.string().trim().min(1).max(160);
const bookingFields = z.object({
  requestId: z.string().uuid(), serviceId: short, addOnIds: z.array(short).max(5).default([]), startsAt: z.string().datetime(), secondStartsAt: z.string().datetime().optional(),
  expectedPriceCents: z.number().int().min(0).max(1000000),
  name: short, email: optionalEmail, phone: phoneSchema.default(''),
  contact: z.enum(['Email', 'Phone']).default('Email'), address: short, city: short,
  zip: z.string().regex(/^\d{5}$/), stories: z.enum(storyOptions, { message: 'We work on one- and two-story homes only. Please contact Dwight about taller homes.' }),
  guards: z.enum(['Not sure', 'Yes', 'No']), notes: z.string().trim().max(2000).default(''), consent: z.literal(true),
  website: z.string().max(0).default(''),
});
// Customers give an email, a phone number or both. With only one, that's their preferred contact.
const withContactRule = schema => schema.refine(v => v.email || v.phone, { message: EMAIL_OR_PHONE }).refine(validPhone, { message: 'Enter a valid phone number.' }).transform(v => ({ ...v, contact: !v.email ? 'Phone' : !v.phone ? 'Email' : v.contact }));
export const bookingSchema = withContactRule(bookingFields);
// Added by staff for a customer: no consent box or spam field, since the customer isn't filling in the form.
export const adminBookingSchema = withContactRule(bookingFields.omit({ consent: true, website: true }));
// Null two-story price means two-story homes pay the standard price; omitted keeps the saved one.
export const serviceSchema = z.object({ name: short, priceCents: z.number().int().min(0).max(1000000).nullable(), twoStoryPriceCents: z.number().int().min(0).max(1000000).nullable().optional(), hourlyRateCents: z.number().int().min(0).max(100000).nullable().optional(), appliesTo: z.array(z.enum(cleaningServiceIds)).max(cleaningServiceIds.length).optional(), addOnDurationMinutes: z.number().int().min(30).max(480).multipleOf(30).nullable().optional(), secondVisitDiscountCents: z.number().int().min(0).max(100000).nullable().optional(), twoStoryDurationMinutes: z.number().int().min(30).max(480).multipleOf(30).nullable().optional(), durationMinutes: z.number().int().min(30).max(480).multipleOf(30), active: z.boolean() }).refine(v => !v.active || v.priceCents !== null, { message: 'Set a price before enabling a service.' });
const time = z.string().regex(/^(0[0-9]|1[0-9]|2[0-3]):(00|30)$/);
const windowSchema = z.object({ enabled: z.boolean(), start: time, end: time }).refine(v => !v.enabled || v.start < v.end, { message: 'Closing time must be after opening time.' });
export const scheduleSchema = z.object({
  enabled: z.boolean(), leadHours: z.number().int().min(1).max(720), horizonDays: z.number().int().min(1).max(180), bufferMinutes: z.number().int().min(0).max(120).multipleOf(30),
  weekly: z.array(z.object({ day: z.number().int().min(1).max(7), ...windowSchema.shape }).refine(v => !v.enabled || v.start < v.end)).length(7),
  exceptions: z.array(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), ...windowSchema.shape }).refine(v => !v.enabled || v.start < v.end)).max(365),
}).refine(v => new Set(v.weekly.map(d => d.day)).size === 7 && new Set(v.exceptions.map(d => d.date)).size === v.exceptions.length, { message: 'Days and exception dates must be unique.' });
export const customerSchema = z.object({ name: short, email: optionalEmail, phone: phoneSchema.default(''), address: z.string().trim().max(160).optional(), city: z.string().trim().max(160).optional(), zip: z.string().regex(/^(\d{5})?$/).optional(), status: z.enum(['lead', 'active', 'inactive']), notes: z.string().trim().max(10000), marketingOptOut: z.boolean().default(false) }).refine(v => v.email || v.phone, { message: EMAIL_OR_PHONE }).refine(validPhone, { message: 'Enter a valid phone number.' });
