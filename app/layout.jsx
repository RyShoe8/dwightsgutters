import './globals.css';
import './admin.css';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Interactions from '../components/Interactions';

export const metadata = {
  metadataBase: new URL('https://dwightsgutters.com'),
  title: "Dwight's Gutters | Austin Gutter Cleaning",
  openGraph: {
    title: "Dwight's Gutters | Austin Gutter Cleaning",
    images: [{ url: '/assets/social-preview-white.png', width: 1200, height: 630, alt: "Dwight's Gutters — Austin gutter cleaning" }],
  },
  twitter: {
    card: 'summary_large_image',
    title: "Dwight's Gutters | Austin Gutter Cleaning",
    images: ['/assets/social-preview-white.png'],
  },
  robots: { index: false, follow: false },
  icons: { icon: '/assets/favicon.png' },
};

export default function RootLayout({ children }) {
  const business = {'@context':'https://schema.org','@type':'Organization',name:"Dwight's Gutters",url:'https://dwightsgutters.com',email:'dwight@dwightsgutters.com',areaServed:{'@type':'City',name:'Austin, Texas'}};
  return <html lang="en"><body><Header />{children}<Footer /><Interactions /><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(business)}} /></body></html>;
}
