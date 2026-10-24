'use client';
import { useEffect, useState } from 'react';
export default function AdminSignIn() {
  const [token, setToken] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => {
    const readToken = () => { const value = new URLSearchParams(location.hash.slice(1)).get('token'); if (value) { setToken(value); setMessage(''); history.replaceState(null, '', location.pathname); } };
    readToken(); window.addEventListener('hashchange', readToken);
    return () => window.removeEventListener('hashchange', readToken);
  }, []);
  async function submit(event) { event.preventDefault(); setBusy(true); setMessage(''); try {
    const email = new FormData(event.currentTarget).get('email');
    const response = await fetch(`/api/auth/${token ? 'redeem' : 'request'}/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(token ? { token } : { email }) });
    const data = await response.json(); if (!response.ok) throw Error(data.error);
    if (token) location.assign('/admin/'); else setMessage(data.message);
  } catch (error) { setMessage(error.message); } finally { setBusy(false); } }
  return <main id="main" className="section container"><div className="admin-login booking-card"><p className="eyebrow">DWIGHT’S GUTTERS · ADMIN</p><h1>Welcome back.</h1><p>{token ? 'Confirm below to securely open your admin workspace.' : 'We’ll email you a secure sign-in link. No password to remember.'}</p><form onSubmit={submit}>{!token && <label>Admin email<input name="email" type="email" autoComplete="email" required placeholder="dwight@dwightsgutters.com"/></label>}<button className="button" disabled={busy}>{busy ? 'Please wait…' : token ? 'Sign in to admin →' : 'Email me a sign-in link →'}</button></form>{message && <p className="notice" role="status">{message}</p>}{token && <p><a href="/admin/sign-in/">Request a new sign-in link</a></p>}</div></main>;
}
