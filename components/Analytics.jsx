'use client';
import {isPrivatePage} from '../lib/pagePrivacy.mjs';
import Script from 'next/script';
import { usePathname } from 'next/navigation';
const measurementId = 'G-54W30QZN2P';
// Admin and appointment-change pages carry private tokens in the URL and aren't tracked.
export default function Analytics() {
  const pathname = usePathname() || '';
  if (process.env.NODE_ENV !== 'production' || isPrivatePage(pathname)) return null;
  return <>
    <Script src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`} strategy="afterInteractive"/>
    <Script id="google-analytics" strategy="afterInteractive">{`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${measurementId}');`}</Script>
  </>;
}
