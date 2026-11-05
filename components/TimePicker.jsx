'use client';
// Open arrival times for the chosen date, as buttons directly below the calendar.
const shortLabel = label => label.replace(/\s+[A-Z]{2,5}$/, '');
export default function TimePicker({ label, date, slots, loading, value, onChange, disabled, emptyText = 'No times available on this date. Please try another date.' }) {
  if (!date) return null;
  return <div className="time-picker" role="group" aria-label={label}>
    <span className="date-picker-label">{label}</span>
    {loading ? <p className="date-picker-empty" role="status">Checking times…</p>
      : !slots.length ? <p className="date-picker-empty" role="status">{emptyText}</p>
      : <div className="time-grid">{slots.map(slot => <button type="button" key={slot.startsAt} aria-pressed={value === slot.startsAt} disabled={disabled} onClick={() => onChange(slot.startsAt)}>{shortLabel(slot.label)}</button>)}</div>}
  </div>;
}
