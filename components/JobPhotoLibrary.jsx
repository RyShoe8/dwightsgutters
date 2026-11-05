'use client';
import { useEffect, useState } from 'react';
import { confirmAction } from './ConfirmDialog';
import { photoRequest, photoUrl } from './JobPhotos';
const jobDate = value => new Date(value).toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', year: 'numeric' });
// Admin → Media → Jobs: every photo staff have added, grouped by job.
export default function JobPhotoLibrary() {
  const [jobs, setJobs] = useState(null), [total, setTotal] = useState(0), [page, setPage] = useState(0), [loadingMore, setLoadingMore] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    photoRequest('job-photos').then(result => { if (live) { setJobs(result.items); setTotal(result.total); } }).catch(e => { if (live) setError(e.message); });
    return () => { live = false; };
  }, []);
  async function showMore() {
    setLoadingMore(true); setError('');
    try {
      const next = page + 1, result = await fetch(`/api/admin/job-photos/?page=${next}`).then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error); return data; });
      setJobs(current => { const seen = new Set(current.map(job => job.bookingId)); return [...current, ...result.items.filter(job => !seen.has(job.bookingId))]; });
      setTotal(result.total); setPage(next);
    } catch (e) { setError(e.message || 'Those jobs couldn’t be loaded.'); } finally { setLoadingMore(false); }
  }
  async function remove(job, photo) {
    if (!await confirmAction('Delete this photo? It will also be removed from the booking. This can’t be undone.')) return;
    setError('');
    try {
      await photoRequest(`job-photos/${photo.id}`, 'DELETE');
      const emptied = job.photos.length === 1;
      setJobs(current => current.map(item => item.bookingId === job.bookingId ? { ...item, photos: item.photos.filter(other => other.id !== photo.id) } : item).filter(item => item.photos.length));
      if (emptied) setTotal(value => value - 1);
    } catch (e) { setError(e.message); }
  }
  return <section className="media-group" id="media-jobs"><h3>Jobs</h3><p className="fine">Photos added to bookings, grouped by job with the newest first. These show customers’ homes, so they stay private to this workspace.</p>
    {error && <p className="notice error" role="alert">{error}</p>}
    {!jobs ? !error && <p className="fine" role="status">Loading job photos…</p> : !jobs.length ? <p className="fine">No job photos yet. Add them from a booking under Bookings → Add photos.</p> : jobs.map(job => <article className="media-job" key={job.bookingId}>
      <header><h4>{job.name ? <a href={`#type=booking&id=${encodeURIComponent(job.bookingId)}`}>{job.name}</a> : 'Booking no longer available'}</h4>
        {job.name && <p>{job.service} · {jobDate(job.startsAt)}<br/>{job.address}</p>}
        <small>{job.photos.length} {job.photos.length === 1 ? 'photo' : 'photos'}</small></header>
      <div className="media-grid">{job.photos.map(photo => <article className="media-card" key={photo.id}>
        <a className="media-preview job-photo-preview" href={photoUrl(photo.id)} target="_blank" rel="noreferrer" aria-label="Open photo full size"><img src={photoUrl(photo.id, 'thumb')} alt={photo.name || `Job photo for ${job.name || 'this job'}`} loading="lazy"/></a>
        <small>Added {jobDate(photo.uploadedAt)}<br/>by {photo.uploadedBy}</small>
        <div className="media-downloads"><a href={photoUrl(photo.id, 'full', true)} download>JPG ↓</a><button type="button" className="text-link danger" onClick={() => remove(job, photo)}>Delete</button></div>
      </article>)}</div>
    </article>)}
    {jobs && jobs.length < total && <button type="button" className="small-button" disabled={loadingMore} onClick={showMore}>{loadingMore ? 'Loading…' : 'Show more jobs'}</button>}
  </section>;
}
