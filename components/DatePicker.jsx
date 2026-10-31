'use client';
import { useState } from 'react';
// Month calendar where only the given ISO dates (YYYY-MM-DD) can be chosen.
const asDate = iso => new Date(`${iso}T12:00:00Z`);
const monthOf = iso => iso.slice(0, 7);
const shiftMonth = (month, n) => { const d = asDate(`${month}-01`); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 7); };
const format = (iso, options) => asDate(iso).toLocaleDateString('en-US', { timeZone: 'UTC', ...options });
export default function DatePicker({ label, dates, value, onChange, disabled, loading }) {
  const [month, setMonth] = useState('');
  const open = new Set(dates);
  const first = dates[0] && monthOf(dates[0]), last = dates.length && monthOf(dates.at(-1));
  const shown = month && month >= first && month <= last ? month : value ? monthOf(value) : first;
  if (loading || !dates.length) return <div className="date-picker"><span className="date-picker-label">{label}</span><p className="date-picker-empty" role="status">{loading ? 'Checking open dates…' : 'No open dates right now. Please contact Dwight to find a time.'}</p></div>;
  const blanks = asDate(`${shown}-01`).getUTCDay();
  const days = new Date(Date.UTC(Number(shown.slice(0, 4)), Number(shown.slice(5, 7)), 0)).getUTCDate();
  return <div className="date-picker" role="group" aria-label={label}>
    <span className="date-picker-label">{label}</span>
    <div className="date-picker-head"><button type="button" disabled={disabled || shown <= first} onClick={() => setMonth(shiftMonth(shown, -1))} aria-label="Previous month">‹</button><strong aria-live="polite">{format(`${shown}-01`, { month: 'long', year: 'numeric' })}</strong><button type="button" disabled={disabled || shown >= last} onClick={() => setMonth(shiftMonth(shown, 1))} aria-label="Next month">›</button></div>
    <div className="date-picker-grid">
      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={i} className="date-picker-weekday" aria-hidden="true">{d}</span>)}
      {Array.from({ length: blanks }, (_, i) => <span key={`blank-${i}`}/>)}
      {Array.from({ length: days }, (_, i) => {
        const iso = `${shown}-${String(i + 1).padStart(2, '0')}`, available = open.has(iso);
        return <button type="button" key={iso} disabled={disabled || !available} aria-pressed={value === iso} aria-label={`${format(iso, { weekday: 'long', month: 'long', day: 'numeric' })}${available ? '' : ', unavailable'}`} onClick={() => onChange(iso)}>{i + 1}</button>;
      })}
    </div>
    <p className="fine" role="status">{value ? `Selected: ${format(value, { weekday: 'long', month: 'long', day: 'numeric' })}` : 'Choose an open date.'}</p>
  </div>;
}
