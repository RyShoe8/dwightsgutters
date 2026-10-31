'use client';
import { useEffect, useRef, useState } from 'react';

export default function AdminSignIn() {
  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState('email');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const codeInput = useRef(null);
  const redeemed = useRef('');

  useEffect(() => {
    const readToken = () => {
      const value = new URLSearchParams(location.hash.slice(1)).get('token');
      if (!value) return;
      setToken(value); setMessage(''); history.replaceState(null, '', location.pathname);
      // Links are single-use; guard against React running this effect twice.
      if (redeemed.current !== value) { redeemed.current = value; send('redeem', value); }
    };
    readToken();
    window.addEventListener('hashchange', readToken);
    return () => window.removeEventListener('hashchange', readToken);
  }, []);
  useEffect(() => { if (step === 'code' && !token) codeInput.current?.focus(); }, [step, token]);

  async function send(action, linkToken) {
    setBusy(true); setMessage(''); setError('');
    try {
      const response = await fetch(`/api/auth/${action}/`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action === 'redeem' ? { token: linkToken } : action === 'code' ? { email, code } : { email }),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      if (action === 'request') { setCode(''); setStep('code'); setMessage(data.message); codeInput.current?.focus(); }
      else location.assign('/admin/');
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  return <main id="main" className="section container"><div className="admin-login booking-card">
    <p className="eyebrow">DWIGHT’S GUTTERS · ADMIN</p>
    <h1>{!token && step === 'code' ? 'Check your email.' : 'Welcome back.'}</h1>
    <p>{token ? (error ? 'This link couldn’t sign you in.' : 'Signing you in…') : step === 'code' ? `Enter the 8-digit code sent to ${email}, or use the secure link in that email.` : 'We’ll email you a secure sign-in link and an 8-digit code. Use whichever is easier.'}</p>
    {token ? null
      : step === 'email' ? <form onSubmit={e => { e.preventDefault(); send('request'); }}>
        <label>Admin email<input name="email" type="email" autoComplete="email" required disabled={busy} value={email} onChange={e => setEmail(e.target.value)} placeholder="dwight@dwightsgutters.com"/></label>
        <button className="button" disabled={busy}>{busy ? 'Please wait…' : 'Email me a link and code →'}</button>
      </form> : <>
        <form onSubmit={e => { e.preventDefault(); send('code'); }}>
          <label>Sign-in code<input ref={codeInput} name="code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{8}" minLength={8} maxLength={8} required value={code} onChange={e => setCode(e.target.value)} aria-describedby="code-help"/></label>
          <p id="code-help" className="fine">Enter the code from your latest email. It expires in 15 minutes. Request a new email after five incorrect attempts.</p>
          <button className="button" disabled={busy}>{busy ? 'Please wait…' : 'Sign in with code →'}</button>
        </form>
        <div className="actions"><button type="button" className="text-link" disabled={busy} onClick={() => send('request')}>Send a new link and code</button><button type="button" className="text-link" disabled={busy} onClick={() => { setStep('email'); setCode(''); setMessage(''); setError(''); }}>Use a different email</button></div>
      </>}
    {message && <p className="notice" role="status">{message}</p>}
    {error && <p className="notice error" role="alert">{error}</p>}
    {token && error && <p><a href="/admin/sign-in/">Use a code or request a new email</a></p>}
    <p className="fine"><a href="/terms/">Terms of Service</a> · <a href="/cookie-policy/">Cookie Policy</a></p>
  </div></main>;
}
