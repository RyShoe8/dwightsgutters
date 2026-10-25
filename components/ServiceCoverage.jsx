'use client';
import { useCallback, useEffect, useState } from 'react';
import CoverageMap from './CoverageMap';
import { coverageGroups } from '../lib/coverage-data.mjs';
export default function ServiceCoverage() {
  const [coverage, setCoverage] = useState(null), [error, setError] = useState(''), [query, setQuery] = useState('');
  const refresh = useCallback(async (signal) => {
    try { const response = await fetch('/api/coverage/', { cache: 'no-store', signal }); const data = await response.json(); if (!response.ok) throw Error(data.error); setCoverage(old => JSON.stringify(old) === JSON.stringify(data) ? old : data); setError(''); }
    catch (e) { if (e.name !== 'AbortError') { setError('Coverage is temporarily unavailable. Please email Dwight before booking.'); setCoverage(null); } }
  }, []);
  useEffect(() => { const controller = new AbortController(); const update = () => { if (!document.hidden) refresh(controller.signal); }; update(); const timer = setInterval(update, 60000); window.addEventListener('focus', update); return () => { controller.abort(); clearInterval(timer); window.removeEventListener('focus', update); }; }, [refresh]);
  const term = query.trim().toLowerCase();
  const groups = coverageGroups.map(g => ({ ...g, areas: g.areas.filter(a => `${g.name} ${a.name}`.toLowerCase().includes(term)) })).filter(g => g.areas.length);
  return <section className="section container live-coverage" id="communities">
    <div className="section-heading"><div><p className="eyebrow">OUR NEIGHBORHOODS, CONNECTED</p><h2>Find your home<br/>in our service area.</h2></div><p>Gutter cleaning across Austin and nearby communities. Orange outlines show our current service coverage. Explore the map or find your community below.</p></div>
    {error && <p className="notice error" role="alert">{error}</p>}
    {!coverage && !error && <p role="status">Checking current coverage…</p>}
    <CoverageMap enabledZips={coverage?.enabledZips}/>
    <div className="community-search"><label>Find your city or neighborhood<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Try Round Rock or South Austin" maxLength={100}/></label></div>
    <div className="coverage-directory">{groups.map(group => <section className="coverage-directory-group" key={group.name}><h3>{group.name}</h3><ul className="community-list">{group.areas.map(area => <li key={area.name}>{area.name}</li>)}</ul></section>)}</div>
    {!groups.length && <p role="status">No matching community. Email Dwight to ask about nearby coverage.</p>}
    <p className="fine">Availability varies within each community. The map shows approximate service boundaries; your address is checked when you book. Near the edge of our coverage? <a href="mailto:dwight@dwightsgutters.com">Contact Dwight</a> for help.</p>
    <a className="button" href="/book/">Book a Cleaning →</a>
  </section>;
}
