# Backend setup

The Next.js app now requires a Node.js server (Node 22+ recommended), not static hosting. MongoDB Atlas and Resend are the production integrations. No third-party CRM is needed.

## Local development without paid accounts

Run `npm ci`, then `npm run dev:local`. The first run downloads a MongoDB binary. This starts a single-node replica set in `.local/mongo`, seeds the admin, and runs Next at http://127.0.0.1:3000. Stop any existing server on port 3000 first. Local data persists between runs; `.local/` is ignored by git. This helper is for development only, not deployment.

Visit `/admin/sign-in/` and enter `dwight@dwightsgutters.com`. Open the newest `.local/mail/*.html` sign-in email and follow its link. No emails leave the computer in this mode. There is no default password or development authentication bypass.

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
- Prices are starting prices in USD. Each booking stores a price/name/duration snapshot. Payment processing, invoices, recurring appointments, multiple crews, and customer self-service rescheduling are not included. To reschedule, admin cancels the old booking and creates a new booking through the public form.
- Customer records are matched by normalized email. Public bookings never overwrite private CRM notes or an existing contact's identity. Booking history preserves the submitted address/contact details even after a CRM edit.
- Authentication uses 15-minute single-use email links, hashed tokens, and eight-hour server-side sessions. Cookie is HttpOnly, SameSite Strict, Secure in production. Admin APIs enforce authorization. Mutations require same-origin requests. No public admin registration.
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
