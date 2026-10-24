import './globals.css';
import './admin.css';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Interactions from '../components/Interactions';

export const metadata = {
  metadataBase: new URL('https://dwightsgutters.com'),
  title: "Dwight's Gutters | Austin Gutter Cleaning",
  robots: { index: false, follow: false },
  icons: { icon: '/assets/favicon.png' },
};

export default function RootLayout({ children }) {
  const business = {'@context':'https://schema.org','@type':'Organization',name:"Dwight's Gutters",url:'https://dwightsgutters.com',email:'dwight@dwightsgutters.com',areaServed:{'@type':'City',name:'Austin, Texas'}};
  return <html lang="en"><body><Header />{children}<Footer /><Interactions /><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(business)}} /></body></html>;
}
