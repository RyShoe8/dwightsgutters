import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { database } from './db.mjs';
import { fail } from './validation.mjs';
// Job photos live in MongoDB behind the admin sign-in: they show customers' homes, so they
// are never public files. The browser shrinks each photo to JPEG before upload (see
// lib/photoUpload.mjs), which also removes location data.
export const maxPhotosPerJob = 40;
const maxImageBytes = 2700000, maxThumbBytes = 300000;
const uploadSchema = z.object({ image: z.string().min(1).max(3700000), thumb: z.string().min(1).max(410000), name: z.string().trim().max(200).default('') });
function jpegBytes(base64, maxBytes) {
  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) fail(400, 'That file isn’t a photo we can save. Try a JPG or PNG.');
  if (bytes.length > maxBytes) fail(413, 'That photo is too large to save.');
  return bytes;
}
const publicPhoto = photo => ({ id: photo._id, bookingId: photo.bookingId, name: photo.name, uploadedBy: photo.uploadedBy, uploadedAt: photo.uploadedAt, size: photo.size });
const withoutImages = { data: 0, thumb: 0 };
export async function addJobPhoto(bookingId, input, actor) {
  const { image, thumb, name } = uploadSchema.parse(input);
  const data = jpegBytes(image, maxImageBytes), preview = jpegBytes(thumb, maxThumbBytes);
  const { db } = await database();
  if (!await db.collection('bookings').findOne({ _id: bookingId }, { projection: { _id: 1 } })) fail(404, 'Booking not found.');
  if (await db.collection('jobPhotos').countDocuments({ bookingId }) >= maxPhotosPerJob) fail(409, `A job can have up to ${maxPhotosPerJob} photos. Delete one to add another.`);
  const photo = { _id: randomUUID(), bookingId, name, data, thumb: preview, size: data.length, uploadedBy: actor, uploadedAt: new Date() };
  await db.collection('jobPhotos').insertOne(photo);
  await db.collection('audit').insertOne({ actor, action: 'job-photo.added', target: bookingId, photoId: photo._id, at: photo.uploadedAt });
  return publicPhoto(photo);
}
export async function listBookingPhotos(bookingId) {
  const { db } = await database();
  return (await db.collection('jobPhotos').find({ bookingId }, { projection: withoutImages }).sort({ uploadedAt: 1, _id: 1 }).toArray()).map(publicPhoto);
}
export async function photoCounts(bookingIds) {
  if (!bookingIds.length) return {};
  const { db } = await database();
  const rows = await db.collection('jobPhotos').aggregate([{ $match: { bookingId: { $in: bookingIds } } }, { $group: { _id: '$bookingId', count: { $sum: 1 } } }]).toArray();
  return Object.fromEntries(rows.map(row => [row._id, row.count]));
}
export async function readJobPhoto(id, variant) {
  const { db } = await database();
  const photo = await db.collection('jobPhotos').findOne({ _id: id }, { projection: variant === 'thumb' ? { thumb: 1 } : { data: 1 } });
  if (!photo) fail(404, 'Photo not found.');
  return Buffer.from((variant === 'thumb' ? photo.thumb : photo.data).buffer);
}
// Owners can remove any photo; staff can remove the ones they added.
export async function deleteJobPhoto(id, access) {
  const { db } = await database();
  const photo = await db.collection('jobPhotos').findOne({ _id: id }, { projection: withoutImages });
  if (!photo) fail(404, 'Photo not found.');
  if (access.role !== 'owner' && photo.uploadedBy !== access.email) fail(403, 'You can delete only the photos you added.');
  await db.collection('jobPhotos').deleteOne({ _id: id });
  await db.collection('audit').insertOne({ actor: access.email, action: 'job-photo.deleted', target: photo.bookingId, photoId: id, at: new Date() });
  return { ok: true };
}
// Admin → Media: photos grouped by job, most recently updated job first.
export async function listPhotoJobs({ page = 0, perPage = 20 } = {}) {
  const { db } = await database();
  const groups = await db.collection('jobPhotos').aggregate([
    { $project: withoutImages },
    { $sort: { uploadedAt: 1, _id: 1 } },
    { $group: { _id: '$bookingId', latest: { $max: '$uploadedAt' }, photos: { $push: { id: '$_id', name: '$name', uploadedBy: '$uploadedBy', uploadedAt: '$uploadedAt', size: '$size' } } } },
    { $sort: { latest: -1, _id: 1 } }, { $skip: page * perPage }, { $limit: perPage },
  ]).toArray();
  const bookings = await db.collection('bookings').find({ _id: { $in: groups.map(group => group._id) } }, { projection: { name: 1, address: 1, city: 1, zip: 1, startsAt: 1, status: 1, 'service.name': 1 } }).toArray();
  const byId = Object.fromEntries(bookings.map(booking => [booking._id, booking]));
  const total = (await db.collection('jobPhotos').distinct('bookingId')).length;
  return { total, items: groups.map(group => { const booking = byId[group._id]; return { bookingId: group._id, photos: group.photos, ...(booking ? { name: booking.name, address: `${booking.address}, ${booking.city}, TX ${booking.zip}`, service: booking.service.name, startsAt: booking.startsAt, status: booking.status } : {}) }; }) };
}
