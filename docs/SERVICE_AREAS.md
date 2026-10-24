# ZIP service coverage

Admin > Services > Service areas by ZIP controls the public map and booking eligibility across all services. Save changes to publish them. Shared postal codes have one setting, even when listed under multiple communities. Existing bookings are unchanged. Concurrent edits are detected; reload saved coverage before retrying a stale edit.

The first deployment seeds 55 unique ZIPs enabled. Later seeds preserve saved switches. Service pricing and schedule availability are independent and are not enabled by this seed. The public map refreshes coverage on load, browser focus, and every 60 seconds while visible. Booking creation always checks current database coverage inside the scheduling transaction.

The complete grouped directory is public/data/service-area-zips.csv. These are core residential postal planning groups for the requested communities, not exhaustive municipal intersections. City labels do not define ZIP limits. PO-box-only and unique institutional codes are omitted.

## Map sources

Boundaries: U.S. Census Bureau 2020 ZIP Code Tabulation Areas (ZCTAs), downloaded October 24, 2026 from https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/PUMA_TAD_TAZ_UGA_ZCTA/MapServer/1 . ZCTAs approximate ZIP delivery areas; they are not exact USPS boundaries or city limits. See https://www.census.gov/programs-surveys/geography/guidance/geo-areas/zctas.html .

Regenerate the simplified local GeoJSON and CSV with `node scripts/fetch-zip-boundaries.mjs`. The script verifies that all configured ZIPs have geometry. To expand the supported set, update lib/coverage-data.mjs, regenerate boundaries, and intentionally migrate saved coverage; a deploy never silently resets an admin's selection.

Street map: OpenStreetMap tiles with visible attribution, browser caching, and an explicit origin referrer on tile images. No tile prefetch or offline download. See https://operations.osmfoundation.org/policies/tiles/ . The tile service is best effort; the searchable directory remains available if tiles cannot load.

Planning references: Austin ZIP map https://services.austintexas.gov/edims/document.cfm?id=209855 ; Cedar Park shared Leander postal codes https://www.cedarparktexas.gov/506/Helpful-Tools-FAQs . Neighborhood groupings are for navigation and may overlap ordinary local usage.
