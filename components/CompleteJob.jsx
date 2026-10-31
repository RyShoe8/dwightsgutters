'use client';
import { enabledPaymentMethods } from '../lib/paymentOptions.mjs';
import { useEffect, useRef, useState } from 'react';
export default function CompleteJob({ booking, payments, busy, onCancel, onComplete }) {
  const methods = enabledPaymentMethods(payments);
  const [total, setTotal] = useState((booking.service.priceCents / 100).toFixed(2));
  const panel = useRef(null);
  useEffect(() => { panel.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, []);
  return <section ref={panel} className="customer-editor" aria-label="Complete job and invoice"><h3>Complete job & send invoice</h3><p><strong>{booking.name}</strong> · {booking.service.name}<br/>{booking.email}</p><form onSubmit={e => { e.preventDefault(); onComplete(Math.round(Number(total) * 100)); }}><label>Final invoice total (USD, including any applicable taxes)<input type="number" required min="0" max="10000" step="0.01" value={total} onChange={e => setTotal(e.target.value)}/></label><p className="fine">The starting price is prefilled. Confirm the final amount agreed with the customer. Completing the job saves this invoice and queues its email once.</p><p>Accepted payment options: {methods.map(p => p.type).join(', ') || 'None configured — add options in Payments first.'}</p><div className="actions"><button className="button" disabled={busy || !methods.length}>Job Completed — email invoice →</button><button type="button" className="text-link" disabled={busy} onClick={onCancel}>Back</button></div></form></section>;
}
