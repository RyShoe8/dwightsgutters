# Backend setup

The Next.js app now requires a Node.js server (Node 22+ recommended), not static hosting. MongoDB Atlas and Resend are the production integrations. No third-party CRM is needed.

## Local development without paid accounts

Run `npm ci`, then `npm run dev:local`. The first run downloads a MongoDB binary. This starts a single-node replica set in `.local/mongo`, seeds the admin, and runs Next at http://127.0.0.1:3000. Stop any existing server on port 3000 first. Local data persists between runs; `.local/` is ignored by git. This helper is for development only, not deployment.

Visit `/admin/sign-in/` and enter `dwight@dwightsgutters.com`. Open the newest `.local/mail/*.html` sign-in email and follow its link; it signs you in directly. No emails leave the computer in this mode. There is no default password or development authentication bypass.

The seed creates the admin identity, three services with no prices, and a closed schedule. It is repeatable and does not reset existing settings. Configure prices, enable services, set weekly hours, and enable online booking in admin before testing the public form. Local example prices should not be copied into production without Dwight's approval.

## Production setup

1. Create a MongoDB Atlas cluster (replica set transactions are required). Create a least-privilege database user with read/write access only to the application's database. Restrict network access for the hosting environment; enable backups for production.
2. Create a Resend account and verify `dwightsgutters.com` with the DNS records Resend supplies. Configure a sender such as `Dwight's Gutters <bookings@dwightsgutters.com>`. Replies go to `dwight@dwightsgutters.com`.
3. Configure the values from `.env.example` in the host's secret settings. `APP_URL` must be the exact HTTPS origin users visit, without a path. Use a separate database for preview environments. Never put database or email keys in `NEXT_PUBLIC_` variables.
4. The first API request initializes the database with insert-only seed writes: Dwight's admin identity, inactive unpriced services, and a closed schedule. Alternatively run `npm run db:seed` using the production environment. Locally, this command also reads `.env.local` if present. Existing settings are preserved. Dwight and ryanschumacher@themediashop.co are the seeded admins; changing `admins.enabled` to false revokes access, including existing sessions.
5. Deploy with `npm run build` and `npm start` on a Node host, or a Next.js-compatible host such as Vercel. The supplied start command binds to localhost for development; on a standalone hosting platform use `next start --hostname 0.0.0.0 --port $PORT` using that platform's environment syntax.
6. Set a long random `CRON_SECRET` in Vercel (Settings → Environment Variables). `vercel.json` schedules Vercel Cron to call `GET /api/cron/email/` once a day at 14:00 UTC, which queues seasonal-plan reminders and six-month follow-ups and sends up to 25 queued emails. Once a day is the most the Hobby plan allows; on Pro, change the schedule to `*/5 * * * *` so failed emails retry promptly. Otherwise configure a scheduler to call `GET` or `POST /api/cron/email/` every five minutes with `Authorization: Bearer <CRON_SECRET>`. The GET route supports Vercel Cron, which attaches this secret automatically when configured. Each run processes up to three due messages within the 60-second function limit. Schedule frequency depends on your hosting plan. This is required for automatic recovery when initial email delivery fails. An authenticated admin can also process due retries from the Email tab.
7. Sign in as Dwight, enter real starting prices, appointment durations, weekly hours, exceptions, notice, and travel buffer. Enable services and online booking. Test one booking with an address you control and check both confirmation emails.

No production accounts or credentials are included. Vercel environment variables are available only to deployments with the matching environment scope; redeploy after adding them. Set MONGODB_URI, RESEND_API_KEY, EMAIL_FROM, APP_URL (the exact public HTTPS origin), and CRON_SECRET. The first API request initializes the Atlas database using those credentials. Never run `dev:local` expecting Atlas access: it intentionally uses an isolated local database and captured mail. Keep existing noindex/robots protections until launch content and business policies are finalized.

## Behavior

