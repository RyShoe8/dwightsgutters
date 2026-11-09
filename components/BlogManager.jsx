'use client';
import { useEffect, useRef, useState } from 'react';
import { confirmAction } from './ConfirmDialog';
import PostBody from './PostBody';
import { preparePhoto } from '../lib/photoUpload.mjs';
import { brandCovers, coverAlt, coverSrc, slugify } from '../lib/blogShared.mjs';
// Admin → Blog (owners only): write, edit, publish and delete blog posts.
async function request(path, method = 'GET', data) {
  const response = await fetch(`/api/admin/${path}/`, { method, headers: data ? { 'Content-Type': 'application/json' } : {}, ...(data ? { body: JSON.stringify(data) } : {}) });
  const result = await response.json().catch(() => ({}));
  if (response.status === 401) { location.assign('/admin/sign-in/'); throw Error('Please sign in.'); }
  if (!response.ok) throw Error(result.error || 'That didn’t work. Please try again.');
  return result;
}
const shortDate = value => value ? new Date(value).toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', year: 'numeric' }) : '';
const blankPost = () => ({ id: crypto.randomUUID(), title: '', slug: '', description: '', body: '', cover: { type: 'brand', name: brandCovers[0].name }, coverAlt: '', status: 'draft', publishedAt: null, isNew: true });
const fields = post => JSON.stringify([post.title, post.slug, post.description, post.body, post.cover, post.coverAlt]);
const toolbar = [
  ['Heading', 'H2', 'line', '## '], ['Subheading', 'H3', 'line', '### '], ['Bold', 'B', 'wrap', '**', 'bold text'], ['Italic', 'I', 'wrap', '*', 'italic text'],
  ['Link', 'Link', 'link'], ['Bulleted list', '• List', 'line', '- '], ['Numbered list', '1. List', 'number'], ['Quote', '“ Quote', 'line', '> '],
];
async function uploadPhoto(postId, file) {
  return request(`posts/${postId}/images`, 'POST', await preparePhoto(file, { thumbSide: 900, thumbQuality: 0.8 }));
}
function Editor({ initial, onClose, onSaved, onDeleted }) {
  const [post, setPost] = useState(initial), [saved, setSaved] = useState(fields(initial)), [slugTouched, setSlugTouched] = useState(Boolean(initial.slug));
  const [view, setView] = useState('write'), [busy, setBusy] = useState(''), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const body = useRef(null), bodyPhoto = useRef(null), coverPhoto = useRef(null);
  const dirty = fields(post) !== saved || post.isNew;
  const published = post.status === 'published';
  const set = changes => { setPost(current => ({ ...current, ...changes })); setNotice(''); };
  useEffect(() => {
    const warn = event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  function setTitle(title) { set({ title, ...(!slugTouched && !post.publishedAt ? { slug: slugify(title) } : {}) }); }
  function edit(next, start, end) { set({ body: next }); requestAnimationFrame(() => { body.current?.focus(); body.current?.setSelectionRange(start, end); }); }
  function format([, , kind, mark, placeholder]) {
    const area = body.current, value = post.body, start = area?.selectionStart ?? value.length, end = area?.selectionEnd ?? value.length;
    const selected = value.slice(start, end);
    if (kind === 'wrap') { const text = selected || placeholder; return edit(value.slice(0, start) + mark + text + mark + value.slice(end), start + mark.length, start + mark.length + text.length); }
    if (kind === 'link') { const text = selected || 'link text', url = 'https://'; const next = `${value.slice(0, start)}[${text}](${url})${value.slice(end)}`; const at = start + text.length + 3; return edit(next, at, at + url.length); }
    const lineStart = value.lastIndexOf('\n', start - 1) + 1, block = value.slice(lineStart, end) || '';
    const lines = block.split('\n').map((line, index) => (kind === 'number' ? `${index + 1}. ` : mark) + line.replace(/^(#{1,3}\s+|[-*]\s+|\d+[.)]\s+|>\s?)/, ''));
    const replaced = lines.join('\n');
    edit(value.slice(0, lineStart) + replaced + value.slice(end), lineStart + replaced.length, lineStart + replaced.length);
  }
  async function addBodyPhoto(event) {
    const file = event.target.files[0]; event.target.value = ''; if (!file) return;
    setBusy('photo'); setError('');
    try {
      const image = await uploadPhoto(post.id, file);
      const area = body.current, at = area ? area.selectionEnd : post.body.length, value = post.body;
      const snippet = `${at && value[at - 1] !== '\n' ? '\n\n' : ''}![Describe this photo](${image.src})\n\n`;
      edit(value.slice(0, at) + snippet + value.slice(at), at + snippet.indexOf('Describe'), at + snippet.indexOf(']'));
      setNotice('Photo added. Replace “Describe this photo” with a short description.');
    } catch (e) { setError(e.message); } finally { setBusy(''); }
  }
  async function addCover(event) {
    const file = event.target.files[0]; event.target.value = ''; if (!file) return;
    setBusy('cover'); setError('');
    try { const image = await uploadPhoto(post.id, file); set({ cover: { type: 'upload', id: image.id }, coverAlt: '' }); }
    catch (e) { setError(e.message); } finally { setBusy(''); }
  }
  async function save(status) {
    setBusy('save'); setError(''); setNotice('');
    try {
      const { id, isNew, ...data } = post;
      const result = await request(`posts/${id}`, 'PUT', { title: data.title, slug: data.slug, description: data.description, body: data.body, cover: data.cover, coverAlt: data.coverAlt, status });
      setPost({ ...result }); setSaved(fields(result)); setSlugTouched(true); onSaved(result);
      setNotice(status === 'published' ? (published ? 'Changes published.' : 'Published. It’s live on the blog now.') : published ? 'Moved back to drafts. It’s no longer on the blog.' : 'Draft saved.');
    } catch (e) { setError(e.message); } finally { setBusy(''); }
  }
  async function remove() {
    if (!await confirmAction(`Delete “${post.title || 'this draft'}”? ${published ? 'It will be removed from the blog. ' : ''}This can’t be undone.`)) return;
    setBusy('delete'); setError('');
    try { await request(`posts/${post.id}`, 'DELETE'); onDeleted(post.id); } catch (e) { setError(e.message); setBusy(''); }
  }
  async function close() { if (!dirty || post.isNew && !post.title && !post.body || await confirmAction('Leave without saving your changes?')) onClose(); }
  const cover = coverSrc(post, 'card');
  return <section className="blog-editor" aria-label={post.isNew ? 'New post' : 'Edit post'}>
    <div className="blog-editor-bar">
      <button type="button" className="text-link" onClick={close}>← All posts</button>
      <span className={`status-pill ${published ? 'completed' : 'pending'}`}>{published ? 'Published' : 'Draft'}{dirty && !post.isNew ? ' · unsaved changes' : ''}</span>
      {published && post.publishedAt && <a className="text-link" href={`/blog/${post.slug}/`} target="_blank" rel="noreferrer">View on site ↗</a>}
    </div>
    <label className="blog-title-field">Title<input value={post.title} maxLength={120} onChange={e => setTitle(e.target.value)} placeholder="What’s this post about?"/></label>
    <label>Web address<span className="blog-slug"><span>dwightsgutters.com/blog/</span><input value={post.slug} maxLength={80} onChange={e => { setSlugTouched(true); set({ slug: slugify(e.target.value) || e.target.value.toLowerCase() }); }} placeholder="post-name"/></span>{post.publishedAt && <span className="field-help">Changing this after publishing breaks links people have already shared.</span>}</label>
    <label>Summary<textarea rows={2} maxLength={220} value={post.description} onChange={e => set({ description: e.target.value })} placeholder="One or two sentences shown on the blog page and in Google results."/><span className={`field-help${post.description.length > 160 ? ' warn' : ''}`}>{post.description.length}/160 recommended{post.description ? '' : ' · Leave blank to use the start of the post.'}</span></label>
    <fieldset className="blog-cover-field"><legend>Cover photo</legend>
      <div className="blog-cover-options">
        {brandCovers.map(option => <button type="button" key={option.name} aria-pressed={post.cover?.type === 'brand' && post.cover.name === option.name} onClick={() => set({ cover: { type: 'brand', name: option.name }, coverAlt: '' })}><img src={`/assets/${option.name}-640.webp`} alt=""/><span>{option.label}</span></button>)}
        {post.cover?.type === 'upload' && <button type="button" aria-pressed="true"><img src={cover} alt=""/><span>Your photo</span></button>}
        <button type="button" className="blog-cover-upload" disabled={Boolean(busy)} onClick={() => coverPhoto.current?.click()}><span aria-hidden="true">＋</span><span>{busy === 'cover' ? 'Uploading…' : 'Upload a photo'}</span></button>
        <input ref={coverPhoto} type="file" accept="image/*" hidden onChange={addCover}/>
      </div>
      <label>Photo description <small>(for screen readers and Google)</small><input value={post.coverAlt} maxLength={200} onChange={e => set({ coverAlt: e.target.value })} placeholder={coverAlt(post) || 'Describe what’s in the photo'}/></label>
    </fieldset>
    <div className="blog-body-field">
      <div className="blog-body-head"><span className="blog-field-label" id="post-body-label">Post</span><div className="blog-view-tabs" role="group" aria-label="Editor view">{[['write', 'Write'], ['preview', 'Preview']].map(([value, label]) => <button type="button" key={value} aria-pressed={view === value} onClick={() => setView(value)}>{label}</button>)}</div></div>
      {view === 'write' ? <>
        <div className="blog-toolbar" role="toolbar" aria-label="Formatting">{toolbar.map(item => <button type="button" key={item[0]} title={item[0]} aria-label={item[0]} onClick={() => format(item)}>{item[1]}</button>)}<button type="button" disabled={Boolean(busy)} onClick={() => bodyPhoto.current?.click()}>{busy === 'photo' ? 'Uploading…' : '＋ Photo'}</button><input ref={bodyPhoto} type="file" accept="image/*" hidden onChange={addBodyPhoto}/></div>
        <textarea ref={body} aria-labelledby="post-body-label" className="blog-body-input" rows={18} value={post.body} onChange={e => set({ body: e.target.value })} placeholder={'Start writing…\n\nLeave a blank line between paragraphs. Use the buttons above for headings, lists, links and photos.'}/>
        <details className="blog-help"><summary>Formatting tips</summary><ul><li><code>## Heading</code> and <code>### Subheading</code> at the start of a line</li><li><code>**bold**</code> and <code>*italic*</code></li><li><code>[link text](https://example.com)</code>, or <code>/book/</code> for a page on this site</li><li><code>- </code> for bullets, <code>1. </code> for numbered steps, <code>&gt; </code> for a quote</li><li>Leave a blank line between paragraphs</li></ul></details>
      </> : <article className="blog-preview post-body">{post.title && <h1 className="blog-preview-title">{post.title}</h1>}{post.body.trim() ? <PostBody body={post.body}/> : <p className="fine">Nothing to preview yet.</p>}</article>}
    </div>
    {error && <p className="notice error" role="alert">{error}</p>}
    {notice && <p className="notice" role="status">{notice}</p>}
    <div className="blog-editor-actions">
      {published ? <><button type="button" className="button" disabled={Boolean(busy)} onClick={() => save('published')}>{busy === 'save' ? 'Saving…' : 'Update post'}</button><button type="button" className="small-button secondary" disabled={Boolean(busy)} onClick={() => save('draft')}>Unpublish</button></>
        : <><button type="button" className="button" disabled={Boolean(busy)} onClick={() => save('published')}>{busy === 'save' ? 'Saving…' : 'Publish'}</button><button type="button" className="small-button secondary" disabled={Boolean(busy)} onClick={() => save('draft')}>Save draft</button></>}
      {!post.isNew && <button type="button" className="text-link danger" disabled={Boolean(busy)} onClick={remove}>Delete post</button>}
    </div>
  </section>;
}
export default function BlogManager() {
  const [posts, setPosts] = useState(null), [editing, setEditing] = useState(null), [error, setError] = useState(''), [message, setMessage] = useState('');
  useEffect(() => { request('posts').then(result => setPosts(result.items)).catch(e => setError(e.message)); }, []);
  const top = () => window.scrollTo({ top: document.querySelector('.admin-panel')?.offsetTop - 90 || 0, behavior: 'smooth' });
  function open(post) { setMessage(''); setEditing(post); top(); }
  if (editing) return <Editor key={editing.id} initial={editing} onClose={() => { setEditing(null); top(); }}
    onSaved={saved => setPosts(current => [saved, ...(current || []).filter(item => item.id !== saved.id)])}
    onDeleted={id => { setPosts(current => current.filter(item => item.id !== id)); setEditing(null); setMessage('Post deleted.'); top(); }}/>;
  return <>
    <div className="panel-heading"><div><h2>Blog</h2><p>Write posts for the <a className="text-link" href="/blog/" target="_blank" rel="noreferrer">blog ↗</a>. Drafts stay private until you publish them.</p></div><button type="button" className="button" onClick={() => open(blankPost())}>New post +</button></div>
    {message && <p className="notice" role="status">{message}</p>}
    {error && <p className="notice error" role="alert">{error}</p>}
    {!posts ? !error && <p role="status">Loading posts…</p> : !posts.length ? <div className="blog-admin-empty"><h3>No posts yet</h3><p>Helpful, local posts answer the questions customers search for, like when to clean gutters in oak season, and point them to booking.</p><button type="button" className="small-button" onClick={() => open(blankPost())}>Write your first post</button></div>
      : <ul className="blog-admin-list">{posts.map(post => <li key={post.id}>
        <img src={coverSrc(post, 'card') || '/assets/gutter-cleaning-640.webp'} alt="" loading="lazy"/>
        <div><span className={`status-pill ${post.status === 'published' ? 'completed' : 'pending'}`}>{post.status === 'published' ? 'Published' : 'Draft'}</span><h3>{post.title}</h3><p className="fine">{post.status === 'published' ? `Published ${shortDate(post.publishedAt)}` : `Last edited ${shortDate(post.updatedAt)}`} · {post.readingMinutes} min read</p></div>
        <div className="blog-admin-actions"><button type="button" className="small-button" onClick={() => open(post)}>Edit</button>{post.status === 'published' && <a className="text-link" href={`/blog/${post.slug}/`} target="_blank" rel="noreferrer">View ↗</a>}</div>
      </li>)}</ul>}
  </>;
}
