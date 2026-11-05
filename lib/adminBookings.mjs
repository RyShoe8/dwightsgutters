import { database } from './db.mjs';
import { formatPhone } from './phone.mjs';
import { photoCounts } from './jobPhotos.mjs';
export async function listBookings({ status = 'all', page = 0, customerId, id } = {}) {
  const { db } = await database();
  const filter = {};
  if(id) filter._id=id;
  if (['pending', 'confirmed', 'completed', 'cancelled'].includes(status)) filter.status = status;
  if (status === 'unpaid') Object.assign(filter, { status: 'completed', payment: { $exists: false } });
  if (customerId) filter.customerId = customerId;
  const items = await db.collection('bookings').find(filter, { projection: { fingerprint: 0, rescheduleTokenHash: 0, altTokenHashes: 0 } }).sort(customerId ? { startsAt: -1, _id: 1 } : { startsAt: 1, _id: 1 }).skip(page * 25).limit(25).toArray();
  const photos = await photoCounts(items.map(booking => booking._id));
  return { items: items.map(booking => ({ ...booking, photoCount: photos[booking._id] || 0, phone: formatPhone(booking.phone), ...(booking.invoice ? { invoice: { ...booking.invoice, phone: formatPhone(booking.invoice.phone) } } : {}) })), total: await db.collection('bookings').countDocuments(filter) };
}
