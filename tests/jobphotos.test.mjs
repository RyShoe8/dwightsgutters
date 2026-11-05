import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
process.env.MONGODB_URI = replSet.getUri();
process.env.MONGODB_DB = 'jobphotos';
process.env.EMAIL_TRANSPORT = 'file';
process.env.APP_URL = 'http://localhost:3000';
const { database, seed } = await import('../lib/db.mjs');
const { addJobPhoto, deleteJobPhoto, listBookingPhotos, listPhotoJobs, maxPhotosPerJob, photoCounts, readJobPhoto } = await import('../lib/jobPhotos.mjs');
const { authorizeRoute } = await import('../lib/access.mjs');
const { deleteBooking } = await import('../lib/bookings.mjs');
const { listBookings } = await import('../lib/adminBookings.mjs');

const jpeg = (size = 32, fill = 7) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(size, fill)]).toString('base64');
const upload = (extra = {}) => ({ image: jpeg(64), thumb: jpeg(16, 3), name: 'gutter.jpg', ...extra });
const owner = { role: 'owner', email: 'owner@example.com' }, staff = { role: 'staff', email: 'staff@example.com' }, other = { role: 'staff', email: 'other@example.com' };
async function addBooking(name = 'Pat Customer', startsAt = new Date('2026-12-01T16:00:00Z')) {
  const { db } = await database();
  const booking = { _id: randomUUID(), name, email: 'pat@example.com', phone: '', contact: 'Email', address: '1 Main St', city: 'Austin', zip: '78701', stories: 'One story', guards: 'No', service: { name: 'Gutter cleaning', priceCents: 15000 }, status: 'confirmed', startsAt, endsAt: new Date(startsAt.getTime() + 3600000), createdAt: new Date() };
  await db.collection('bookings').insertOne(booking);
  return booking._id;
}
await seed();
test.after(async () => { if (globalThis.dwightMongo) await (await globalThis.dwightMongo).close(); await replSet.stop(); });

test('a photo is saved to its job and read back byte for byte', async () => {
  const id = await addBooking();
  const saved = await addJobPhoto(id, upload(), staff.email);
  assert.equal(saved.bookingId, id);
  assert.equal(saved.uploadedBy, staff.email);
  assert.equal(saved.data, undefined);
  assert.equal((await readJobPhoto(saved.id, 'full')).toString('base64'), jpeg(64));
  assert.equal((await readJobPhoto(saved.id, 'thumb')).toString('base64'), jpeg(16, 3));
  const items = await listBookingPhotos(id);
  assert.deepEqual(items.map(photo => photo.id), [saved.id]);
  assert.equal(items[0].data, undefined);
  assert.equal((await photoCounts([id]))[id], 1);
  const { db } = await database();
  assert.ok(await db.collection('audit').findOne({ action: 'job-photo.added', target: id }));
});

test('bad uploads are refused', async () => {
  const id = await addBooking();
  const notJpeg = Buffer.from('<script>alert(1)</script>').toString('base64');
  await assert.rejects(addJobPhoto(id, upload({ image: notJpeg }), staff.email), error => error.status === 400);
  await assert.rejects(addJobPhoto(id, upload({ thumb: notJpeg }), staff.email), error => error.status === 400);
  await assert.rejects(addJobPhoto(id, upload({ image: jpeg(2700001) }), staff.email), error => error.status === 413);
  await assert.rejects(addJobPhoto('missing-booking', upload(), staff.email), error => error.status === 404);
  assert.equal((await listBookingPhotos(id)).length, 0);
});

test('a job stops accepting photos at the limit', async () => {
  const id = await addBooking();
  const { db } = await database();
  await db.collection('jobPhotos').insertMany(Array.from({ length: maxPhotosPerJob }, () => ({ _id: randomUUID(), bookingId: id, name: '', size: 1, uploadedBy: staff.email, uploadedAt: new Date() })));
  await assert.rejects(addJobPhoto(id, upload(), staff.email), error => error.status === 409);
});

test('staff delete only their own photos; owners delete any', async () => {
  const id = await addBooking();
  const mine = await addJobPhoto(id, upload(), staff.email), theirs = await addJobPhoto(id, upload(), other.email);
  await assert.rejects(deleteJobPhoto(theirs.id, staff), error => error.status === 403);
  await deleteJobPhoto(mine.id, staff);
  await deleteJobPhoto(theirs.id, owner);
  assert.equal((await listBookingPhotos(id)).length, 0);
  await assert.rejects(readJobPhoto(mine.id, 'full'), error => error.status === 404);
});

test('Media groups photos by job with the job details and no image data', async () => {
  const { db } = await database();
  await db.collection('jobPhotos').deleteMany({});
  const first = await addBooking('First Customer'), second = await addBooking('Second Customer');
  const a = await addJobPhoto(first, upload({ name: 'a.jpg' }), staff.email);
  await addJobPhoto(second, upload({ name: 'b.jpg' }), staff.email);
  const c = await addJobPhoto(first, upload({ name: 'c.jpg' }), other.email);
  const { items, total } = await listPhotoJobs();
  assert.equal(total, 2);
  assert.deepEqual(items.map(job => job.name), ['First Customer', 'Second Customer']);
  assert.deepEqual(items[0].photos.map(photo => photo.id), [a.id, c.id]);
  assert.equal(items[0].address, '1 Main St, Austin, TX 78701');
  assert.equal(items[0].service, 'Gutter cleaning');
  assert.equal(JSON.stringify(items).includes('"data"'), false);
  assert.equal(JSON.stringify(items).includes('"thumb"'), false);
  const paged = await listPhotoJobs({ page: 1, perPage: 1 });
  assert.deepEqual(paged.items.map(job => job.name), ['Second Customer']);
  assert.equal(paged.total, 2);
  const listed = await listBookings({ status: 'all', page: 0, id: first });
  assert.equal(listed.items[0].photoCount, 2);
});

test('deleting a booking deletes its photos', async () => {
  const keep = await addBooking(), gone = await addBooking('Gone Customer', new Date('2026-12-02T16:00:00Z'));
  await addJobPhoto(keep, upload(), staff.email);
  const photo = await addJobPhoto(gone, upload(), staff.email);
  await deleteBooking(gone, owner.email);
  assert.equal((await listBookingPhotos(gone)).length, 0);
  assert.equal((await listBookingPhotos(keep)).length, 1);
  await assert.rejects(readJobPhoto(photo.id, 'full'), error => error.status === 404);
});

test('staff can add and view job photos but not open the Media list', () => {
  for (const [route, method] of [['admin/bookings/abc/photos', 'GET'], ['admin/bookings/abc/photos', 'POST'], ['admin/job-photos/abc/thumb', 'GET'], ['admin/job-photos/abc/full', 'GET'], ['admin/job-photos/abc', 'DELETE']]) assert.doesNotThrow(() => authorizeRoute('staff', route, method), `${method} ${route}`);
  assert.throws(() => authorizeRoute('staff', 'admin/job-photos', 'GET'));
  assert.doesNotThrow(() => authorizeRoute('owner', 'admin/job-photos', 'GET'));
});
