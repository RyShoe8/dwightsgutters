import { createHmac, timingSafeEqual } from 'node:crypto';
// Stripe's smallest USD card charge.
export const stripeMinimumCents = 50;
export const stripeReady = () => Boolean(process.env.STRIPE_SECRET_KEY);
async function call(path, params, idempotencyKey) {
  let response, data;
  try {
    response = await fetch(`https://api.stripe.com/v1/${path}`, { method: 'POST', headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Idempotency-Key': idempotencyKey }, body: new URLSearchParams(params) });
    data = await response.json();
  } catch { response = null; }
  if (!response?.ok) throw Object.assign(new Error(`Stripe couldn’t create the payment link${data?.error?.message ? `: ${data.error.message}` : '. Try again in a minute.'} The booking is still open.`), { status: 502 });
  return data;
}
// A one-time Stripe payment page for exactly this invoice total.
export async function createInvoiceLink({ bookingId, totalCents, description }) {
  if (!stripeReady()) throw Object.assign(new Error('Stripe is turned on in Payments but isn’t connected. Add STRIPE_SECRET_KEY to the site settings or turn Stripe off.'), { status: 503 });
  const key = `dg-${bookingId}-${totalCents}`;
  const price = await call('prices', { currency: 'usd', unit_amount: String(totalCents), 'product_data[name]': `Dwight’s Gutters — ${description}`.slice(0, 250), 'metadata[booking_id]': bookingId }, `${key}-price`);
  const link = await call('payment_links', { 'line_items[0][price]': price.id, 'line_items[0][quantity]': '1', 'restrictions[completed_sessions][limit]': '1', 'metadata[booking_id]': bookingId, 'payment_intent_data[metadata][booking_id]': bookingId }, `${key}-link`);
  return link.url;
}
// Verifies a Stripe webhook signature (Stripe-Signature: t=…,v1=…) and returns the event.
export function verifyStripeEvent(raw, header, secret = process.env.STRIPE_WEBHOOK_SECRET, now = Date.now()) {
  const reject = (status, message) => { throw Object.assign(new Error(message), { status }); };
  if (!secret) reject(503, 'Stripe webhooks are not configured.');
  const parts = String(header || '').split(',').map(part => part.split('='));
  const timestamp = parts.find(([key]) => key === 't')?.[1];
  const signatures = parts.filter(([key]) => key === 'v1').map(([, value]) => value);
  if (!timestamp || Math.abs(now / 1000 - Number(timestamp)) > 300) reject(400, 'Stale or missing Stripe signature.');
  const expected = Buffer.from(createHmac('sha256', secret).update(`${timestamp}.${raw}`).digest('hex'));
  if (!signatures.some(sig => sig.length === expected.length && timingSafeEqual(Buffer.from(sig), expected))) reject(400, 'Invalid Stripe signature.');
  return JSON.parse(raw);
}
