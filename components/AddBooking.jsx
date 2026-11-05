'use client';
import { useEffect, useState } from 'react';
import BrandedSelect from './BrandedSelect';
import DatePicker from './DatePicker';
import PhoneInput from './PhoneInput';
import TimePicker from './TimePicker';
import { useAvailability } from './BookingForm';
import { addOnMinutes, defaultSecondDate, isPlan, minutesFor, money, priceFor, priceLabel, storyOptions } from '../lib/pricing.mjs';
// Owners and staff add a booking for a customer, such as one who called. Offers every open time
// within business hours, including times online customers can't book (see adminSchedule).
export default function AddBooking({ onSave, onCancel }) {
  const [requestId] = useState(() => crypto.randomUUID());
  const [catalog, setCatalog] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [serviceId, setServiceId] = useState(''), [stories, setStories] = useState(storyOptions[0]), [addOnIds, setAddOnIds] = useState([]), [contact, setContact] = useState('Email'), [email, setEmail] = useState(''), [phone, setPhone] = useState(''), [zip, setZip] = useState('');
  const [date, setDate] = useState(''), [slot, setSlot] = useState(''), [date2, setDate2] = useState(''), [date2Chosen, setDate2Chosen] = useState(false), [slot2, setSlot2] = useState('');
  useEffect(() => { fetch('/api/catalog/').then(async response => { const data = await response.json(); if (!response.ok) throw Error(data.error); setCatalog(data); setServiceId(data.services[0]?._id || ''); }).catch(e => setError(e.message)); }, []);
  const base = catalog?.services.find(s => s._id === serviceId), plan = isPlan(base);
  const service = serviceId && `service=${encodeURIComponent(serviceId)}&stories=${encodeURIComponent(stories)}`;
  const addOnQuery = addOnIds.length ? `&addOns=${encodeURIComponent(addOnIds.join(','))}` : '';
  const [dates, datesLoading] = useAvailability(service && `/api/admin/booking-dates/?${service}${addOnQuery}`, setDate, setError);
  const [slots, slotsLoading] = useAvailability(service && date && `/api/admin/booking-slots/?${service}&date=${date}${addOnQuery}`, setSlot, setError);
  const [dates2, dates2Loading] = useAvailability(plan && date && `/api/admin/booking-dates/?${service}&visit=2&after=${date}`, setDate2, setError);
  const [slots2, slots2Loading] = useAvailability(plan && date2 && `/api/admin/booking-slots/?${service}&visit=2&date=${date2}`, setSlot2, setError);
  useEffect(() => { if (plan && date && !date2Chosen && dates2.length) setDate2(defaultSecondDate(date, dates2)); }, [plan, date, date2Chosen, dates2]);
  const addOns = (catalog?.addOns || []).filter(a => a.appliesTo.includes(serviceId)), chosen = addOns.filter(a => addOnIds.includes(a._id));
  const basePrice = base ? priceFor(base, stories) : 0;
  const firstPrice = basePrice + chosen.reduce((total, a) => total + a.priceCents, 0);
  const minutes = base ? minutesFor(base, stories) + chosen.reduce((total, a) => total + addOnMinutes(a), 0) : 0;
  const secondPrice = plan ? basePrice - Math.min(basePrice, base.secondVisitDiscountCents || 0) : 0;
  const outsideArea = zip.length === 5 && catalog && !catalog.enabledZips?.includes(zip);
  function chooseService(id) { setServiceId(id); setDate2(''); setDate2Chosen(false); setSlot2(''); setAddOnIds(ids => ids.filter(a => catalog.addOns?.find(x => x._id === a)?.appliesTo.includes(id))); }
  async function submit(event) {
    event.preventDefault();
    if (!email.trim() && !phone.trim()) { setError('Enter an email address or a phone number.'); return; }
    setBusy(true); setError('');
    try { await onSave({ ...Object.fromEntries(new FormData(event.currentTarget)), requestId, serviceId, stories, addOnIds: chosen.map(a => a._id), startsAt: slot, ...(plan ? { secondStartsAt: slot2 } : {}), expectedPriceCents: firstPrice + secondPrice }); }
    catch (e) { setError(e.message); setBusy(false); }
  }
  return <section className="add-booking" aria-label="Add a booking"><h3>Add a booking</h3><p className="fine">Any open time within business hours is available here, including short-notice times customers can’t book online. The booking is confirmed right away, and the customer gets the usual confirmation.</p>
    {!catalog ? <p role="status">{error || 'Loading services…'}</p> : <form onSubmit={submit}><fieldset disabled={busy}>
      <label>Service<BrandedSelect value={serviceId} onChange={e => chooseService(e.target.value)} required>{catalog.services.map(s => <option key={s._id} value={s._id}>{s.name} — {priceLabel(s, stories)}</option>)}</BrandedSelect></label>
      <label>Home height<BrandedSelect value={stories} onChange={e => setStories(e.target.value)} required>{storyOptions.map(o => <option key={o}>{o}</option>)}</BrandedSelect></label>
      {addOns.map(a => <label className="checkbox" key={a._id}><input type="checkbox" checked={addOnIds.includes(a._id)} onChange={e => setAddOnIds(ids => e.target.checked ? [...ids, a._id] : ids.filter(id => id !== a._id))}/><span>Add {a.name.toLowerCase()} — {priceLabel(a)}{plan ? ' (first cleaning)' : ''}</span></label>)}
      <p className="booking-price">{plan ? <>Cleaning 1 <strong>{money(firstPrice)}</strong> · Cleaning 2 <strong>{money(secondPrice)}</strong> · Total <strong>{money(firstPrice + secondPrice)}</strong></> : <>From <strong>{money(firstPrice)}</strong> <span>· {minutes} minutes reserved</span></>}</p>
      {plan && <h4>Cleaning 1</h4>}
      <DatePicker label={plan ? 'Cleaning 1 date · Austin time' : 'Appointment date · Austin time'} dates={dates} loading={datesLoading} value={date} onChange={setDate}/>
      <TimePicker label={plan ? 'Cleaning 1 arrival time' : 'Available arrival times'} date={date} slots={slots} loading={slotsLoading} value={slot} onChange={setSlot}/>
      {plan && <><h4>Cleaning 2</h4><p className="fine">At least 60 days after the first cleaning. We’ve suggested about 6 months.</p>{date ? <><DatePicker label="Cleaning 2 date · Austin time" dates={dates2} loading={dates2Loading} value={date2} onChange={value => { setDate2(value); setDate2Chosen(true); }}/><TimePicker label="Cleaning 2 arrival time" date={date2} slots={slots2} loading={slots2Loading} value={slot2} onChange={setSlot2}/></> : <p role="status">Choose the first cleaning date to see options.</p>}</>}
      <h4>Customer</h4>
      <div className="field-grid"><label>Customer name<input name="name" required maxLength={160} autoComplete="off"/></label><label>Email address<input name="email" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="off" maxLength={254}/></label><label>Phone number<PhoneInput name="phone" value={phone} onChange={e => setPhone(e.target.value)} autoComplete="off" maxLength={40}/></label>{email.trim() && phone.trim() && <label>Preferred contact<BrandedSelect name="contact" value={contact} onChange={e => setContact(e.target.value)}><option>Email</option><option>Phone</option></BrandedSelect></label>}</div>
      <p className="fine">Enter an email, a phone number, or both.</p>
      <label>Street address<input name="address" required maxLength={160} autoComplete="off"/></label>
      <div className="field-grid"><label>City<input name="city" required defaultValue="Austin" maxLength={160} autoComplete="off"/></label><label>ZIP code<input name="zip" value={zip} onChange={e => setZip(e.target.value)} required pattern="[0-9]{5}" maxLength={5} inputMode="numeric" autoComplete="off"/></label><label>Gutter guards?<BrandedSelect name="guards"><option>Not sure</option><option>Yes</option><option>No</option></BrandedSelect></label></div>
      {outsideArea && <p className="fine" role="status">ZIP {zip} is outside the online service area. You can still add this booking.</p>}
      <label>Notes<textarea name="notes" rows={3} maxLength={2000} placeholder="Access, visible overflow, or specific concerns"/></label>
      {error && <p className="notice error" role="alert">{error}</p>}
      <div className="form-actions"><button className="small-button" disabled={busy || !slot || (plan && !slot2)}>{busy ? 'Adding…' : plan ? 'Add both cleanings' : 'Add booking'}</button><button type="button" className="text-link" onClick={onCancel}>Cancel</button></div>
    </fieldset></form>}
  </section>;
}
