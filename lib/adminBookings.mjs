import { database } from './db.mjs';
import { formatPhone } from './phone.mjs';
export async function listBookings({ status = 'all', page = 0, customerId } = {}) {
  const { db } = await database();
  const filter = {};
  if (['pending', 'confirmed', 'completed', 'cancelled'].includes(status)) filter.status = status;
  if (status === 'unpaid') Object.assign(filter, { status: 'completed', payment: { $exists: false } });
  if (customerId) filter.customerId = customerId;
  const items = await db.collection('bookings').find(filter, { projection: { fingerprint: 0, rescheduleTokenHash: 0, altTokenHashes: 0 } }).sort({ startsAt: -1 }).skip(page * 25).limit(25).toArray();
  return { items: items.map(booking => ({ ...booking, phone: formatPhone(booking.phone), ...(booking.invoice ? { invoice: { ...booking.invoice, phone: formatPhone(booking.invoice.phone) } } : {}) })), total: await db.collection('bookings').countDocuments(filter) };
}
