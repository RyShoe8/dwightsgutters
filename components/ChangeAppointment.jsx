'use client';
import { useEffect, useRef, useState } from 'react';
async function request(path, data, signal) {
  const response = await fetch(`/api/reschedule/${path}/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), signal });
  const result = await response.json(); if (!response.ok) throw Error(result.error); return result;
}
export default function ChangeAppointment() {
  const tokenRef = useRef('');
  const [token, setToken] = useState(''), [details, setDetails] = useState(null), [date, setDate] = useState(''), [slots, setSlots] = useState([]), [slot, setSlot] = useState(''), [busy, setBusy] = useState(false), [loading, setLoading] = useState(false), [error, setError] = useState(''), [receipt, setReceipt] = useState(null);
  useEffect(() => {
    const value = tokenRef.current || new URLSearchParams(location.hash.slice(1)).get('token');
    tokenRef.current = value;
    history.replaceState(null, '', location.pathname);
    if (!value) { setError('Open the change-appointment link in your confirmation email.'); return; }
    setToken(value);
    const controller = new AbortController();
    request('details', { token: value }, controller.signal).then(setDetails).catch(e => { if (e.name !== 'AbortError') setError(e.message); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    setSlot(''); setSlots([]); if (!date || !token) return;
    const controller = new AbortController(); setLoading(true); setError('');
    request('details', { token, date }, controller.signal).then(result => setSlots(result.slots)).catch(e => { if (e.name !== 'AbortError') setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [date, token]);
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try { setReceipt(await request('change', { token, startsAt: slot, expectedStartsAt: details.startsAt })); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <main id="main" className="section container"><div className="booking-card admin-login"><p className="eyebrow">YOUR APPOINTMENT</p><h1>{receipt ? 'Your time is updated.' : 'Change your appointment.'}</h1>{receipt ? <p role="status">Your new appointment is <strong>{receipt.when}</strong>. A confirmation email is queued.</p> : details ? <><p><strong>{details.service}</strong><br/>Currently: {details.when}</p><p>Online changes are available at least 48 hours before your current appointment. Your new time must also be at least 48 hours away. The service and starting price stay the same.</p><form onSubmit={submit}><label>New date · Austin time<input type="date" required min={details.minDate} max={details.maxDate} value={date} onChange={e => setDate(e.target.value)} disabled={busy}/></label><label>New arrival time<select required disabled={busy || loading || !slots.length} value={slot} onChange={e => setSlot(e.target.value)}><option value="">{loading ? 'Checking times…' : 'Choose a time'}</option>{slots.map(s => <option key={s.startsAt} value={s.startsAt}>{s.label}</option>)}</select></label>{date && !loading && !slots.length && <p role="status">No available times on this date. Try another date.</p>}<button className="button" disabled={busy || loading || !slot}>{busy ? 'Saving…' : 'Confirm new time →'}</button></form></> : !error && <p role="status">Checking your appointment…</p>}{error && <p className="notice error" role="alert">{error}</p>}<p><a className="text-link" href="/contact/">Contact Dwight →</a></p></div></main>;
}
