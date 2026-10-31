import { notFound } from 'next/navigation';
import ImageHero from './ImageHero';
import Reviews from './Reviews';
import JsonLd from './JsonLd';
import { businessPhone, businessPhoneHref } from '../lib/business.mjs';
import { cities, cityBySlug, cityServed, landingServices } from '../lib/cities.mjs';
import { money, rateLabel } from '../lib/pricing.mjs';
import { reviewSummary, siteData } from '../lib/siteData.mjs';
import { absolute, breadcrumbSchema, faqSchema, landingPath, pageMetadata, siteUrl } from '../lib/seo.mjs';
const list = items => items.length < 3 ? items.join(' and ') : `${items.slice(0, -1).join(', ')}, and ${items.at(-1)}`;
// Everything that differs between the cleaning and repair pages for one city.
export function landingContent(service, city, services) {
  const cleaning = services['gutter-cleaning'], repair = services['gutter-repair'], downspout = services['downspout-concern'];
  const repairAddOn = repair?.appliesTo?.includes('gutter-cleaning');
  const zipText = `${list(city.zips)}`;
  const area = `${city.name}, TX`;
  if (service === 'gutter-cleaning') {
    const twoStory = cleaning && (cleaning.twoStoryPriceCents ?? cleaning.priceCents);
    const price = cleaning ? `Gutter cleaning in ${city.name} starts at ${money(cleaning.priceCents)} for a one-story home and ${money(twoStory)} for a two-story home.` : `You’ll see the current price for your home when you book online.`;
    return {
      title: `Gutter Cleaning in ${area} | Dwight’s Gutters`,
      description: `Book gutter cleaning in ${area} online.${cleaning ? ` From ${money(cleaning.priceCents)} for one-story homes.` : ''} Veteran-owned, upfront pricing, one- and two-story homes. Call or text ${businessPhone}.`,
      eyebrow: `${city.name.toUpperCase()}, TX · GUTTER CLEANING`, h1: `Gutter cleaning in ${city.name}, TX`,
      lead: `Clogged or overflowing gutters? Dwight clears the leaves, twigs, and roof grit so rain can drain the way it should. Book online in a couple of minutes.`,
      image: 'gutter-cleaning', alt: 'Illustrative close-up of oak leaves being cleared from a home’s gutter',
      cta: 'Book a gutter cleaning', bookHref: '/book/?service=Gutter+cleaning',
      prices: cleaning ? [
        ['One-story home', `from ${money(cleaning.priceCents)}`, 'Most single-story homes.'],
        ['Two-story home', money(twoStory), 'Same thorough cleaning, higher roofline.'],
        ...(downspout ? [['Add downspout attention', `+ ${money(downspout.priceCents)}`, 'For slow drains or suspected blockages.']] : []),
        ...(repairAddOn ? [['Add gutter repair', rateLabel(repair), 'Fix a loose or leaking section on the same visit.']] : []),
      ] : [],
      included: ['Clear leaves, twigs, and roof grit from the gutter runs', 'Make room for water to flow toward the downspouts', 'Point out any loose sections, leaks, or damage we notice', 'One- and two-story homes', 'Homes with gutter guards, too (tell us the type when you book)'],
      faqs: [
        [`How much does gutter cleaning cost in ${city.name}?`, `${price} Add-ons such as downspout attention are optional. Dwight confirms the final scope and price before work begins, and you pay after the job using the options on your invoice.`],
        [`Do you clean gutters in my part of ${city.name}?`, `We serve ${city.name} ZIP codes ${zipText}. Enter your ZIP when you book to confirm your address is in our active area.`],
        [`How often should gutters be cleaned in ${city.name}?`, `Most ${city.name} homes do well with a cleaning at least twice a year: once in late spring after live oaks drop their leaves and pollen, and again in late fall or early winter. Homes under heavy tree cover may need more.`],
        ['Do you clean two-story homes?', 'Yes. We work on one- and two-story homes. Pick your home’s height when you book and the price updates automatically. We don’t take on homes taller than two stories.'],
        ['Can you fix a loose or leaking gutter on the same visit?', repairAddOn ? `Yes. Add gutter repair when you book your cleaning. Repairs are ${rateLabel(repair)}.` : 'Mention it when you book and Dwight will take a look and talk through options.'],
        ['How do I book?', `Book online and choose an open time, or call or text ${businessPhone}. You’ll get an email confirmation right away, and you can change your time online up to 48 hours ahead.`],
      ],
    };
  }
  const rate = repair ? rateLabel(repair) : null;
  return {
    title: `Gutter Repair in ${area} | Dwight’s Gutters`,
    description: `Gutter repair in ${area}: sagging sections, loose hangers, leaking seams, and detached downspouts.${repair ? ` ${rate}.` : ''} Book online or call or text ${businessPhone}.`,
    eyebrow: `${city.name.toUpperCase()}, TX · GUTTER REPAIR`, h1: `Gutter repair in ${city.name}, TX`,
    lead: `Sagging, leaking, or pulling away from the house? Dwight fixes the small problems that send water where it shouldn’t go, billed by the hour with no surprises.`,
    image: 'austin-home', alt: 'Illustrative Central Texas limestone home with white gutters and a downspout',
    cta: 'Book a gutter repair', bookHref: '/book/?service=Gutter+repair',
    prices: repair ? [
      ['Hourly rate', `${money(repair.hourlyRateCents)}/hour`, 'Billed for the time the repair takes.'],
      ['Minimum charge', money(repair.priceCents), 'Covers a short repair visit.'],
      ...(repairAddOn && cleaning ? [['Add to a cleaning', `from ${money(cleaning.priceCents)} + repair time`, 'Clean and fix on the same visit.']] : []),
    ] : [],
    included: ['Reattach sagging gutter runs and loose hangers', 'Fix leaking seams and corners', 'Reconnect downspouts that have pulled away from the wall', 'Scope and price confirmed before work starts', 'One- and two-story homes'],
    faqs: [
      [`How much does gutter repair cost in ${city.name}?`, repair ? `Gutter repair is ${rate}. Your final total depends on the time the repair takes, and Dwight confirms the scope before starting.` : 'You’ll see the current rate when you book online. Dwight confirms the scope before starting.'],
      ['What gutter repairs do you handle?', 'Common fixes include sagging runs, loose hangers, leaking seams and corners, and downspouts that have pulled away from the wall. We don’t replace whole gutter systems or install gutter guards.'],
      ['Can I combine a repair with a gutter cleaning?', repairAddOn ? 'Yes. Book a gutter cleaning and add gutter repair. Cleaning first often makes leaks and loose sections easier to spot.' : 'Yes. Mention it when you book and Dwight will plan for both.'],
      [`Do you repair gutters in my part of ${city.name}?`, `We serve ${city.name} ZIP codes ${zipText}. Enter your ZIP when you book to confirm your address is in our active area.`],
      ['Do you work on two-story homes?', 'Yes, one- and two-story homes. We don’t take on homes taller than two stories.'],
      ['How do I book?', `Book online and describe what you’ve noticed, or call or text ${businessPhone}. A photo sent by email helps.`],
    ],
  };
}
export default function CityLanding({ service, citySlug, data }) {
  const city = cityBySlug[citySlug], content = landingContent(service, city, data.services), other = service === 'gutter-cleaning' ? 'gutter-repair' : 'gutter-cleaning';
  const rating = reviewSummary(data.reviews), path = landingPath(service, city.slug);
  const nearby = city.nearby.map(slug => cityBySlug[slug]).filter(Boolean);
  const schema = { '@graph': [
    { '@type': 'Service', '@id': `${absolute(path)}#service`, name: `${landingServices[service].name} in ${city.name}, TX`, serviceType: landingServices[service].name, provider: { '@id': `${siteUrl}/#business` }, areaServed: { '@type': 'City', name: `${city.name}, TX`, containedInPlace: { '@type': 'AdministrativeArea', name: `${city.county}, Texas` } }, url: absolute(path),
      ...(content.prices.length ? { offers: { '@type': 'Offer', priceCurrency: 'USD', price: (service === 'gutter-cleaning' ? data.services['gutter-cleaning'].priceCents : data.services['gutter-repair'].priceCents) / 100, availability: 'https://schema.org/InStock', url: absolute(content.bookHref) } } : {}) },
    breadcrumbSchema([['Home', '/'], [landingServices[service].name, `/${service}/`], [city.name, path]]),
    faqSchema(content.faqs),
  ] };
  return <main id="main" className="landing">
    <JsonLd data={schema}/>
    <ImageHero image={content.image} alt={content.alt} caption={`SERVING ${city.name.toUpperCase()} & NEARBY.`}>
      <nav className="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <a href={`/${service}/`}>{landingServices[service].name}</a> / <span>{city.name}</span></nav>
      <p className="eyebrow">{content.eyebrow}</p><h1>{content.h1}</h1><p className="lead">{content.lead}</p>
      <div className="actions"><a className="button" href={content.bookHref}>{content.cta} <span aria-hidden="true">↗</span></a><a className="text-link" href={businessPhoneHref}>Call or text {businessPhone}</a></div>
      <ul className="landing-trust"><li>Veteran-owned</li>{rating && <li>{rating.rating.toFixed(1)}★ from {rating.count} reviews</li>}<li>Online booking</li><li>Pay after the job</li></ul>
    </ImageHero>
    <section className="section container landing-facts" aria-label={`${landingServices[service].name} in ${city.name} at a glance`}>
      <dl>
        <div><dt>Service</dt><dd>{landingServices[service].name} for one- and two-story homes</dd></div>
        <div><dt>Price</dt><dd>{content.prices.length ? `${content.prices[0][1]}${content.prices[1] ? ` · ${content.prices[1][0].toLowerCase()} ${content.prices[1][1]}` : ''}` : 'Shown when you book'}</dd></div>
        <div><dt>Area</dt><dd>{city.name}, {city.county} · ZIP {city.zips.join(', ')}</dd></div>
        <div><dt>Booking</dt><dd>Online, with email confirmation · or {businessPhone}</dd></div>
      </dl>
    </section>
    {content.prices.length > 0 && <section className="section pale"><div className="container"><div className="section-heading"><div><p className="eyebrow">CLEAR, UPFRONT PRICING</p><h2>What it costs in {city.name}</h2></div><p>No payment when you book. Dwight confirms the final scope and price before any work starts, and you pay after the job.</p></div>
      <div className="service-grid landing-prices">{content.prices.map(([label, price, note]) => <div className="service-card" key={label}><h3>{label}</h3><p className="landing-price">{price}</p><p>{note}</p></div>)}</div>
      <div className="actions"><a className="button" href={content.bookHref}>{content.cta} <span aria-hidden="true">↗</span></a></div></div></section>}
    <section className="section container split landing-local">
      <div><p className="eyebrow">WHAT’S INCLUDED</p><h2>Done right, start to finish</h2><ul className="check-list">{content.included.map(item => <li key={item}>{item}</li>)}</ul></div>
      <div className="detail-aside"><h3>{landingServices[service].name} in {city.name}</h3><p>{city.local}</p>{city.neighborhoods.length > 0 && <p>We serve homes across {city.name}, including {list(city.neighborhoods)}.</p>}<p className="fine">ZIP codes served: {city.zips.join(', ')}</p></div>
    </section>
    <section className="section container"><div className="section-heading"><div><p className="eyebrow">HOW IT WORKS</p><h2>Booked in minutes</h2></div></div>
      <div className="steps"><article><span>01</span><h3>Pick a time online</h3><p>Choose your service, your home’s height, and an open time. You’ll get an email confirmation right away.</p></article><article><span>02</span><h3>Dwight does the work</h3><p>He confirms the scope and price with you before starting, then gets to work.</p></article><article><span>03</span><h3>Pay after the job</h3><p>You’ll get an emailed invoice with the payment options Dwight accepts. Nothing is charged when you book.</p></article></div>
    </section>
    <Reviews/>
    <section className="section container split"><div><p className="eyebrow">QUESTIONS FROM {city.name.toUpperCase()} HOMEOWNERS</p><h2>Good to know</h2><p>Still have a question? Call or text <a href={businessPhoneHref}>{businessPhone}</a>.</p></div>
      <div className="faqs">{content.faqs.map(([q, a]) => <details key={q}><summary>{q}<span aria-hidden="true">+</span></summary><p>{a}</p></details>)}</div>
    </section>
    <section className="section pale"><div className="container landing-links">
      <div><h2>Also in {city.name}</h2><p><a href={landingPath(other, city.slug)}>{landingServices[other].name} in {city.name} →</a></p></div>
      {nearby.length > 0 && <div><h2>Nearby areas</h2><ul>{nearby.map(n => <li key={n.slug}><a href={landingPath(service, n.slug)}>{landingServices[service].name} in {n.name}</a></li>)}</ul></div>}
      <div><h2>All service areas</h2><p><a href={`/${service}/`}>{landingServices[service].name} across the Austin area →</a></p></div>
    </div></section>
    <section className="landing-cta"><div className="container"><h2>Ready when you are, {city.name}.</h2><p>Book online in a couple of minutes, or call or text {businessPhone}.</p><div className="actions"><a className="button" href={content.bookHref}>{content.cta} <span aria-hidden="true">↗</span></a></div></div></section>
    <div className="landing-sticky" aria-label="Quick actions"><a className="button" href={content.bookHref}>Book online</a><a className="sticky-call" href={businessPhoneHref}>Call or text</a></div>
  </main>;
}
// Route exports shared by /gutter-cleaning/[city]/ and /gutter-repair/[city]/.
export function landingRoute(service) {
  return {
    generateStaticParams: () => cities.map(c => ({ city: c.slug })),
    async generateMetadata({ params }) {
      const { city } = await params;
      const content = landingContent(service, cityBySlug[city], (await siteData()).services);
      return pageMetadata({ title: content.title, description: content.description, path: landingPath(service, city) });
    },
    async Page({ params }) {
      const { city } = await params, data = await siteData();
      if (!cityServed(cityBySlug[city], data.enabledZips)) notFound();
      return <CityLanding service={service} citySlug={city} data={data}/>;
    },
  };
}
// Hub page listing every served city for one service.
export async function LandingHub({ service }) {
  const data = await siteData(), served = cities.filter(c => cityServed(c, data.enabledZips)), name = landingServices[service].name;
  const schema = { '@graph': [breadcrumbSchema([['Home', '/'], [name, `/${service}/`]]), { '@type': 'ItemList', name: `${name} service areas`, itemListElement: served.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: `${name} in ${c.name}, TX`, url: absolute(landingPath(service, c.slug)) })) }] };
  return <main id="main" className="landing">
    <JsonLd data={schema}/>
    <section className="page-intro"><div className="container"><p className="eyebrow">AUSTIN & SURROUNDING CITIES</p><h1>{name} near Austin, TX</h1><p className="lead">{service === 'gutter-cleaning' ? 'Veteran-owned gutter cleaning for one- and two-story homes across the Austin area. Pick your city for local pricing, ZIP codes, and online booking.' : 'Hourly gutter repair for sagging, leaking, and loose gutters across the Austin area. Pick your city for local details and online booking.'}</p><div className="actions"><a className="button" href={`/book/?service=${encodeURIComponent(landingServices[service].bookingName).replace(/%20/g, '+')}`}>Book online <span aria-hidden="true">↗</span></a><a className="text-link" href={businessPhoneHref}>Call or text {businessPhone}</a></div></div></section>
    <section className="section container"><ul className="city-grid">{served.map(c => <li key={c.slug}><a href={landingPath(service, c.slug)}><strong>{c.name}</strong><span>{c.county} · {c.zips.length} ZIP code{c.zips.length === 1 ? '' : 's'}</span></a></li>)}</ul>
      <p className="fine">Don’t see your city? <a href="/contact/">Contact Dwight</a> to ask about coverage.</p></section>
  </main>;
}
