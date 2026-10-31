export const otherPaymentTypes = ['Card / digital wallet', 'PayPal', 'Zelle', 'Cash', 'Check', 'Bank transfer', 'Other'];
export const defaultPaymentSettings = {
  revision: 0,
  stripe: { enabled: false, url: '', instructions: 'Include your invoice number with your payment.' },
  venmo: { enabled: false, url: '', instructions: 'Include your invoice number in the payment note.' },
  otherMethods: [],
};
export function enabledPaymentMethods(settings) {
  return [
    ...(settings.stripe.enabled ? [{ type: 'Stripe', url: settings.stripe.url, instructions: settings.stripe.instructions }] : []),
    ...(settings.venmo.enabled ? [{ type: 'Venmo', url: settings.venmo.url, instructions: settings.venmo.instructions }] : []),
    ...settings.otherMethods,
  ];
}
