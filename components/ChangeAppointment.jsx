'use client';
import { useEffect, useRef, useState } from 'react';
import DatePicker from './DatePicker';
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
  // A seasonal plan's second cleaning asks the customer to confirm the time still works.
  async function keepTime() {
    setBusy(true); setError('');
    try { setReceipt({ ...(await request('confirm', { token })), kept: true }); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <main id="main" className="section container"><div className="booking-card admin-login"><p className="eyebrow">YOUR APPOINTMENT</p><h1>{receipt ? (receipt.kept ? 'You’re confirmed. Thank you!' : 'Your time is updated.') : details?.needsConfirmation ? 'Confirm your second cleaning.' : 'Change your appointment.'}</h1>{receipt ? <p role="status">{receipt.kept ? <>See you on <strong>{receipt.when}</strong>.</> : <>Your new appointment is <strong>{receipt.when}</strong>. A confirmation email is queued.</>}</p> : details ? <><p><strong>{details.service}</strong><br/>Currently: {details.when}</p>{details.needsConfirmation && <div className="notice"><p>Does this time still work?</p><button type="button" className="button" disabled={busy} onClick={keepTime}>{busy ? 'Saving…' : 'Yes, keep this time →'}</button><p className="fine">Need a different time? Choose one below.</p></div>}<p>Online changes are available at least 48 hours before your current appointment. Your new time must also be at least 48 hours away. The service and starting price stay the same.</p><form onSubmit={submit}><DatePicker label="New date · Austin time" dates={details.dates || []} value={date} onChange={setDate} disabled={busy}/><label>New arrival time<select required disabled={busy || loading || !slots.length} value={slot} onChange={e => setSlot(e.target.value)}><option value="">{loading ? 'Checking times…' : 'Choose a time'}</option>{slots.map(s => <option key={s.startsAt} value={s.startsAt}>{s.label}</option>)}</select></label>{date && !loading && !slots.length && <p role="status">No available times on this date. Try another date.</p>}<button className="button" disabled={busy || loading || !slot}>{busy ? 'Saving…' : 'Confirm new time →'}</button></form></> : !error && <p role="status">Checking your appointment…</p>}{error && <p className="notice error" role="alert">{error}</p>}<p><a className="text-link" href="/contact/">Contact Dwight →</a></p></div></main>;
}
