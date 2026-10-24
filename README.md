# Dwight's Gutters

Next.js 16 App Router website and admin system for Austin and surrounding cities. React 19, native JSX pages, shared header/footer, responsive CSS, MongoDB CRM, scheduling, and booking confirmations.

Run `npm install`, then `npm run dev:local` for http://127.0.0.1:3000 with a persistent local MongoDB and captured email inbox. `npm run build` creates a Next.js server build; static export is no longer supported. See [backend setup](docs/BACKEND.md) for Atlas, Resend, admin sign-in, and deployment.

Routes: `/`, `/about/`, `/services/`, `/service-area/`, `/book/`, `/contact/`, `/terms/`, `/admin/`, `/admin/sign-in/`.

The five primary pages appear in header and footer. Footer also includes Terms of Service, Contact Us and copyright.

## Brand source

`branding/source/approved-logo.png` is the unchanged user-supplied master. Public logo assets are deterministic crops/color variants of it. Never recreate the gutter geometry. Branding SVG layouts embed raster artwork; they are not true vector logos. The hero photo is illustrative generated imagery, not a completed-job photo.

## Booking and launch status

Booking connects to MongoDB for admin pricing, availability, customer records, and a transactional email outbox. The initial admin is dwight@dwightsgutters.com, with passwordless email sign-in. Services start unpriced and disabled; scheduling stays closed until configured. No online payment is collected. Phone and Google/Yelp links remain labeled placeholders. Terms are draft placeholders.

Service Area includes Austin neighborhoods, nearby-city groups, filtering, FAQs and booking links. Exact coverage and policies require business confirmation. No fabricated ratings, address or credentials.

The site remains noindex. Before launch, finalize contact/profile details, service scope, policies, and production database/email credentials; then enable indexing, canonicals and sitemap. Search rankings are not guaranteed.

`migrate.py` records the initial migration from local mockups; it is not a build dependency. Edit JSX pages directly going forward.
