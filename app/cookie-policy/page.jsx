import { businessPhone, businessPhoneHref } from '../../lib/business.mjs';
export const metadata = { title: "Cookie Policy | Dwight's Gutters", description: 'How dwightsgutters.com uses cookies: one sign-in cookie for the business admin, and no tracking or advertising cookies.' };
export default function Page() {
  return <main id="main"><section className="page-intro"><div className="container"><p className="eyebrow">WEBSITE INFORMATION</p><h1>Cookie Policy</h1><p className="lead">Short version: we don’t track you. Browsing or booking on this site doesn’t set any cookies.</p></div></section><section className="section container legal">
    <p className="fine">Effective October 31, 2026</p>
    <p>Cookies are small files a website stores in your browser. This page explains the one cookie dwightsgutters.com uses and the outside services the site connects to.</p>

    <h2>The cookie we use</h2>
    <p>We set a single, strictly necessary cookie, and only for business staff who sign in to the admin area. Customers browsing the site, booking an appointment, or sending a message don’t receive it.</p>
    <ul>
      <li><strong>Name:</strong> dwight_admin</li>
      <li><strong>Purpose:</strong> keeps a staff member signed in to the admin area</li>
      <li><strong>Lasts:</strong> up to 90 days, renewed with use. It’s removed when you sign out.</li>
      <li><strong>Protections:</strong> it can’t be read by page scripts, is sent only to this site, and is sent only over secure connections.</li>
    </ul>

    <h2>What we don’t use</h2>
    <p>We don’t use analytics, advertising, or social media cookies, tracking pixels, or similar technologies. We don’t store information in your browser’s local storage. Because we only use a cookie that’s strictly necessary for signing in, we don’t show a cookie consent banner.</p>

    <h2>Outside services</h2>
    <p>Some parts of the site load content from other providers. Your browser connects to them directly, so they can see your IP address, but they don’t set cookies through our pages:</p>
    <ul>
      <li><strong>Google Fonts</strong> supplies the site’s typefaces.</li>
      <li><strong>OpenStreetMap</strong> supplies the map tiles on the Service Area page.</li>
    </ul>
    <p>When you follow a link to another site, such as our Google or Yelp reviews or a Stripe, Venmo, or PayPal payment page, that site’s own cookie and privacy policies apply.</p>

    <h2>Managing cookies</h2>
    <p>You can block or delete cookies in your browser settings. Blocking cookies won’t affect browsing or booking on this site. It only prevents signing in to the admin area.</p>

    <h2>Changes to this policy</h2>
    <p>If we change how the site uses cookies, we’ll update this page and its effective date. See our <a href="/terms/">Terms of Service</a> for how we handle the information you share with us.</p>

    <h2>Contact</h2>
    <p>Questions? Email <a href="mailto:dwight@dwightsgutters.com">dwight@dwightsgutters.com</a> or call or text <a href={businessPhoneHref}>{businessPhone}</a>.</p>
  </section></main>;
}
