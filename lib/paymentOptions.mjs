export const otherPaymentTypes = ['Card / digital wallet', 'PayPal', 'Zelle', 'Cash', 'Check', 'Bank transfer', 'Other'];
// Typical US small-business processing fees as of 2026. Each is editable in Payments.
export const defaultFees = {
  Stripe: { feePercent: 2.9, feeCents: 30 }, Venmo: { feePercent: 1.9, feeCents: 10 },
  'Card / digital wallet': { feePercent: 2.9, feeCents: 30 }, PayPal: { feePercent: 3.49, feeCents: 49 },
  Zelle: { feePercent: 0, feeCents: 0 }, Cash: { feePercent: 0, feeCents: 0 }, Check: { feePercent: 0, feeCents: 0 },
  'Bank transfer': { feePercent: 0, feeCents: 0 }, Other: { feePercent: 0, feeCents: 0 },
};
export const newOtherMethod = (type = 'Cash') => ({ type, url: '', instructions: '', ...defaultFees[type] });
export const defaultPaymentSettings = {
  revision: 0,
  stripe: { enabled: false, instructions: 'Pay securely by card, Apple Pay, or Google Pay.', ...defaultFees.Stripe },
  venmo: { enabled: false, username: '', instructions: 'Include your invoice number in the payment note.', ...defaultFees.Venmo },
  otherMethods: [],
};
export const feeFor = (method, totalCents) => totalCents ? Math.round(totalCents * method.feePercent / 100) + method.feeCents : 0;
const dollars = cents => (cents / 100).toFixed(2);
const venmoLink = (username, totalCents, note) => `https://venmo.com/?txn=pay&audience=private&recipients=${encodeURIComponent(username.replace(/^@/, ''))}&amount=${dollars(totalCents)}&note=${encodeURIComponent(note)}`;
// PayPal.Me links accept the amount as a trailing path segment.
function paypalLink(url, totalCents) {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter(Boolean);
    const isMe = /(^|\.)paypal\.me$/.test(parsed.hostname) ? parts.length === 1 : /(^|\.)paypal\.com$/.test(parsed.hostname) && parts[0] === 'paypalme' && parts.length === 2;
    return isMe ? `${parsed.origin}/${parts.join('/')}/${dollars(totalCents)}` : null;
  } catch { return null; }
}
// Invoice options for one total, cheapest fee first. Stripe appears only with a link made
// for this exact total. `exact` marks links that already carry the amount.
export function invoicePaymentOptions(settings, { totalCents, note = '', stripeUrl = null }) {
  const options = [
    ...(settings.stripe.enabled && stripeUrl ? [{ type: 'Stripe', url: stripeUrl, exact: true, instructions: settings.stripe.instructions, feePercent: settings.stripe.feePercent, feeCents: settings.stripe.feeCents }] : []),
    ...(settings.venmo.enabled ? [{ type: 'Venmo', url: venmoLink(settings.venmo.username, totalCents, note), exact: true, instructions: settings.venmo.instructions, feePercent: settings.venmo.feePercent, feeCents: settings.venmo.feeCents }] : []),
    ...settings.otherMethods.map(method => {
      const amountLink = method.type === 'PayPal' && method.url ? paypalLink(method.url, totalCents) : null;
      return { ...method, url: amountLink || method.url, exact: Boolean(amountLink) };
    }),
  ];
  return options.map(option => ({ ...option, estimatedFeeCents: feeFor(option, totalCents) })).sort((a, b) => a.estimatedFeeCents - b.estimatedFeeCents);
}
