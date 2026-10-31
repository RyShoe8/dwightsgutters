import { pageMetadata } from '../../../lib/seo.mjs';
import ChangeAppointment from '../../../components/ChangeAppointment';
export const metadata = pageMetadata({ title: "Change Appointment | Dwight's Gutters", description: 'Change your Dwight’s Gutters appointment time.', path: '/book/change/', robots: { index: false, follow: false } });
export default function Page() { return <ChangeAppointment/>; }
