import { LandingHub } from '../../components/CityLanding';
import { pageMetadata } from '../../lib/seo.mjs';
export const revalidate = 3600;
export const metadata = pageMetadata({ title: "Gutter Cleaning Near Austin, TX: Service Areas | Dwight’s Gutters", description: "Gutter cleaning in Austin, Round Rock, Cedar Park, Pflugerville, Georgetown, Leander, Lakeway, Buda, Kyle and more. Veteran-owned. Book online.", path: '/gutter-cleaning/' });
export default function Page() { return <LandingHub service="gutter-cleaning"/>; }
