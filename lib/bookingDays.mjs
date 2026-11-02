const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' });
const labelFormat = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
export function groupBookingDays(items) {
  const days = new Map();
  for (const booking of [...items].sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt) || a._id.localeCompare(b._id))) {
    const date = new Date(booking.startsAt), key = dayFormat.format(date);
    if (!days.has(key)) days.set(key, { key, label: labelFormat.format(date), items: [] });
    days.get(key).items.push(booking);
  }
  return [...days.values()];
}
