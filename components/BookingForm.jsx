'use client';
import PhoneInput from './PhoneInput';
import ContactForm from './ContactForm';
import DatePicker from './DatePicker';
import { priceFor, priceLabel, isHourly, rateLabel, storyOptions, addOnMinutes, isPlan } from '../lib/pricing.mjs';
import { useEffect, useState } from 'react';
const money = cents => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
// Loads open dates or times for a picker and clears the selection when it's no longer offered.
function useAvailability(url, setSelected, setError) {
  const [items, setItems] = useState([]), [loading, setLoading] = useState(false);
  useEffect(() => {
    setItems([]); if (!url) { setSelected(''); return; }
    const controller = new AbortController(); setLoading(true);
    fetch(url, { signal: controller.signal }).then(async r => { const data = await r.json(); if (!r.ok) throw Error(data.error); const list = data.dates || data.slots; setItems(list); setSelected(current => list.some(i => (i.startsAt || i) === current) ? current : ''); }).catch(e => { if (e.name !== 'AbortError') setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [url, setSelected, setError]);
  return [items, loading];
}
function TimeSelect({ label, date, slots, loading, value, onChange }) {
  return <><label>{label}<select required value={value} onChange={e => onChange(e.target.value)} disabled={loading || !slots.length}><option value="">{loading ? 'Checking times…' : !date ? 'Choose a date first' : !slots.length ? 'No times available on this date' : 'Choose a time'}</option>{slots.map(s => <option key={s.startsAt} value={s.startsAt}>{s.label}</option>)}</select></label>{date && !loading && !slots.length && <p role="status">Please try another date or email Dwight for help.</p>}</>;
}
export default function BookingForm() {
  const [zip, setZip] = useState('');
  const [catalog, setCatalog] = useState(null), [error, setError] = useState(''), [serviceId, setService] = useState(''), [date, setDate] = useState(''), [slot, setSlot] = useState(''), [date2, setDate2] = useState(''), [slot2, setSlot2] = useState(''), [busy, setBusy] = useState(false), [receipt, setReceipt] = useState(null), [requestId, setRequestId] = useState(''), [addOnIds, setAddOnIds] = useState([]), [stories, setStories] = useState(storyOptions[0]), [contact, setContact] = useState('Email');
  useEffect(() => { setRequestId(crypto.randomUUID()); const params = new URLSearchParams(location.search); const requestedZip = params.get('zip'); if (/^\d{5}$/.test(requestedZip || '')) setZip(requestedZip); fetch('/api/catalog/').then(async r => { const data = await r.json(); if (!r.ok) throw Error(data.error); setCatalog(data); const id = data.services.find(s => s.name === params.get('service'))?._id || data.services[0]?._id || ''; setService(id); setAddOnIds((data.addOns || []).filter(a => a.name === params.get('addon') && a.appliesTo.includes(id)).map(a => a._id)); }).catch(e => setError(e.message)); }, []);
  const addOnQuery = addOnIds.length ? `&addOns=${encodeURIComponent(addOnIds.join(','))}` : '';
  const service = serviceId && `service=${encodeURIComponent(serviceId)}`;
  const baseService = catalog?.services.find(s => s._id === serviceId);
  const plan = isPlan(baseService);
  const [dates, datesLoading] = useAvailability(service && `/api/dates/?${service}${addOnQuery}`, setDate, setError);
  const [slots, slotsLoading] = useAvailability(service && date && `/api/slots/?${service}&date=${date}${addOnQuery}`, setSlot, setError);
  // Seasonal upkeep's second cleaning: offered at least 60 days after the first, up to a year out.
  const [dates2, dates2Loading] = useAvailability(plan && date && `/api/dates/?${service}&visit=2&after=${date}`, setDate2, setError);
  const [slots2, slots2Loading] = useAvailability(plan && date2 && `/api/slots/?${service}&visit=2&date=${date2}`, setSlot2, setError);
  const availableAddOns = (catalog?.addOns || []).filter(a => a.appliesTo.includes(serviceId));
  const chosenAddOns = availableAddOns.filter(a => addOnIds.includes(a._id));
  const firstPrice = baseService ? priceFor(baseService, stories) + chosenAddOns.reduce((t, a) => t + a.priceCents, 0) : 0;
  const minutes = baseService ? baseService.durationMinutes + chosenAddOns.reduce((t, a) => t + addOnMinutes(a), 0) : 0;
  const basePrice = baseService ? priceFor(baseService, stories) : 0;
  const discount = plan ? Math.min(basePrice, baseService.secondVisitDiscountCents || 0) : 0;
  const secondPrice = plan ? basePrice - discount : 0;
  function chooseService(id) { setService(id); setDate2(''); setSlot2(''); setAddOnIds(ids => ids.filter(a => catalog.addOns?.find(x => x._id === a)?.appliesTo.includes(id))); }
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    const data = Object.fromEntries(new FormData(event.currentTarget));
    if (!catalog.enabledZips?.includes(data.zip)) { setError('Online booking is not available in this ZIP code. Check the service-area map or email Dwight.'); setBusy(false); return; }
    try {
      const response = await fetch('/api/bookings/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...data, requestId, serviceId, addOnIds: chosenAddOns.map(a => a._id), startsAt: slot, ...(plan ? { secondStartsAt: slot2 } : {}), expectedPriceCents: firstPrice + secondPrice, consent: data.consent === 'on' }) });
      const result = await response.json(); if (!response.ok) throw Error(result.error); setReceipt(result);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  if (receipt) {
    const pending = receipt.status === 'pending', byText = receipt.delivery === 'text';
    return <section role="status"><span className="success-icon">✓</span><p className="eyebrow">{pending ? 'REQUEST RECEIVED' : 'BOOKING CONFIRMED'}</p><h2>{pending ? 'Thanks! Dwight will confirm shortly.' : 'You’re on the calendar.'}</h2>
      <p><strong>{receipt.service}</strong><br/>{receipt.second ? 'First cleaning: ' : ''}{receipt.when}<br/>Starting at {money(receipt.priceCents)}</p>
      {receipt.second && <p><strong>Second cleaning:</strong> {receipt.second.when}<br/>{money(receipt.second.priceCents)}{receipt.second.discountCents ? ` (you save ${money(receipt.second.discountCents)})` : ''}<br/><span className="fine">We’ll email you a month before to confirm it.</span></p>}
      <p className="fine">Reference: {receipt.reference}</p>
      <p>{pending ? `Because you left a note, Dwight will read it and confirm your booking by ${byText ? 'text' : 'email'}. Your time is held for you.` : byText ? 'Dwight will text you a confirmation with your details and a link to change your time.' : receipt.emailStatus === 'captured' ? 'Local test: the confirmation email was captured in the development inbox. No email was sent.' : receipt.emailStatus === 'accepted' ? 'Your confirmation has been submitted for email delivery.' : 'Your booking is saved. Your confirmation email is queued for delivery.'}</p>
      <p>Dwight will confirm the final scope and price before work begins. You can change your time online up to 48 hours ahead using the link you’ll receive. For other questions, <a href="/contact/">contact Dwight</a>.</p><a className="button" href="/">Back to homepage →</a></section>;
  }
  if (!catalog || !catalog.enabled) return <div role="status"><p className="eyebrow">LET’S TALK GUTTERS</p><h2>{!catalog && !error ? 'Checking availability…' : 'Scheduling opens soon.'}</h2><p>{error || (catalog ? 'Online appointments aren’t open yet. Send Dwight a cleaning request and he’ll help you plan a visit.' : 'Looking up services and appointment times.')}</p>{(catalog || error) && <ContactForm bookingRequest/>}</div>;
  return <form onSubmit={submit} aria-label="Book a cleaning"><fieldset disabled={busy}><legend>Choose your service.</legend>
    <label>Service<select value={serviceId} onChange={e => chooseService(e.target.value)} required>{catalog.services.map(s => <option key={s._id} value={s._id}>{s.name} — {priceLabel(s, stories)}{isPlan(s) ? ' per cleaning' : ''}</option>)}</select></label>
    {plan && <p className="notice">Seasonal upkeep is two cleanings a year. Pick both dates below and save {money(discount)} on the second cleaning.</p>}
    <label>Home height<select name="stories" required value={stories} onChange={e => setStories(e.target.value)}>{storyOptions.map(o => <option key={o}>{o}</option>)}</select></label><p className="fine">We work on one- and two-story homes. Taller home? <a href="/contact/">Contact Dwight</a>.</p>
    {availableAddOns.map(a => <label className="checkbox" key={a._id}><input type="checkbox" checked={addOnIds.includes(a._id)} onChange={e => setAddOnIds(ids => e.target.checked ? [...ids, a._id] : ids.filter(id => id !== a._id))}/><span>Add {a.name.toLowerCase()} — {isHourly(a) ? `from ${money(a.priceCents)}, about ${addOnMinutes(a)} more minutes reserved. Large repairs quoted before work begins.` : `${priceLabel(a)}, about ${addOnMinutes(a)} more minutes reserved`}{plan ? ' (first cleaning)' : ''}</span></label>)}
    {plan ? <dl className="plan-summary" aria-label="Seasonal plan price"><div><dt>Cleaning 1<span>{minutes} minutes reserved</span></dt><dd>{money(firstPrice)}</dd></div><div><dt>Cleaning 2<span className="plan-save">Save {money(discount)}</span></dt><dd>{money(secondPrice)}</dd></div><div className="plan-total"><dt>Plan total<span>Both cleanings</span></dt><dd>{money(firstPrice + secondPrice)}</dd></div></dl>
      : <p className="booking-price">From <strong>{money(firstPrice)}</strong> <span>· {minutes} minutes reserved</span></p>}
    {isHourly(baseService || {}) && <p className="fine">{baseService.name} is billed by the hour: {rateLabel(baseService)}. The final total depends on the time the repair takes.</p>}
    <p className="fine">Starting price. Final scope and price confirmed before work. No online payment.</p>
    {plan && <h3>Cleaning 1</h3>}
    <DatePicker label={plan ? 'Cleaning 1 date · Austin time' : 'Appointment date · Austin time'} dates={dates} loading={datesLoading} value={date} onChange={setDate}/>
    <TimeSelect label="Available arrival time" date={date} slots={slots} loading={slotsLoading} value={slot} onChange={setSlot}/>
    {plan && <><h3>Cleaning 2</h3><p className="fine">At least 60 days after your first cleaning, up to a year out. We’ll email you a month before to confirm it.</p>{date ? <><DatePicker label="Cleaning 2 date · Austin time" dates={dates2} loading={dates2Loading} value={date2} onChange={setDate2}/><TimeSelect label="Available arrival time" date={date2} slots={slots2} loading={slots2Loading} value={slot2} onChange={setSlot2}/></> : <p role="status">Choose your first cleaning date to see options.</p>}</>}
    <hr className="form-divider"/><h3>Your details</h3><p className="fine">Bookings are available only in enabled ZIP codes. <a href="/service-area/" target="_blank" rel="noreferrer">Check the service-area map ↗</a></p>
    <div className="field-grid"><label>Your name<input name="name" required autoComplete="name" maxLength={160}/></label><label>Email address<input name="email" type="email" required autoComplete="email" maxLength={254}/></label><label>Phone number<PhoneInput name="phone" autoComplete="tel" maxLength={40} required={contact === 'Phone'}/></label><label>Preferred contact<select name="contact" value={contact} onChange={e => setContact(e.target.value)}><option>Email</option><option>Phone</option></select></label></div>
    {contact === 'Phone' && <p className="fine">Dwight will text your confirmation and invoice to this number.</p>}
    <label>Street address<input name="address" required autoComplete="street-address" maxLength={160}/></label><div className="field-grid"><label>City<input name="city" required autoComplete="address-level2" defaultValue="Austin" maxLength={160}/></label><label>ZIP code<input name="zip" value={zip} onChange={e => setZip(e.target.value)} required autoComplete="postal-code" pattern="[0-9]{5}" maxLength={5} inputMode="numeric"/></label><label>Gutter guards?<select name="guards"><option>Not sure</option><option>Yes</option><option>No</option></select></label></div><p className="fine" role="status">{zip.length === 5 ? catalog.enabledZips?.includes(zip) ? `ZIP ${zip} is in our active service area.` : `Online booking is not available in ZIP ${zip}. Please email Dwight.` : ""}</p>
    <label>Anything else we should know?<textarea name="notes" rows={3} maxLength={2000} placeholder="Access, visible overflow, or specific concerns" aria-describedby="notes-help"/></label><p id="notes-help" className="fine">Leave this blank to confirm your booking instantly. If you add a note, Dwight will read it and confirm your booking himself.</p>
    <div hidden><label>Leave this empty<input name="website" tabIndex={-1} autoComplete="off"/></label></div><label className="checkbox"><input name="consent" type="checkbox" required/><span>I authorize Dwight’s Gutters to save my details and contact me about this booking. I understand the displayed price is a starting price and no payment is being collected. I agree to the <a href="/terms/" target="_blank" rel="noopener">Terms of Service</a> and <a href="/privacy-policy/" target="_blank" rel="noopener">Privacy Policy</a>.</span></label>{error && <p className="notice error" role="alert">{error}</p>}<button className="button" disabled={busy || !slot || (plan && !slot2)}>{busy ? 'Reserving your time…' : plan ? 'Book both cleanings →' : 'Confirm booking →'}</button><p className="fine">Your appointment is reserved only after confirmation appears.</p></fieldset></form>;
}
