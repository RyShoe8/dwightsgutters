 'use client';
import Script from 'next/script';
import {usePathname} from 'next/navigation';
import {isPrivatePage} from '../lib/pagePrivacy.mjs';
export default function MarketingScripts(){
 const pathname=usePathname();
 if(!pathname||isPrivatePage(pathname))return null;
 return <><Script id="cookie-script" type="text/javascript" charSet="UTF-8" src="https://cdn.cookie-script.com/s/c8318c85b862ad355fba0eab2b9141b6.js" strategy="afterInteractive"/><Script id="ahrefs-analytics" src="https://analytics.ahrefs.com/analytics.js" data-key="L3xPJK/65u2SmjdoQcjk+g" strategy="afterInteractive"/></>;
}
