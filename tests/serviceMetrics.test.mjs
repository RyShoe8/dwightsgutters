import test from 'node:test';
import assert from 'node:assert/strict';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';
import { serviceMetrics } from '../lib/serviceMetrics.mjs';

test('service reporting deduplicates leads and counts customers only at first completion', async () => {
  const server = await MongoMemoryServer.create();
  const client = new MongoClient(server.getUri());
  try {
    await client.connect();
    const db = client.db('report');
    const recent = new Date('2026-11-02T18:00:00Z');
    await db.collection('customers').insertMany([
      { _id: 'pending', email: 'Pending@example.com', createdAt: recent },
      { _id: 'repeat', email: 'repeat@example.com', createdAt: new Date('2026-01-01') },
      { _id: 'new', email: 'new@example.com', createdAt: recent },
    ]);
    await db.collection('inquiries').insertOne({ email: ' pending@example.com ', kind: 'lead', createdAt: recent });
    await db.collection('bookings').insertMany([
      { customerId: 'pending', status: 'pending', createdAt: recent },
      { customerId: 'repeat', status: 'completed', createdAt: new Date('2026-01-01'), completedAt: new Date('2026-01-05') },
      { customerId: 'repeat', status: 'completed', createdAt: recent, completedAt: recent },
      { customerId: 'new', status: 'completed', createdAt: recent, completedAt: recent },
      { customerId: 'new', status: 'completed', createdAt: recent, completedAt: new Date('2026-11-03T18:00:00Z') },
      { customerId: 'cancelled', status: 'cancelled', createdAt: recent },
    ]);
    const report = await serviceMetrics(db, new Date('2026-11-04T12:00:00Z'));
    assert.equal(report.customersTotal, 2);
    assert.equal(report.customers.reduce((s, r) => s + r.value, 0), 1);
    assert.equal(report.leads.reduce((s, r) => s + r.value, 0), 2);
    assert.equal(report.bookings.reduce((s, r) => s + r.value, 0), 4);
    assert.equal(report.customers.find(r => r.date === '2026-11-02').value, 1);
    assert.equal(report.leads.length, 90);
    assert.equal(JSON.stringify(report).includes('@'), false);
  } finally { await client.close(); await server.stop(); }
});
