'use client';
import { invoicePaymentOptions } from '../lib/paymentOptions.mjs';
import { useEffect, useRef, useState } from 'react';
const money = cents => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
export default function CompleteJob({ booking, payments, stripeReady, busy, onCancel, onComplete }) {
  const [total, setTotal] = useState((booking.service.priceCents / 100).toFixed(2));
  const totalCents = Math.round(Number(total) * 100) || 0;
  // Stripe needs at least $0.50 and a connected account to make a link.
  const methods = invoicePaymentOptions(payments, { totalCents, stripeUrl: stripeReady && totalCents >= 50 ? 'preview' : null });
  const panel = useRef(null);
  useEffect(() => { panel.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, []);
  const addOns = booking.service.addOns || [];
  return <section ref={panel} className="customer-editor" aria-label="Complete booking and invoice"><h3>Booking complete — send invoice</h3><p><strong>{booking.name}</strong> · {booking.service.name}<br/>{booking.email}</p>{addOns.length > 0 && <p className="fine">Booked at {money(booking.service.priceCents)}: {booking.service.name.split(' + ')[0]} {money(booking.service.priceCents - addOns.reduce((t, a) => t + a.priceCents, 0))}{addOns.map(a => ` + ${a.name} ${money(a.priceCents)}`).join('')}</p>}<form onSubmit={e => { e.preventDefault(); onComplete(totalCents); }}><label>Final invoice total (USD, including any applicable taxes)<input type="number" inputMode="decimal" required min="0" max="10000" step="0.01" value={total} onChange={e => setTotal(e.target.value)}/></label><p className="fine">The booked price is prefilled. Change it if the job grew or shrank. Payment links on the invoice use this exact total.</p><p>Payment options, lowest fee first:</p>{methods.length ? <ol className="payment-order">{methods.map((p, i) => <li key={p.type + i}>{p.type} <small>{p.estimatedFeeCents ? `about ${money(p.estimatedFeeCents)} in fees` : 'no fee'}{p.url && !p.exact ? ' · customer enters the amount' : ''}</small></li>)}</ol> : <p className="notice">No payment options are turned on. Add them in Payments first.</p>}<div className="actions"><button className="button" disabled={busy || !methods.length}>{busy ? 'Sending…' : 'Booking complete — email invoice →'}</button><button type="button" className="text-link" disabled={busy} onClick={onCancel}>Back</button></div></form></section>;
}
