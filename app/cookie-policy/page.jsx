import { pageMetadata } from '../../lib/seo.mjs';
import { businessPhone, businessPhoneHref } from '../../lib/business.mjs';
import CookieSettingsLink from '../../components/CookieSettingsLink';
export const metadata = pageMetadata({ title: "Cookie Policy | Dwight's Gutters", description: 'How dwightsgutters.com uses cookies: a consent banner you control, optional Google Analytics cookies only after you accept, and strictly necessary cookies.', path: '/cookie-policy/' });
export default function Page() {
  return <main id="main"><section className="page-intro"><div className="container"><p className="eyebrow">WEBSITE INFORMATION</p><h1>Cookie Policy</h1><p className="lead">Short version: analytics cookies are off until you choose “Accept all.” You can change your choice any time.</p></div></section><section className="section container legal">
    <p className="fine">Effective November 1, 2026</p>
    <p>Cookies are small files a website stores in your browser. This page explains the cookies dwightsgutters.com uses, how you control them, and the outside services the site connects to.</p>

    <h2>Your choice</h2>
    <p>When you first visit, a cookie banner asks whether you accept optional cookies. Only strictly necessary cookies are used until you choose. If you select “Accept all,” we use analytics cookies to understand how the site is used. If you select “Decline all,” we don’t.</p>
    <p>You can change your choice at any time: <CookieSettingsLink>open cookie settings</CookieSettingsLink>, or use the “Cookie settings” link at the bottom of every page.</p>

    <h2>Strictly necessary cookies</h2>
    <p>These keep the site working and remember your choice. They don’t require consent.</p>
    <ul>
      <li><strong>CookieScriptConsent</strong> remembers your cookie choice so the banner doesn’t ask again. Lasts 1 year.</li>
      <li><strong>dwight_admin</strong> keeps business staff signed in to the admin area. Customers never receive it. Lasts up to 90 days, renewed with use, and is removed on sign-out. It can’t be read by page scripts and is sent only to this site over secure connections.</li>
    </ul>

    <h2>Analytics cookies (only if you accept)</h2>
    <p>With your consent, Google Analytics helps us count visits and see which pages are useful, how people arrive at the site, and where booking could be easier. It tells us about visits in aggregate, not who you are.</p>
    <ul>
      <li><strong>_ga</strong> tells one visitor’s browser apart from another. Lasts about 13 months.</li>
      <li><strong>_ga_54W30QZN2P</strong> keeps track of the current visit. Lasts about 13 months.</li>
    </ul>
    <p>The site uses Google Consent Mode. Until you accept, Google Analytics doesn’t set or read cookies; it may receive basic, cookieless signals (such as that a page was viewed) that Google uses to model overall traffic. Google Analytics doesn’t run on the admin area or the change-appointment page. Google processes this data under its own terms; see <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener noreferrer">how Google uses information from sites that use its services</a>. You can also opt out on every site with the <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer">Google Analytics opt-out browser add-on</a>.</p>

    <h2>What we don’t use</h2>
    <p>We don’t use advertising cookies, social media tracking, or retargeting pixels on this site.</p>

    <h2>Outside services</h2>
    <p>Some parts of the site load content from other providers. Your browser connects to them directly, so they can see your IP address:</p>
    <ul>
      <li><strong>CookieScript</strong> (cookie-script.com) provides the cookie banner and stores your choice.</li>
      <li><strong>Google Analytics</strong> (googletagmanager.com) loads the analytics script described above.</li>
      <li><strong>Google Fonts</strong> supplies the site’s typefaces.</li>
      <li><strong>OpenStreetMap</strong> supplies the map tiles on the Service Area page.</li>
    </ul>
    <p>When you follow a link to another site, such as our Google or Yelp reviews or a Stripe, Venmo, or PayPal payment page, that site’s own cookie and privacy policies apply.</p>

    <h2>Managing cookies in your browser</h2>
    <p>You can also block or delete cookies in your browser settings. Blocking cookies won’t affect browsing or booking on this site, though the banner may ask again. Blocking the sign-in cookie only prevents signing in to the admin area.</p>

    <h2>Changes to this policy</h2>
    <p>If we change how the site uses cookies, we’ll update this page and its effective date. See our <a href="/privacy-policy/">Privacy Policy</a> for how we handle the information you share with us.</p>

    <h2>Contact</h2>
    <p>Questions? Email <a href="mailto:dwight@dwightsgutters.com">dwight@dwightsgutters.com</a> or call or text <a href={businessPhoneHref}>{businessPhone}</a>.</p>
  </section></main>;
}
