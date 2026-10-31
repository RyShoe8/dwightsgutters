import { pageMetadata } from '../../lib/seo.mjs';
import { businessPhone, businessPhoneHref } from '../../lib/business.mjs';
export const metadata = pageMetadata({ title: "Privacy Policy | Dwight's Gutters", description: 'What information Dwight’s Gutters collects when you book or contact us, how it’s used and shared, how long it’s kept, and your choices.', path: '/privacy-policy/' });
export default function Page() {
  return <main id="main"><section className="page-intro"><div className="container"><p className="eyebrow">WEBSITE INFORMATION</p><h1>Privacy Policy</h1><p className="lead">Short version: we collect what we need to schedule, do, and bill your job. We don’t sell your information or use it for advertising.</p></div></section><section className="section container legal">
    <p className="fine">Effective October 31, 2026</p>
    <p>This policy explains how Dwight’s Gutters (“we,” “us”), a gutter cleaning and repair business serving Austin, Texas and nearby cities, handles personal information collected through dwightsgutters.com, by email, and by phone.</p>

    <h2>Information we collect</h2>
    <p><strong>When you book an appointment:</strong> your name, email address, phone number (optional), preferred contact method, property address, city, and ZIP code, your home’s height, whether you have gutter guards, the service and time you choose, and any notes you add.</p>
    <p><strong>When you send a message or request a callback:</strong> your name, email address, phone number if you ask for a callback, and your message.</p>
    <p><strong>When we do the work:</strong> the final invoice total, hours for hourly repairs, the invoice number, and how you paid (for example, cash or check, Venmo, PayPal, or card). If you pay by card through Stripe, Stripe processes your card details; we never see or store your card number.</p>
    <p><strong>When you use the website:</strong> Google Analytics collects information about how visitors use the site, such as pages viewed, approximate location, device and browser type, and how you arrived. See our <a href="/cookie-policy/">Cookie Policy</a> for details. Like most websites, our hosting provider may also keep standard server logs, which include IP addresses.</p>
    <p>We don’t ask for and don’t want sensitive information such as Social Security numbers, financial account numbers, or health information. Please don’t include it in notes or messages.</p>

    <h2>How we use it</h2>
    <ul>
      <li>To schedule, confirm, change, and cancel appointments, and to check that your address is in our service area</li>
      <li>To do the work, invoice you, and record your payment</li>
      <li>To send booking confirmations, change and cancellation notices, and invoices by email, and to reply to your questions</li>
      <li>To keep business, tax, and accounting records</li>
      <li>To understand how the website is used and make it easier to book</li>
      <li>To keep the site and admin area secure and prevent abuse</li>
    </ul>
    <p>We don’t send marketing emails, and we don’t sell, rent, or share your personal information for advertising.</p>

    <h2>Who we share it with</h2>
    <p>We share information only with service providers that help us run the business, and only what they need to do their job:</p>
    <ul>
      <li><strong>Website hosting and database:</strong> our hosting provider and MongoDB Atlas store the website and booking records.</li>
      <li><strong>Email delivery:</strong> Resend sends booking confirmations and invoices on our behalf.</li>
      <li><strong>Payments:</strong> Stripe, Venmo, and PayPal process payments when you choose them, under their own privacy policies.</li>
      <li><strong>Analytics and site content:</strong> Google Analytics, Google Fonts, and OpenStreetMap map tiles, as described in our <a href="/cookie-policy/">Cookie Policy</a>.</li>
    </ul>
    <p>We may also disclose information if required by law, to protect our rights or the safety of others, or as part of a sale or transfer of the business, in which case this policy would continue to apply.</p>

    <h2>How long we keep it</h2>
    <p>We keep booking, invoice, and payment records for as long as we need them to serve you and to meet tax, accounting, and legal obligations. Messages and contact requests are kept while they’re useful for following up with you. Admin sign-in links and codes expire after 15 minutes, and admin sign-in sessions end after 90 days without use. Email message contents are removed from our system once they’ve been sent.</p>

    <h2>How we protect it</h2>
    <p>The website uses encrypted (HTTPS) connections. Access to customer records is limited to business staff who sign in with single-use email links. Links in your emails for changing an appointment use private, hard-to-guess tokens that are stored only in scrambled (hashed) form. No method of storage or transmission is perfectly secure, but we work to protect your information.</p>

    <h2>Your choices</h2>
    <p>You can ask us to show you, correct, or delete the personal information we hold about you by emailing <a href="mailto:dwight@dwightsgutters.com">dwight@dwightsgutters.com</a> or calling or texting <a href={businessPhoneHref}>{businessPhone}</a>. We’ll respond within 45 days. We may need to keep some records, such as invoices, when the law requires it. You can block or delete cookies, or opt out of Google Analytics, as described in our <a href="/cookie-policy/">Cookie Policy</a>.</p>

    <h2>Children</h2>
    <p>This website and our services are intended for adults. We don’t knowingly collect personal information from children under 13. If you believe a child has given us information, contact us and we’ll delete it.</p>

    <h2>Changes to this policy</h2>
    <p>If we change how we handle personal information, we’ll update this page and its effective date. See also our <a href="/terms/">Terms of Service</a>.</p>

    <h2>Contact</h2>
    <p>Questions about privacy? Email <a href="mailto:dwight@dwightsgutters.com">dwight@dwightsgutters.com</a> or call or text <a href={businessPhoneHref}>{businessPhone}</a>.</p>
  </section></main>;
}
