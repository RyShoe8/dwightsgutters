// PayPal and cash/check have their own setup cards; these are for anything else.
export const otherPaymentTypes = ['Card / digital wallet', 'Zelle', 'Bank transfer', 'Other'];
// Typical US small-business processing fees as of 2026. Each is editable in Payments.
export const defaultFees = {
  Stripe: { feePercent: 2.9, feeCents: 30 }, Venmo: { feePercent: 1.9, feeCents: 10 },
  'Card / digital wallet': { feePercent: 2.9, feeCents: 30 }, PayPal: { feePercent: 3.49, feeCents: 49 },
  'Cash or check': { feePercent: 0, feeCents: 0 }, Zelle: { feePercent: 0, feeCents: 0 },
  'Bank transfer': { feePercent: 0, feeCents: 0 }, Other: { feePercent: 0, feeCents: 0 },
};
export const newOtherMethod = (type = 'Zelle') => ({ type, url: '', instructions: '', ...defaultFees[type] });
export const defaultPaymentSettings = {
  revision: 0,
  stripe: { enabled: false, instructions: 'Pay securely by card, Apple Pay, or Google Pay.', ...defaultFees.Stripe },
  venmo: { enabled: false, username: '', instructions: 'Include your invoice number in the payment note.', ...defaultFees.Venmo },
  paypal: { enabled: false, username: '', instructions: 'Include your invoice number in the payment note.', ...defaultFees.PayPal },
  cashCheck: { enabled: false, instructions: 'Pay Dwight in cash, or make your check payable to Dwight’s Gutters.', ...defaultFees['Cash or check'] },
  otherMethods: [],
};
export const feeFor = (method, totalCents) => totalCents ? Math.round(totalCents * method.feePercent / 100) + method.feeCents : 0;
const dollars = cents => (cents / 100).toFixed(2);
const venmoLink = (username, totalCents, note) => `https://venmo.com/?txn=pay&audience=private&recipients=${encodeURIComponent(username.replace(/^@/, ''))}&amount=${dollars(totalCents)}&note=${encodeURIComponent(note)}`;
// PayPal.Me links accept the amount as a trailing path segment.
const paypalLink = (username, totalCents) => `https://paypal.me/${encodeURIComponent(username)}/${dollars(totalCents)}`;
// Invoice options for one total, cheapest fee first. Stripe appears only with a link made
// for this exact total. `exact` marks links that already carry the amount.
export function invoicePaymentOptions(settings, { totalCents, note = '', stripeUrl = null }) {
  const fees = method => ({ feePercent: method.feePercent, feeCents: method.feeCents });
  const options = [
    ...(settings.stripe.enabled && stripeUrl ? [{ type: 'Stripe', url: stripeUrl, exact: true, instructions: settings.stripe.instructions, ...fees(settings.stripe) }] : []),
    ...(settings.venmo.enabled ? [{ type: 'Venmo', url: venmoLink(settings.venmo.username, totalCents, note), exact: true, instructions: settings.venmo.instructions, ...fees(settings.venmo) }] : []),
    ...(settings.paypal.enabled ? [{ type: 'PayPal', url: paypalLink(settings.paypal.username, totalCents), exact: true, instructions: settings.paypal.instructions, ...fees(settings.paypal) }] : []),
    ...(settings.cashCheck.enabled ? [{ type: 'Cash or check', url: '', exact: false, instructions: settings.cashCheck.instructions, ...fees(settings.cashCheck) }] : []),
    ...settings.otherMethods.map(method => ({ ...method, exact: false })),
  ];
  return options.map(option => ({ ...option, estimatedFeeCents: feeFor(option, totalCents) })).sort((a, b) => a.estimatedFeeCents - b.estimatedFeeCents);
}
// How a completed job's payment can be recorded. Stripe is also recorded automatically.
export const paymentReceivedMethods = ['Cash or check', 'Stripe', 'Venmo', 'PayPal', 'Zelle', 'Bank transfer', 'Card / digital wallet', 'Other'];
