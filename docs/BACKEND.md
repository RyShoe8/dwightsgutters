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
6. Set a long random `CRON_SECRET`. Configure a scheduler to call `GET` or `POST /api/cron/email/` every five minutes with `Authorization: Bearer <CRON_SECRET>`. The GET route supports Vercel Cron, which attaches this secret automatically when configured. Each run processes up to three due messages within the 60-second function limit. Schedule frequency depends on your hosting plan. This is required for automatic recovery when initial email delivery fails. An authenticated admin can also process due retries from the Email tab.
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

**Job Completed** opens a final-total review for a booking that has started. The starting price is prefilled; Dwight must confirm the final USD total, including any applicable taxes, before sending. Completion saves the immutable invoice and queues its email in the same transaction. Retries reuse the saved invoice and outbox ID, so repeated clicks do not create duplicate invoices. Invoice numbers use a transaction-protected annual sequence. The invoice includes service, property, appointment, final total, number, contact link, phone and all configured payment options. An invoice is not a paid receipt; there is no payment-status reconciliation or automatic charging.

Configure accepted payment methods under **Admin → Payments** before issuing an invoice. Stripe and Venmo have dedicated setup cards with independent enable switches. Additional labels are Card / digital wallet, PayPal, Zelle, Cash, Check, Bank transfer, and Other. Stripe, card/wallet, PayPal and Venmo entries require real HTTPS payment links; checks, transfers, Zelle and Other require instructions. Add only methods the business accepts. Cards/Apple Pay/Google Pay are available only when supported by the configured external payment provider; no merchant account or processor has been connected automatically. Payment-link amounts are controlled by the external provider, not automatically set by this site. Never enter private banking credentials in these customer-visible instructions.

Invoice and rescheduling emails use the existing durable outbox and appear in Admin → Email. An initial delivery failure cannot roll back a committed appointment change or completion. The existing authenticated email cron must remain scheduled for retries. Nothing sends real email in the integration suite; it uses isolated replica sets and captured email files.


### Payments setup

Admin → Payments stores its own versioned settings document (`settings._id: payments`). Stripe and Venmo each have enabled/disabled state, a payment URL, and customer-facing instructions. Fill in a Stripe Payment Link and a Venmo business profile/payment link, enable each accepted method, and save. No secret API keys are requested or stored. Staff now manages contact details only. Options previously stored in Staff remain available until the first Payments save; generic card links are retained without being mislabeled as Stripe. Concurrent saves are rejected when the revision is stale. Only enabled providers and additional accepted methods are included in new invoice snapshots. Existing invoices never change when payment configuration changes.

This is payment-link configuration, not a merchant-account connection or an amount-specific Checkout integration. Stripe determines which cards/wallets appear at its checkout and how its link amount is configured. Venmo payments occur on Venmo. The site does not create charges, issue refunds, receive payment webhooks, or automatically mark invoices paid. Those require a separate provider/API integration.
