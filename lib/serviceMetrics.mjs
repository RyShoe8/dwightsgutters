import { DateTime } from 'luxon';
import { ZONE } from './schedule.mjs';

/** Aggregate-only service reporting: never exports customer names, emails or addresses. */
export async function serviceMetrics(db, now = new Date()) {
  const today = DateTime.fromJSDate(now).setZone(ZONE).startOf('day');
  const start = today.minus({ days: 89 }).toJSDate();
  const end = today.plus({ days: 1 }).toJSDate();
  const daily = field => [
    { $match: { [field]: { $gte: start, $lt: end } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: `$${field}`, timezone: ZONE } }, value: { $sum: 1 } } },
  ];
  const [leads, bookings, customers, statuses, totals] = await Promise.all([
    db.collection('customers').aggregate([
      { $project: { email: 1, phone: 1, createdAt: 1 } },
      { $unionWith: { coll: 'inquiries', pipeline: [{ $match: { kind: { $in: ['lead', 'inquiry'] } } }, { $project: { email: 1, phone: 1, createdAt: 1 } }] } },
      { $set: { identity: { $toLower: { $trim: { input: { $ifNull: ['$email', ''] } } } } } },
      { $match: { identity: { $ne: '' } } },
      { $group: { _id: '$identity', firstSeen: { $min: '$createdAt' } } },
      ...daily('firstSeen'),
    ]).toArray(),
    db.collection('bookings').aggregate([{ $match: { status: { $in: ['pending', 'confirmed', 'completed'] } } }, ...daily('createdAt')]).toArray(),
    db.collection('bookings').aggregate([
      { $match: { status: 'completed', customerId: { $type: 'string' }, completedAt: { $type: 'date' } } },
      { $group: { _id: '$customerId', firstCompleted: { $min: '$completedAt' } } }, ...daily('firstCompleted'),
    ]).toArray(),
    db.collection('bookings').aggregate([{ $group: { _id: '$status', value: { $sum: 1 } } }]).toArray(),
    db.collection('bookings').aggregate([{ $match: { status: 'completed', customerId: { $type: 'string' } } }, { $group: { _id: '$customerId' } }, { $count: 'value' }]).toArray(),
  ]);
  const series = rows => {
    const values = new Map(rows.map(row => [row._id, row.value]));
    return Array.from({ length: 90 }, (_, i) => { const date = today.minus({ days: 89 - i }).toISODate(); return { date, value: values.get(date) || 0 }; });
  };
  return { version: 1, businessModel: 'service', customerDefinition: 'first_completed_service', timezone: ZONE, generatedAt: now.toISOString(),
    leads: series(leads), bookings: series(bookings), customers: series(customers), customersTotal: totals[0]?.value || 0,
    bookingStatuses: Object.fromEntries(['pending', 'confirmed', 'completed', 'cancelled'].map(status => [status, statuses.find(row => row._id === status)?.value || 0])),
  };
}
