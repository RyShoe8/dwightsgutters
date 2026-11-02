'use client';
import { useEffect, useRef, useState } from 'react';
const when = value => new Date(value).toLocaleString('en-US', { timeZone: 'America/Chicago', dateStyle: 'medium', timeStyle: 'short' });
const deliveryLabel = status => ({ accepted: 'Accepted by email provider', captured: 'Captured locally', pending: 'Queued for delivery', sending: 'Sending', failed: 'Delivery failed', queued: 'Queued for delivery' })[status] || status;
export default function ReplyComposer({ type, record, onClose }) {
  const [text, setText] = useState(''), [items, setItems] = useState([]), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState(''), [requestId, setRequestId] = useState('');
  const panel = useRef(null);
  async function load(signal) {
    const response = await fetch(`/api/admin/replies/?type=${type}&id=${encodeURIComponent(record._id)}`, { signal });
    const result = await response.json(); if (!response.ok) throw Error(result.error || 'Unable to load replies.'); setItems(result.items);
  }
  useEffect(() => {
    panel.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    const controller = new AbortController();
    load(controller.signal).catch(e => { if (e.name !== 'AbortError') setError(e.message); });
    return () => controller.abort();
  }, [type, record._id]);
  async function send(event) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    const id = requestId || crypto.randomUUID(); setRequestId(id);
    try {
      const response = await fetch('/api/admin/replies/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, id: record._id, requestId: id, text }) });
      const result = await response.json(); if (!response.ok) throw Error(result.error || 'Unable to save reply.');
      setText(''); setRequestId(''); setMessage(deliveryLabel(result.status));
      await load();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <section className="customer-editor reply-composer" ref={panel} aria-label="Email reply"><div className="panel-heading"><h3>Reply to {record.name}</h3><button type="button" disabled={busy} className="text-link" onClick={onClose}>Close ×</button></div><p>Email to <strong>{record.email}</strong></p>{record.contact === 'Phone' && <p className="fine">This customer prefers phone contact. This composer sends an email.</p>}<form onSubmit={send}><label>Your reply<textarea rows={5} maxLength={4000} required disabled={busy} value={text} onChange={e => { setText(e.target.value); setRequestId(''); }}/></label><button className="button" disabled={busy || !text.trim()}>{busy ? 'Sending…' : 'Send email reply →'}</button></form>{error && <p className="notice error" role="alert">{error}</p>}{message && <p className="notice" role="status">{message}</p>}<h3>Reply history</h3>{items.length ? items.map(item => <article key={item._id} className="reply-history"><small>{when(item.createdAt)} · {item.actor} · {deliveryLabel(item.status)}</small><p>{item.text}</p></article>) : <p className="fine">No replies sent from this admin yet.</p>}<p className="fine">Replies from the customer go to Dwight’s email inbox. The history here shows messages sent from this admin.</p></section>;
}
