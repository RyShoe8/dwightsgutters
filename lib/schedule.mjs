import { DateTime } from 'luxon';
export const ZONE = 'America/Chicago';
export const localTime = date => DateTime.fromJSDate(new Date(date), { zone: ZONE }).toFormat("ccc, LLL d, yyyy 'at' h:mm a ZZZZ");
export const money = cents => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
export function daySlots(date, service, schedule, bookings = [], now = new Date()) {
  const day = DateTime.fromISO(date, { zone: ZONE });
  const today = DateTime.fromJSDate(now, { zone: ZONE }).startOf('day');
  if (!day.isValid || day.toISODate() !== date || !schedule?.enabled || !service?.active || service.priceCents === null || day < today || day > today.plus({ days: schedule.horizonDays })) return [];
  const hours = schedule.exceptions.find(d => d.date === date) || schedule.weekly.find(d => d.day === day.weekday);
  if (!hours?.enabled) return [];
  const at = value => DateTime.fromISO(`${date}T${value}`, { zone: ZONE });
  const end = at(hours.end), result = [];
  for (let start = at(hours.start); start < end; start = start.plus({ minutes: 30 })) {
    const finish = start.plus({ minutes: service.durationMinutes });
    const occupiedUntil = finish.plus({ minutes: schedule.bufferMinutes });
    if (finish > end || start.toMillis() < now.getTime() + schedule.leadHours * 3600000) continue;
    if (bookings.some(b => b.status !== 'cancelled' && new Date(b.startsAt) < occupiedUntil.toJSDate() && new Date(b.occupiedUntil) > start.toJSDate())) continue;
    result.push({ startsAt: start.toUTC().toISO(), endsAt: finish.toUTC().toISO(), occupiedUntil: occupiedUntil.toUTC().toISO(), label: start.toFormat('h:mm a ZZZZ') });
  }
  return result;
}
// Dates from today through the booking horizon that still have at least one open time.
export function openDates(service, schedule, bookings = [], now = new Date()) {
  if (!schedule?.enabled) return [];
  const today = DateTime.fromJSDate(now, { zone: ZONE }).startOf('day'), result = [];
  for (let day = today; day <= today.plus({ days: schedule.horizonDays }); day = day.plus({ days: 1 })) {
    if (daySlots(day.toISODate(), service, schedule, bookings, now).length) result.push(day.toISODate());
  }
  return result;
}
