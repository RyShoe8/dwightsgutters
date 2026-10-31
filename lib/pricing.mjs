export const storyOptions = ['One story', 'Two stories'];
// Services that other services (gutter repair, downspout concern) can be added to.
export const cleaningServiceIds = ['gutter-cleaning', 'seasonal-upkeep'];
export const money = cents => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
// Starting price for a home's height. A blank two-story price falls back to the standard one.
// Hourly services use priceCents as their minimum charge.
export function priceFor(service, stories) {
  if (service.priceCents === null) return null;
  return stories === 'Two stories' && service.twoStoryPriceCents != null ? service.twoStoryPriceCents : service.priceCents;
}
export const isHourly = service => service.hourlyRateCents != null;
export const rateLabel = service => `${money(service.hourlyRateCents)}/hour, ${money(service.priceCents)} minimum`;
export const priceLabel = (service, stories) => isHourly(service) ? rateLabel(service) : `from ${money(priceFor(service, stories))}`;
// Final charge for hourly work: the rate times hours, never below the minimum.
export const hourlyCharge = (part, hours) => Math.max(part.priceCents, Math.round(part.hourlyRateCents * hours));
// Hourly pieces of a booked service snapshot (the base service or an add-on).
export function hourlyParts(service) {
  const addOns = service.addOns || [];
  const base = { name: service.name.split(' + ')[0], priceCents: service.priceCents - addOns.reduce((t, a) => t + a.priceCents, 0), hourlyRateCents: service.hourlyRateCents };
  return [base, ...addOns].filter(isHourly);
}
export const hoursLabel = hours => `${hours} hour${hours === 1 ? '' : 's'}`;