- One crew, no overlapping appointments. Availability writes and bookings serialize through a MongoDB transaction lock; competing bookings recheck committed availability. Existing reservations survive schedule changes.
- All calendar rules use America/Chicago. Stored timestamps are UTC. Duration and buffer use elapsed minutes. Weekly hours and date exceptions are local wall-clock time.
- Prices are starting prices in USD. Each booking stores a price/name/duration snapshot. Invoices and customer rescheduling are supported as described below. Payment processing, recurring appointments, and multiple crews are not included.
- Customer records are matched by normalized email. Public bookings never overwrite private CRM notes or an existing contact's identity. Booking history preserves the submitted address/contact details even after a CRM edit.
- Authentication uses 15-minute single-use email links, hashed tokens, and 90-day server-side sessions that renew with each admin visit (sign out ends one immediately). Cookie is HttpOnly, SameSite Strict, Secure in production. Admin APIs enforce authorization. Mutations require same-origin requests. No public admin registration.
- Booking submissions use idempotency keys, authoritative server pricing, server-side validation, a honeypot, and database-backed global/email rate limits. Add host-level bot/rate protection before a broad public launch; application limits are conservative and do not trust spoofable forwarded IP headers.
- Confirmation/cancellation messages are saved atomically with the booking, then sent through an outbox. Delivery failure does not erase a reservation. Resend sends use idempotency keys. Automatic retries stop after eight attempts or 23 hours; older ambiguous sends require review in Resend before a manual resend to avoid duplicate mail beyond provider deduplication limits.
- Email status “accepted” means accepted by Resend, not delivered to an inbox. Delivery webhooks/bounce handling are not yet implemented. Local “captured” means saved under `.local/mail`, not sent.
- Sent email bodies are removed from the database. Login messages expire after 15 minutes. Customer records and booking history persist; implement business-specific retention policy before launch. Database backups and provider delivery monitoring are hosting responsibilities.
- Admin audit records capture who changed services, availability, customer details, and booking status.

## Validation

### Deployment connection failures

For `ERR_INVALID_URL` during sign-in, set `APP_URL` to the exact public origin including `https://` (for example `https://dwightsgutters.com`). A bare hostname is invalid. Apply the setting to the affected Vercel environment and redeploy.

`npm test` runs integration tests against an isolated MongoDB replica set and captures emails locally. `npm run build` validates the Next.js production build. Tests do not require Atlas or Resend and never send external emails.

## Admin sign-in codes

Each sign-in email includes a secure link and an eight-digit code. Enter the code with the same admin email on `/admin/sign-in/`. Both expire in 15 minutes and share a single-use credential: using either invalidates both. Requesting another email replaces the previous link/code. Codes allow five attempts per email issued, with an additional per-address rate limit. The secure link remains usable if code attempts are exhausted. Only enabled admins can redeem either option.

## Customer reviews

The homepage displays three Google reviews verified on October 28, 2026, with author attribution, source links, and Google's verified rating of 5.0 from seven reviews. `lib/reviewSnapshot.mjs` is the initial snapshot, not an automatically refreshed feed. Yelp remains a profile link until its rating/review can be verified; it is not included in the summary.

Snapshots live in MongoDB `settings` under `_id: reviews`. Initialization inserts the launch snapshot only if absent. `GET /api/reviews/` reads it, falling back to the dated launch snapshot during database failure. Authenticated admins can read or replace the full snapshot through `GET`/`PUT /api/admin/reviews/`; PUT uses the existing session cookie, same-origin protection, size limit, and schema validation. Review text is rendered as text, and attribution links are restricted to Google/Yelp reviewer URLs. To remove all displayed reviews, save `{ "sources": [] }`.

A snapshot contains `sources`, each with `id` (`google` or `yelp`), `rating`, total platform `count`, `verifiedAt` (`YYYY-MM-DD`), and selected `reviews` (`id`, `author`, `authorUrl`, integer `rating`, `text`). Totals must come from the full source rating/count, not the selected review cards. When both sources have verified data, the UI shows the count-weighted approximate combined rating and each source's individual rating/count. Platform averages are rounded, so this is not an exact recomputation of all individual star ratings.

Automated refresh is **not configured**. On October 28, the Nucleas VPS browser worker hit Google's unusual-traffic page; Yelp showed device verification in the browser. No CAPTCHA or access-control bypass was attempted. Do not claim that this snapshot is live or automatically remove reviews based on a blocked/incomplete scrape. A future working importer must handle review edits/deletions, retain attribution, validate source totals, and update `verifiedAt` only after successful verification.

## Confirmations, appointment changes, and completion invoices

