import './globals.css';
import './admin.css';
import './photography.css';
import './coverage.css';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Interactions from '../components/Interactions';
import Analytics from '../components/Analytics';
import JsonLd from '../components/JsonLd';
import { businessSchema, pageMetadata, siteName, siteUrl, websiteSchema } from '../lib/seo.mjs';

export const metadata = {
  metadataBase: new URL(siteUrl),
  ...pageMetadata({ title: "Gutter Cleaning & Repair in Austin, TX | Dwight's Gutters", description: 'Veteran-owned gutter cleaning and gutter repair for one- and two-story homes in Austin and surrounding cities. Upfront pricing and online booking.', path: '/' }),
  applicationName: siteName,
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
  icons: { icon: '/assets/favicon.png' },
};

export default function RootLayout({ children }) {
  return <html lang="en"><body><Header />{children}<Footer /><Interactions /><Analytics /><JsonLd data={{ '@graph': [businessSchema(), websiteSchema()] }}/></body></html>;
}
