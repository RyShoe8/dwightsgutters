import { parsePost } from '../lib/postFormat.mjs';
// Renders a post written in the blog's Markdown subset (lib/postFormat.mjs). Used on the site
// and for the admin preview, so both always match.
function Inline({ parts }) {
  return parts.map((part, index) => {
    if (typeof part === 'string') return part;
    if (part.bold) return <strong key={index}><Inline parts={part.bold}/></strong>;
    if (part.italic) return <em key={index}><Inline parts={part.italic}/></em>;
    const external = /^https?:\/\//i.test(part.href) && !/^https?:\/\/(www\.)?dwightsgutters\.com/i.test(part.href);
    return <a key={index} href={part.href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}><Inline parts={part.children}/></a>;
  });
}
export default function PostBody({ body }) {
  return parsePost(body).map((block, index) => {
    switch (block.type) {
      case 'h2': return <h2 key={index} id={block.id}><Inline parts={block.text}/></h2>;
      case 'h3': return <h3 key={index} id={block.id}><Inline parts={block.text}/></h3>;
      case 'ul': return <ul key={index}>{block.items.map((item, i) => <li key={i}><Inline parts={item}/></li>)}</ul>;
      case 'ol': return <ol key={index}>{block.items.map((item, i) => <li key={i}><Inline parts={item}/></li>)}</ol>;
      case 'quote': return <blockquote key={index}><p><Inline parts={block.text}/></p></blockquote>;
      case 'img': return <figure key={index}><img src={block.src} alt={block.alt} loading="lazy" decoding="async"/></figure>;
      default: return <p key={index}><Inline parts={block.text}/></p>;
    }
  });
}
