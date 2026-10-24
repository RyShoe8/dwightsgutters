import { z } from 'zod';
export const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
export const emailSchema = z.string().trim().toLowerCase().email().max(254);
const short = z.string().trim().min(1).max(160);
export const bookingSchema = z.object({
  requestId: z.string().uuid(), serviceId: short, startsAt: z.string().datetime(),
  expectedPriceCents: z.number().int().min(0).max(1000000),
  name: short, email: emailSchema, phone: z.string().trim().max(40).default(''),
  contact: z.enum(['Email', 'Phone']), address: short, city: short,
  zip: z.string().regex(/^\d{5}$/), stories: z.enum(['One story', 'Two stories', 'Three or more / unsure']),
  guards: z.enum(['Not sure', 'Yes', 'No']), notes: z.string().trim().max(2000).default(''), consent: z.literal(true),
  website: z.string().max(0).default(''),
}).refine(v => v.contact !== 'Phone' || v.phone.length >= 7, { message: 'A phone number is required for phone contact.' });
export const serviceSchema = z.object({ name: short, priceCents: z.number().int().min(0).max(1000000).nullable(), durationMinutes: z.number().int().min(30).max(480).multipleOf(30), active: z.boolean() }).refine(v => !v.active || v.priceCents !== null, { message: 'Set a price before enabling a service.' });
const time = z.string().regex(/^(0[0-9]|1[0-9]|2[0-3]):(00|30)$/);
const windowSchema = z.object({ enabled: z.boolean(), start: time, end: time }).refine(v => !v.enabled || v.start < v.end, { message: 'Closing time must be after opening time.' });
export const scheduleSchema = z.object({
  enabled: z.boolean(), leadHours: z.number().int().min(1).max(720), horizonDays: z.number().int().min(1).max(180), bufferMinutes: z.number().int().min(0).max(120).multipleOf(30),
  weekly: z.array(z.object({ day: z.number().int().min(1).max(7), ...windowSchema.shape }).refine(v => !v.enabled || v.start < v.end)).length(7),
  exceptions: z.array(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), ...windowSchema.shape }).refine(v => !v.enabled || v.start < v.end)).max(365),
}).refine(v => new Set(v.weekly.map(d => d.day)).size === 7 && new Set(v.exceptions.map(d => d.date)).size === v.exceptions.length, { message: 'Days and exception dates must be unique.' });
export const customerSchema = z.object({ name: short, email: emailSchema, phone: z.string().trim().max(40), status: z.enum(['lead', 'active', 'inactive']), notes: z.string().trim().max(10000) });
