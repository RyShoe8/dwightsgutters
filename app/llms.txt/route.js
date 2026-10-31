import { siteData } from '../../lib/siteData.mjs';
import { llmsText } from '../../lib/seo.mjs';
export const revalidate = 3600;
export async function GET() {
  return new Response(llmsText(await siteData()), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
