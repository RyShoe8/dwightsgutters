import { landingRoute } from '../../../components/CityLanding';
const route = landingRoute('gutter-cleaning');
// Prices and coverage refresh hourly, and immediately when Dwight saves them in admin.
export const revalidate = 3600;
export const dynamicParams = false;
export const generateStaticParams = route.generateStaticParams;
export const generateMetadata = route.generateMetadata;
export default route.Page;
