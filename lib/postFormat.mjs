// Blog posts are written in a small, safe subset of Markdown. The parser turns the text into
// plain data, so nothing a post contains is ever inserted into the page as raw HTML.
//   ## Heading   ### Subheading   **bold**   *italic*   [link text](https://…)
//   - bullet     1. numbered       > quote    ![photo description](/api/blog-images/…/full/)
const blogImage = /^\/api\/blog-images\/[0-9a-f-]{36}\/(?:full|card)\/$/;
const brandAsset = /^\/assets\/[a-z0-9-]+\.(?:webp|png|jpg)$/;
export const safeImageSrc = src => blogImage.test(src) || brandAsset.test(src);
export function safeHref(href) {
  if (/^\/(?!\/)/.test(href) || /^#[\w-]+$/.test(href)) return href;
  if (/^(?:https?:\/\/|mailto:|tel:)/i.test(href)) return href;
  return null;
}
export const headingId = text => text.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
const INLINE = /\*\*(.+?)\*\*|\*(?!\s)(.+?)\*|\[([^\]\n]+)\]\(([^)\s]+)\)/g;
// Inline text: a list of plain strings and { bold | italic | link } parts.
export function parseInline(text) {
  const parts = [];
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    if (match[1] !== undefined) parts.push({ bold: parseInline(match[1]) });
    else if (match[2] !== undefined) parts.push({ italic: parseInline(match[2]) });
    else {
      const href = safeHref(match[4]);
      parts.push(href ? { href, children: parseInline(match[3]) } : match[0]);
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}
export function parsePost(body = '') {
  const blocks = [], lines = String(body).replace(/\r\n?/g, '\n').split('\n');
  let paragraph = [], list = null, quote = [];
  const flush = () => {
    if (paragraph.length) blocks.push({ type: 'p', text: parseInline(paragraph.join(' ')) });
    if (list) blocks.push(list);
    if (quote.length) blocks.push({ type: 'quote', text: parseInline(quote.join(' ')) });
    paragraph = []; list = null; quote = [];
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    const image = /^!\[([^\]\n]*)\]\(([^)\s]+)\)$/.exec(line);
    const bullet = /^[-*]\s+(.+)$/.exec(line), numbered = /^\d+[.)]\s+(.+)$/.exec(line), quoted = /^>\s?(.*)$/.exec(line);
    if (heading) { flush(); const text = heading[2].replace(/#+$/, '').trim(); blocks.push({ type: heading[1].length === 3 ? 'h3' : 'h2', id: headingId(text), text: parseInline(text) }); }
    else if (image) { flush(); if (safeImageSrc(image[2])) blocks.push({ type: 'img', src: image[2], alt: image[1].trim() }); }
    else if (bullet || numbered) {
      const type = bullet ? 'ul' : 'ol';
      if (paragraph.length || quote.length || (list && list.type !== type)) flush();
      list ||= { type, items: [] };
      list.items.push(parseInline((bullet || numbered)[1]));
    }
    else if (quoted) { if (paragraph.length || list) flush(); quote.push(quoted[1]); }
    else { if (list || quote.length) flush(); paragraph.push(line); }
  }
  flush();
  return blocks;
}
// Plain text for summaries, reading time and feeds.
const inlineText = parts => parts.map(part => typeof part === 'string' ? part : inlineText(part.bold || part.italic || part.children)).join('');
export function plainText(body = '') {
  return parsePost(body).map(block => block.type === 'img' ? '' : block.items ? block.items.map(inlineText).join(' ') : inlineText(block.text)).filter(Boolean).join(' ');
}
export const readingMinutes = body => Math.max(1, Math.round(plainText(body).split(/\s+/).filter(Boolean).length / 220));
export function excerpt(body = '', length = 180) {
  const text = plainText(body);
  if (text.length <= length) return text;
  return `${text.slice(0, length).replace(/\s+\S*$/, '')}…`;
}
