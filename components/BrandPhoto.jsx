export default function BrandPhoto({ name, alt, priority = false, sizes = '(max-width: 700px) 100vw, 50vw', className = '' }) {
  return <img className={className} src={`/assets/${name}-1536.webp`} srcSet={[640, 960, 1536].map(width => `/assets/${name}-${width}.webp ${width}w`).join(', ')} sizes={sizes} alt={alt} width="1536" height="1024" loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'auto'} decoding="async"/>;
}
