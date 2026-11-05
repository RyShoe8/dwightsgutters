'use client';
import { useState } from 'react';
import { assetUrl, brandColors, mediaGroups, previewUrl } from '../lib/mediaLibrary.mjs';
function Swatch({ color }) {
  const [copied, setCopied] = useState(false);
  async function copy() { try { await navigator.clipboard.writeText(color.hex); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { setCopied(false); } }
  return <article className="media-swatch"><span style={{ background: color.hex }}/><div><strong>{color.name}</strong><small>{color.use}</small><button type="button" className="text-link" onClick={copy}>{copied ? 'Copied ✓' : `${color.hex} · Copy`}</button></div></article>;
}
export default function MediaLibrary() {
  return <><div className="panel-heading"><div><h2>Media</h2><p>All of Dwight’s Gutters’ brand assets in one place. Use PNG for everyday needs and SVG or PDF when a printer or designer asks for it.</p></div></div>
    <nav className="media-jump" aria-label="Jump to a media section">{mediaGroups.map(group => <a key={group.id} href={`#media-${group.id}`}>{group.title}</a>)}<a href="#media-colors">Colors</a></nav>
    {mediaGroups.map(group => <section className="media-group" id={`media-${group.id}`} key={group.id}><h3>{group.title}</h3><p className="fine">{group.intro}</p><div className="media-grid">{group.items.map(item => <article className="media-card" key={item.path}><div className={`media-preview${item.dark ? ' dark' : ''}`}><img src={previewUrl(item)} alt={item.name} loading="lazy"/></div><strong>{item.name}</strong><small>{item.use}</small><div className="media-downloads">{item.formats.map(format => <a key={format} href={assetUrl(item, format)} download>{format.toUpperCase()} ↓</a>)}</div></article>)}</div></section>)}
    <section className="media-group" id="media-colors"><h3>Colors</h3><p className="fine">The official brand colors. Tap a color’s code to copy it.</p><div className="media-swatches">{brandColors.map(color => <Swatch key={color.hex} color={color}/>)}</div></section></>;
}
