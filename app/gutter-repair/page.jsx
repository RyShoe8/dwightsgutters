import { LandingHub } from '../../components/CityLanding';
import { pageMetadata } from '../../lib/seo.mjs';
export const revalidate = 3600;
export const metadata = pageMetadata({ title: "Gutter Repair Near Austin, TX: Service Areas | Dwight’s Gutters", description: "Gutter repair in Austin, Round Rock, Cedar Park, Pflugerville, Georgetown, Leander, Lakeway, Buda, Kyle and more. $50/hour, $50 minimum. Book online.", path: '/gutter-repair/' });
export default function Page() { return <LandingHub service="gutter-repair"/>; }