Booking confirmations include the booked service, starting price, full Austin-local appointment date/time, property address, contact-form link, business phone, and a private change-appointment link. The main business number, (737) 425-1697, lives in `lib/business.mjs`; **Admin → Staff** can override it for emails. New settings are read when each email is queued; existing queued emails and issued invoices keep their original content.

New bookings store only the hash of a random 256-bit appointment-management token. Its raw value travels in the email link's URL fragment, is removed from the address bar by `/book/change/`, and is submitted in JSON bodies, never URL query strings. The page discloses only service/time information, not customer contact information. Both detail lookup and update enforce the original appointment being at least 48 elapsed hours away; target times must be at least 48 hours away and satisfy notice, hours, buffer and horizon constraints. At exactly 48 hours a change is allowed. The shared schedule transaction lock prevents a new booking or another reschedule from claiming the same slot. Rescheduling preserves the original service/price snapshot and customer reference, queues updated emails, and releases the old slot atomically. The link continues to manage the same appointment until its current cutoff or cancellation/completion. Old bookings created before this feature do not have change links; existing emails are not retroactively modified.

**Booking complete** opens a final-total review for a booking that has started. The booked price (service plus any add-ons) is prefilled; Dwight must confirm the final USD total, including any applicable taxes, before sending. Completion saves the immutable invoice and queues its email in the same transaction. Retries reuse the saved invoice and outbox ID, so repeated clicks do not create duplicate invoices. Invoice numbers use a transaction-protected annual sequence. The invoice includes service, property, appointment, final total, number, contact link, phone and all configured payment options. An invoice is not a paid receipt; there is no payment-status reconciliation or automatic charging.

Configure accepted payment methods under **Admin → Payments** before issuing an invoice. Invoices list the enabled methods sorted by estimated processing fee on that invoice's total, lowest first (ties keep the Payments order). Each method has an editable fee percentage and fixed fee, prefilled with typical rates: cash, check, Zelle and bank transfer 0; Venmo 1.9% + $0.10; Stripe and card links 2.9% + $0.30; PayPal 3.49% + $0.49. Fees only set the order. Never enter private banking credentials in customer-visible instructions.

Links carry the exact invoice total where possible:
- **Stripe** needs `STRIPE_SECRET_KEY`. Completing a booking creates a Stripe Price and a one-time Payment Link (limited to one completed checkout, with `booking_id` metadata) for the final total. The call happens before the database transaction with an idempotency key of booking + total, so retries and double clicks reuse the same link. A Stripe failure leaves the booking open with a message to retry. Totals under $0.50 omit Stripe.
- **Venmo** stores the business username and links to `venmo.com/?txn=pay` with recipient, amount and "Invoice DG-…" note prefilled.
- **PayPal** fills in the amount when the link is a PayPal.Me link (`paypal.me/name` or `paypal.com/paypalme/name`).
- Other links (Card / digital wallet) can't carry an amount; the invoice tells the customer to enter the total.

Invoice and rescheduling emails use the existing durable outbox and appear in Admin → Email. An initial delivery failure cannot roll back a committed appointment change or completion. The existing authenticated email cron must remain scheduled for retries. Nothing sends real email in the integration suite; it uses isolated replica sets and captured email files.


### Payments setup

Admin → Payments stores its own versioned settings document (`settings._id: payments`). Stripe has an enable switch, instructions and fees; it can be enabled only while `STRIPE_SECRET_KEY` is set in the environment (the key is never stored in the database). Venmo has a username, instructions and fees. Settings saved by earlier versions migrate on read: the fixed Stripe link is dropped, and the Venmo username is taken from the old profile URL (Venmo stays off if none can be found). Staff now manages contact details only. Options previously stored in Staff remain available until the first Payments save; generic card links are retained without being mislabeled as Stripe. Concurrent saves are rejected when the revision is stale. Only enabled providers and additional accepted methods are included in new invoice snapshots. Existing invoices never change when payment configuration changes.

Stripe determines which cards and wallets appear at its checkout. Venmo and PayPal payments happen in those apps. The site does not issue refunds, receive payment webhooks, or automatically mark invoices paid.

### Services and add-ons

