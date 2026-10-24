import BrandPhoto from './BrandPhoto';
export default function ImageHero({ children, image, alt, caption }) {
  return <section className="image-hero"><div className="image-hero-copy">{children}</div><figure className="image-hero-photo"><BrandPhoto name={image} alt={alt} priority/><figcaption><span className="dot"/>{caption}</figcaption></figure></section>;
}
