'use client';
import { useRef, useState } from 'react';
import { confirmAction } from './ConfirmDialog';
import { preparePhoto } from '../lib/photoUpload.mjs';
export const photoUrl = (id, variant = 'full', download = false) => `/api/admin/job-photos/${id}/${variant}/${download ? '?download=1' : ''}`;
export async function photoRequest(path, method = 'GET', data) {
  const response = await fetch(`/api/admin/${path}/`, { method, headers: data ? { 'Content-Type': 'application/json' } : {}, ...(data ? { body: JSON.stringify(data) } : {}) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'That didn’t work. Please try again.');
  return result;
}
// Shown on each booking, for owners and staff. Uploads also appear in Media → Jobs.
export default function JobPhotos({ bookingId, count = 0, actor, role }) {
  const input = useRef(null);
  const [photos, setPhotos] = useState(null), [open, setOpen] = useState(false), [loading, setLoading] = useState(false), [progress, setProgress] = useState(''), [error, setError] = useState('');
  const total = photos ? photos.length : count;
  async function load() {
    setLoading(true);
    try { const { items } = await photoRequest(`bookings/${bookingId}/photos`); setPhotos(items); return items; }
    catch (e) { setError(e.message); return null; }
    finally { setLoading(false); }
  }
  function toggle() { setError(''); if (!open && !photos) load(); setOpen(!open); }
  async function upload(event) {
    const files = [...event.target.files]; event.target.value = '';
    if (!files.length) return;
    setOpen(true); setError('');
    if (!photos && !await load()) return;
    const problems = [];
    for (const [index, file] of files.entries()) {
      setProgress(files.length > 1 ? `Uploading ${index + 1} of ${files.length}…` : 'Uploading…');
      try {
        const saved = await photoRequest(`bookings/${bookingId}/photos`, 'POST', await preparePhoto(file));
        setPhotos(current => [...(current || []), saved]);
      } catch (e) { problems.push(e.message); }
    }
    setProgress('');
    if (problems.length) setError([...new Set(problems)].join(' '));
  }
  async function remove(photo) {
    if (!await confirmAction('Delete this photo? This can’t be undone.')) return;
    setError('');
    try { await photoRequest(`job-photos/${photo.id}`, 'DELETE'); setPhotos(current => current.filter(item => item.id !== photo.id)); }
    catch (e) { setError(e.message); }
  }
  return <div className="job-photos">
    <div className="job-photos-bar">
      <button type="button" className="text-link" aria-expanded={open} onClick={toggle}>Job photos ({total}) {open ? '▴' : '▾'}</button>
      <button type="button" className="small-button" disabled={Boolean(progress)} onClick={() => input.current?.click()}>{progress || 'Add photos'}</button>
      <input ref={input} type="file" accept="image/*" multiple hidden aria-label="Add job photos" onChange={upload}/>
    </div>
    {error && <p className="notice error" role="alert">{error}</p>}
    {open && (loading ? <p className="fine" role="status">Loading photos…</p> : photos?.length ? <div className="job-photo-grid">{photos.map(photo => <figure key={photo.id}>
      <a href={photoUrl(photo.id)} target="_blank" rel="noreferrer" aria-label="Open photo full size"><img src={photoUrl(photo.id, 'thumb')} alt={photo.name || 'Job photo'} loading="lazy"/></a>
      {(role === 'owner' || photo.uploadedBy === actor) && <button type="button" aria-label="Delete photo" onClick={() => remove(photo)}>×</button>}
    </figure>)}</div> : photos && !progress && <p className="fine">No photos on this job yet.</p>)}
  </div>;
}