Bookable services are Gutter cleaning, Seasonal upkeep and Gutter repair, each seeded inactive and unpriced. Bookings accept one- and two-story homes only. Each service has an optional two-story price (blank means the standard price); Gutter cleaning is seeded once at $300 for two-story homes. The booking form asks for home height next to the service so the shown price matches, and add-ons are added on top. Gutter repair is hourly: `hourlyRateCents` is the rate and `priceCents` is the minimum charge (seeded once at $50/hour, $50 minimum). It has `appliesTo` cleaning services, so it books on its own or as a cleaning add-on; any service listing a service id in `appliesTo` is offered as its add-on. At Booking complete, Dwight enters repair hours (quarter-hour steps), which fill in the total (rate × hours, never below the minimum); the invoice records and emails the hours and rate. Downspout concern is an add-on (`kind: 'addon'`, `appliesTo` cleaning services): the booking form offers it as a checkbox, and its price and minutes are added to the service. The booking stores one combined service snapshot (for example "Gutter cleaning + Downspout concern") with an `addOns` breakdown, so slots, rescheduling, emails and the invoice prefill all use the combined price and length. Seeding converts an older standalone Downspout concern once; an unconfigured one also drops to 30 minutes. Bookings made before the change keep their original snapshot.

### Recording payments

Payments has dedicated cards for Stripe, Venmo, PayPal (PayPal.Me name; invoice links carry the amount) and Cash or check (no fee, so it lists first). Zelle, bank transfer, card links and Other remain additional methods. Settings saved before this change migrate on read and on save: a PayPal.Me link becomes the PayPal card, cash and check entries become the Cash or check card (their instructions combined), and a non-PayPal.Me PayPal link becomes an Other method.

Completed bookings show **Awaiting payment** or **Paid**. Dwight marks a job paid in Bookings by choosing how it was received (Cash or check is the default); **Undo** clears a mistaken record. The Bookings filter **Awaiting payment** lists completed jobs with no payment recorded. Records store method, amount (the invoice total), time, and who recorded it.

