export const storyOptions = ['One story', 'Two stories'];
// Starting price for a home's height. A blank two-story price falls back to the standard one.
export function priceFor(service, stories) {
  if (service.priceCents === null) return null;
  return stories === 'Two stories' && service.twoStoryPriceCents != null ? service.twoStoryPriceCents : service.priceCents;
}
