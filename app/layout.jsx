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

// Google Consent Mode: analytics and ads storage start denied. It must run before the
// CookieScript banner, which updates consent when a visitor accepts.
const consentDefault = "window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',wait_for_update:500});";

export default function RootLayout({ children }) {
  return <html lang="en"><head><script dangerouslySetInnerHTML={{ __html: consentDefault }}/><script type="text/javascript" charSet="UTF-8" src="//cdn.cookie-script.com/s/c8318c85b862ad355fba0eab2b9141b6.js"></script><script src="https://analytics.ahrefs.com/analytics.js" data-key="L3xPJK/65u2SmjdoQcjk+g" async></script></head><body><Header />{children}<Footer /><Interactions /><Analytics /><JsonLd data={{ '@graph': [businessSchema(), websiteSchema()] }}/></body></html>;
}
