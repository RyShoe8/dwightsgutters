import { pageMetadata } from '../../lib/seo.mjs';
import { businessPhone, businessPhoneHref } from '../../lib/business.mjs';
export const metadata = pageMetadata({"title":"Cookie Policy | Dwight's Gutters","description":"How dwightsgutters.com uses cookies: Google Analytics to understand site visits, and one sign-in cookie for the business admin.","path":"/cookie-policy/"});
export default function Page() {
  return <main id="main"><section className="page-intro"><div className="container"><p className="eyebrow">WEBSITE INFORMATION</p><h1>Cookie Policy</h1><p className="lead">Short version: we use Google Analytics to see how people find and use the site, and one cookie to keep staff signed in. No advertising cookies.</p></div></section><section className="section container legal">
    <p className="fine">Effective October 31, 2026</p>
    <p>Cookies are small files a website stores in your browser. This page explains the cookies dwightsgutters.com uses and the outside services the site connects to.</p>

    <h2>Analytics cookies</h2>
    <p>We use Google Analytics to count visits and understand which pages are useful, how people arrive at the site, and where the booking process could be easier. It tells us about visits in aggregate, not who you are.</p>
    <ul>
      <li><strong>_ga</strong> tells one visitor’s browser apart from another. Lasts up to 2 years.</li>
      <li><strong>_ga_54W30QZN2P</strong> keeps track of the current visit. Lasts up to 2 years.</li>
    </ul>
    <p>Google Analytics doesn’t run on the admin area or the change-appointment page. Google processes this data under its own terms; see <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener noreferrer">how Google uses information from sites that use its services</a>. You can opt out on any site with the <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer">Google Analytics opt-out browser add-on</a>.</p>

    <h2>Sign-in cookie</h2>
    <p>We set one strictly necessary cookie, only for business staff who sign in to the admin area. Customers browsing the site, booking an appointment, or sending a message don’t receive it.</p>
    <ul>
      <li><strong>Name:</strong> dwight_admin</li>
      <li><strong>Purpose:</strong> keeps a staff member signed in to the admin area</li>
      <li><strong>Lasts:</strong> up to 90 days, renewed with use. It’s removed when you sign out.</li>
      <li><strong>Protections:</strong> it can’t be read by page scripts, is sent only to this site, and is sent only over secure connections.</li>
    </ul>

    <h2>What we don’t use</h2>
    <p>We don’t use advertising cookies, social media tracking, or retargeting pixels on this site.</p>

    <h2>Outside services</h2>
    <p>Some parts of the site load content from other providers. Your browser connects to them directly, so they can see your IP address:</p>
    <ul>
      <li><strong>Google Analytics</strong> (googletagmanager.com) loads the analytics script described above.</li>
      <li><strong>Google Fonts</strong> supplies the site’s typefaces.</li>
      <li><strong>OpenStreetMap</strong> supplies the map tiles on the Service Area page.</li>
    </ul>
    <p>When you follow a link to another site, such as our Google or Yelp reviews or a Stripe, Venmo, or PayPal payment page, that site’s own cookie and privacy policies apply.</p>

    <h2>Managing cookies</h2>
    <p>You can block or delete cookies in your browser settings, or use the opt-out add-on above to stop Google Analytics. Blocking cookies won’t affect browsing or booking on this site. Blocking the sign-in cookie only prevents signing in to the admin area.</p>

    <h2>Changes to this policy</h2>
    <p>If we change how the site uses cookies, we’ll update this page and its effective date. See our <a href="/terms/">Terms of Service</a> for how we handle the information you share with us.</p>

    <h2>Contact</h2>
    <p>Questions? Email <a href="mailto:dwight@dwightsgutters.com">dwight@dwightsgutters.com</a> or call or text <a href={businessPhoneHref}>{businessPhone}</a>.</p>
  </section></main>;
}