Stripe payments are recorded automatically. In the Stripe dashboard, add a webhook endpoint for `https://dwightsgutters.com/api/webhooks/stripe/` (keep the trailing slash; the site redirects URLs without it and Stripe doesn't follow redirects) for `checkout.session.completed` and `checkout.session.async_payment_succeeded`, then set its signing secret as `STRIPE_WEBHOOK_SECRET`. The endpoint verifies the signature (5-minute tolerance), reads `booking_id` from the checkout metadata copied from the invoice's Payment Link, and records the payment once. Events for unknown or not-yet-completed bookings are acknowledged and ignored. Venmo, PayPal.Me, Zelle and cash have no notification the site can receive, so those are marked by hand.

## SEO, city landing pages and crawlers

- **City pages:** `/gutter-cleaning/<city>/` and `/gutter-repair/<city>/` for each city in `lib/cities.mjs` (13 cities; Austin rolls up its neighborhood ZIP groups), plus hub pages `/gutter-cleaning/` and `/gutter-repair/`. City ZIPs come from `lib/coverage-data.mjs`. A city page exists only while at least one of its ZIPs is enabled in Admin → Services → coverage; otherwise it returns 404 and drops out of the sitemap. Prices, coverage and the review rating are read live (`lib/siteData.mjs`); if the database is unreachable during a build, pages fall back to all areas, the review snapshot, and no prices.
- **Refresh:** marketing pages, the sitemap and llms.txt regenerate hourly, and immediately when an admin saves coverage, a service, or reviews.
- **Metadata:** every public page sets a title, description, canonical URL and social cards through `pageMetadata()` in `lib/seo.mjs`. The site is indexable; admin and change-appointment pages are `noindex`.
- **Structured data:** every page carries a `HomeAndConstructionBusiness` + `WebSite` graph (phone, email, cities served, Google/Yelp profiles). City pages add `Service`, `BreadcrumbList` and `FAQPage`; hubs add an `ItemList`; Services adds an `OfferCatalog`. Review stars are not marked up, since Google ignores self-hosted business reviews.
- **robots.txt** (`app/robots.js`): allows the site, blocks `/admin/`, `/book/change/` and `/api/` (except the catalog, reviews and coverage endpoints pages use when rendered), and lists the sitemap. AI search and assistant crawlers (GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, Google-Extended and others) are explicitly allowed with the same rules. Don't add `public/robots.txt`; it would override the generated file.
- **sitemap.xml** (`app/sitemap.js`): public pages plus every enabled city page.
- **llms.txt** (`/llms.txt`): a plain-language fact sheet (services, live prices, area, contact, links to every city page) for AI assistants to read and cite.
- After deploying, submit `https://dwightsgutters.com/sitemap.xml` in Google Search Console and Bing Webmaster Tools.

## Customer addresses, phone formatting, and booking visibility

US phone numbers display and save as `555-555-5555` across booking/contact forms, Staff, customer records, admin booking lists and customer emails. Existing stored numbers are formatted when read/displayed; international numbers and extensions are preserved. Telephone/SMS destinations remain dialable. Customer phone search accepts raw digits or formatted numbers.

New customers receive the street address, city, and ZIP from their booking. Repeat bookings fill missing customer address fields while preserving an admin-entered address and private notes. For older records missing those fields, the customer list reads the latest booking address as a fallback; saving customer details persists the address. Booking property snapshots remain unchanged. Addresses can be edited in the customer details form.

Admin Bookings now defaults to All bookings. Requests with customer notes still reserve a slot and wait in Needs confirmation; they are included in the default list rather than hidden behind the previous Confirmed filter. A customer and its booking are created in the same transaction, so this display fix does not create replacement appointments or duplicate customer records.

## Admin replies and contact categories

Customers now has two categories: Customers and Inquiries. Existing lead-kind form submissions appear under Inquiries; manually created customer records remain visible under Customers regardless of booking history. New cleaning-request submissions are inquiries. No records are deleted by this category change.

Bookings and inquiry details offer Reply by email. The server derives the recipient from the selected record, validates the message, and atomically saves reply history with an email outbox entry. A request UUID prevents duplicate sends on retries. History shows the delivery status and admin sender; an email-provider acceptance is not a delivery receipt. Customer responses go to Dwight's existing email inbox and are not imported into admin. The Email section includes these reply messages.

Payment processing estimates are internal business costs used to order available payment methods. Customers pay the invoice total with every method; the preview and invoice do not add or display a processing surcharge.


## Owner notifications

New bookings email Dwight at dwight@dwightsgutters.com, including pending bookings and phone-preferred customers. Notifications include contact details, property, service, starting prices, Austin appointment times, notes and both visits for seasonal plans. New contact-form and cleaning-request inquiries email their submitted details and callback preference. Inquiry storage and notification queuing share a transaction; retries do not duplicate notifications. Delivery uses the existing email outbox with immediate processing and scheduled retries.

Notification buttons open the specific booking or inquiry, or open its email reply composer. These are record links, not authentication tokens: the normal secure admin sign-in is required. The selected destination survives the sign-in flow in the same browser tab. Linked bookings can be managed through the existing booking controls; Show all bookings clears the record filter. Inquiry notifications appear in the admin Email delivery list.


The compliance mailing address is included only in promotional discount/review and rebooking emails, in both HTML and plain text, alongside reply-to-opt-out instructions. It is kept in the server messaging module, outside shared public business data, page content, metadata and structured data. Routine confirmations, invoices, owner notifications and sign-in emails do not include it.


## Staff access and personal availability

Admin sign-in accounts have Owner or Staff access. Dwight remains an enabled Owner; the existing Media Shop administrator retains Owner access during migration. Owners add or edit names, sign-in emails, roles and enabled status in Staff. No invitation email is sent automatically. Disabled accounts lose their active sessions and unused sign-in tokens. An Owner cannot demote or disable themselves; another Owner must do that. Membership changes are audited.

Roles are checked from the current account on each admin API request. Staff can view the shared booking list, reply to booking customers, confirm/cancel bookings, prepare confirmation/invoice texts, and complete jobs with invoices. Staff cannot access CRM customers/inquiries, business availability, service/coverage changes, payment configuration, payment recording, deletion, staff management or the email delivery log. Payment options needed for invoice preparation remain available to their booking workflow.

My schedule stores personal availability separately in staffSchedules, keyed by the signed-in account's email. Staff cannot read or update another person's schedule. Owners can select any team member here. Personal hours do not change online booking slots; the Owner-controlled Availability section remains the single-crew business calendar.

PayPal and Venmo cards include expandable setup instructions with official help links. Venmo takes the business profile @username rather than a numeric ID; PayPal takes the PayPal.Me name and accepts a pasted PayPal.Me URL.

## Deleting records

Owners have Delete customer in the saved customer editor and Delete booking on booking cards. Both require confirmation. Customers with booking history must have those bookings deleted first. Deleting a seasonal booking deletes both visits and releases their time slots. Deletion does not send a cancellation email; cancel the booking instead when a customer needs notification. Invoice/payment-bearing bookings are retained, and deletion waits if a related email is in flight. Pending booking/reply mail is stopped, booking reply history is removed, and audit entries retain the IDs, actor and time. Existing delivered email cannot be recalled. Deletion is permanent; no trash/restore interface is provided.


Booking consent explains that the customer receives a starting quote based on submitted details, approves any scope/price changes before work begins, and pays the invoice in full after completion. The phone field is optional even if Phone was selected: a blank number routes the booking and quote to email. Provided phone-contact numbers still require basic validation. Terms effective November 5, 2026 describe this process and separate payment for each completed seasonal visit.

The public payment-methods endpoint returns enabled method names only (Stripe also needs a connected key). It omits instructions, fee estimates, usernames and payment links. Booking displays these names in a payment panel, refreshed every minute and when the window regains focus. No methods are advertised when settings are unavailable; the panel asks the customer to confirm arrangements with Dwight instead.


## Security controls and regression checks

Private admin and appointment-change pages exclude third-party marketing/consent scripts and carry a restrictive Content Security Policy (same-origin scripts/connections, no embedding, forms limited to the same origin). Public pages retain consent and analytics. HSTS is sent with the existing frame, referrer and MIME-sniffing protections. Admin API responses remain no-store. Keep APP_URL as the full HTTPS production origin; secret keys remain server environment variables.

Stripe webhook signatures reject malformed timestamps/signatures and stale requests. An automatic Stripe payment must be in USD and exactly match the saved invoice total before the booking is marked paid. An unmatched payment leaves the invoice unpaid for operator review. Stripe network calls have a timeout; provider idempotency keys remain in place.

Run npm test and npm run build for regressions, npm audit for dependency advisories, and npm run dev:local followed by node scripts/verify-local.mjs for isolated HTTP checks. The HTTP verifier covers sign-in, replay/CSRF, role enforcement, self-promotion denial, private scripts/headers, optional-phone booking, email capture, CRM and cancellation. It targets loopback only and sends no real email. Deployment permissions, provider account settings, database network access and backup recovery require separate infrastructure verification.

## Admin → Media

Owners get a Media tab listing the brand assets from `branding/`, grouped in `lib/mediaLibrary.mjs`. `scripts/prepare-media.mjs` runs before `dev`, `dev:local` and `build`, copying those files to `public/media-library/` (gitignored) with small WebP previews. To add an asset, put it in `branding/` and list it in `lib/mediaLibrary.mjs`; `tests/media.test.mjs` fails if a file and the list disagree. The tab is owner-only, but the files themselves are public URLs (blocked in robots.txt), so don't put anything private in the library.

Two-story appointment length: each bookable service has an optional `twoStoryDurationMinutes` (Admin → Services; blank uses the one-story length). Seeding sets 90 minutes once on Gutter cleaning, Seasonal upkeep and Gutter repair when their one-story length is under 90. Slots and dates take a `stories` parameter so two-story customers only see times where the full appointment fits. Bookings keep the length saved when they were made.

## Job photos

Owners and staff add photos from a booking (Bookings → Add photos, which opens the camera on a phone). The browser shrinks each photo to a JPEG of at most about 2.4 MB plus a thumbnail (`lib/photoUpload.mjs`) and uploads them one at a time, which keeps each request under Vercel's request limit and removes location data. `lib/jobPhotos.mjs` stores them in the `jobPhotos` MongoDB collection, up to 40 per job. They are only served to signed-in admins, never from `public/`. Staff can view and add photos on any booking and delete their own; owners can delete any. Owners see every photo in Media → Jobs, grouped by booking. Deleting a booking deletes its photos.

Photos count against the MongoDB storage quota: expect roughly 0.5 MB each on average, or about 1,000 photos per 512 MB.
