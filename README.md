# Dwight's Gutters

Next.js 16 App Router website mockup for Austin and surrounding cities. React 19, native JSX pages, shared header/footer, responsive CSS and client-side demo interactions.

Run `npm install`, then `npm run dev` for http://127.0.0.1:3000. `npm run build` produces the static export in `out/`.

Routes: `/`, `/about/`, `/services/`, `/service-area/`, `/book/`, `/contact/`, `/terms/`.

The five primary pages appear in header and footer. Footer also includes Terms of Service, Contact Us and copyright.

## Brand source

`branding/source/approved-logo.png` is the unchanged user-supplied master. Public logo assets are deterministic crops/color variants of it. Never recreate the gutter geometry. Branding SVG layouts embed raster artwork; they are not true vector logos. The hero photo is illustrative generated imagery, not a completed-job photo.

## Preview behavior

Booking is a three-step browser-only demo: no submission, persistence, payment or scheduling. Email: dwight@dwightsgutters.com. Phone and Google/Yelp links remain labeled placeholders. Terms are draft placeholders.

Service Area includes Austin neighborhoods, nearby-city groups, filtering, FAQs and booking links. Exact coverage and policies require business confirmation. No fabricated ratings, address or credentials.

The mockup remains noindex. Before launch, finalize contact/profile details, service scope, policies and booking integration; then enable indexing, canonicals and sitemap. Search rankings are not guaranteed.

`migrate.py` records the initial migration from local mockups; it is not a build dependency. Edit JSX pages directly going forward.
