import { coverageGroups } from './coverage-data.mjs';
// One landing page per service city. ZIPs come from the coverage directory so pages,
// booking eligibility and the map always agree. Austin rolls up its neighborhood groups.
const zipsFor = areaNames => [...new Set(coverageGroups.flatMap(g => g.areas.filter(a => areaNames.includes(a.name)).flatMap(a => a.zips)))].sort();
const city = (slug, name, county, areaNames, details) => ({ slug, name, county, zips: zipsFor(areaNames), ...details });
export const cities = [
  city('austin', 'Austin', 'Travis County', ['Central Austin', 'North Austin', 'South Austin', 'East Austin', 'West Austin'], {
    neighborhoods: ['Hyde Park', 'Tarrytown', 'Allandale', 'Mueller', 'Circle C'],
    local: 'Austin’s live oaks shed most of their leaves in late winter and spring, right when oak pollen tassels pile up on roofs. Older central neighborhoods also see pecan and cedar elm debris through the fall.',
    nearby: ['west-lake-hills', 'round-rock', 'pflugerville', 'manchaca'],
  }),
  city('round-rock', 'Round Rock', 'Williamson County', ['Round Rock'], {
    neighborhoods: ['Forest Creek', 'Brushy Creek', 'Teravista'],
    local: 'Round Rock mixes established neighborhoods with mature shade trees and newer subdivisions where wind-blown leaves and roof grit collect in gutter corners.',
    nearby: ['pflugerville', 'georgetown', 'hutto', 'cedar-park'],
  }),
  city('pflugerville', 'Pflugerville', 'Travis County', ['Pflugerville'], {
    neighborhoods: ['Falcon Pointe', 'Blackhawk', 'Avalon'],
    local: 'Many Pflugerville homes sit in open, newer neighborhoods. Even without heavy tree cover, spring storms push leaves, seed pods, and shingle grit into gutters and downspouts.',
    nearby: ['round-rock', 'hutto', 'austin'],
  }),
  city('georgetown', 'Georgetown', 'Williamson County', ['Georgetown'], {
    neighborhoods: ['Old Town', 'Sun City', 'Berry Creek'],
    local: 'From the historic homes near the courthouse square to Sun City, Georgetown properties range from mature tree canopy to open lots, so buildup varies a lot from street to street.',
    nearby: ['round-rock', 'leander', 'hutto'],
  }),
  city('hutto', 'Hutto', 'Williamson County', ['Hutto'], {
    neighborhoods: ['Star Ranch', 'Carmel Creek'],
    local: 'Hutto’s newer subdivisions tend to have young trees, but open land means wind carries leaves, grass, and grit onto roofs. Clear gutters keep water moving away from slab foundations.',
    nearby: ['round-rock', 'pflugerville', 'georgetown'],
  }),
  city('cedar-park', 'Cedar Park', 'Williamson County', ['Cedar Park'], {
    neighborhoods: ['Buttercup Creek', 'Twin Creeks', 'Ranch at Brushy Creek'],
    local: 'Cedar Park neighborhoods often sit among Ashe juniper and live oak, which drop fine debris and leaves year-round and clog downspouts faster than you might expect.',
    nearby: ['leander', 'round-rock', 'austin'],
  }),
  city('leander', 'Leander', 'Williamson County', ['Leander'], {
    neighborhoods: ['Crystal Falls', 'Travisso', 'Mason Hills'],
    local: 'Leander is growing fast, with hillside neighborhoods near the Hill Country and newer streets to the east. Hilltop homes catch more wind-blown debris than you’d guess from the yard.',
    nearby: ['cedar-park', 'georgetown', 'round-rock'],
  }),
  city('bee-cave', 'Bee Cave', 'Travis County', ['Bee Cave'], {
    neighborhoods: ['Falconhead', 'Spanish Oaks'],
    local: 'Bee Cave homes are surrounded by Hill Country live oaks and cedar. Spring leaf drop and oak pollen are the big gutter-clogging season here.',
    nearby: ['lakeway', 'west-lake-hills', 'austin'],
  }),
  city('lakeway', 'Lakeway', 'Travis County', ['Lakeway'], {
    neighborhoods: ['Rough Hollow', 'Lakeway Highlands'],
    local: 'Lakeway’s wooded, hilly lots near Lake Travis put a lot of oak and cedar debris on roofs. We work on one- and two-story homes, so tell us about slopes and access when you book.',
    nearby: ['bee-cave', 'west-lake-hills', 'austin'],
  }),
  city('west-lake-hills', 'West Lake Hills', 'Travis County', ['West Lake Hills'], {
    neighborhoods: [],
    local: 'West Lake Hills has some of the densest tree canopy in the area. Heavy live oak cover means gutters can fill quickly, especially after spring leaf drop.',
    nearby: ['austin', 'bee-cave', 'lakeway'],
  }),
  city('buda', 'Buda', 'Hays County', ['Buda'], {
    neighborhoods: ['Garlic Creek', 'Whispering Hollow', 'Sunfield'],
    local: 'Buda’s neighborhoods range from older homes with big shade trees to newer streets near I-35. Spring storms are when clogged gutters usually show up as overflow.',
    nearby: ['kyle', 'manchaca', 'austin'],
  }),
  city('kyle', 'Kyle', 'Hays County', ['Kyle'], {
    neighborhoods: ['Plum Creek', 'Hometown Kyle', 'Waterleaf'],
    local: 'Kyle’s fast-growing neighborhoods often have young trees, but wind still carries leaves and grit onto roofs. Keeping downspouts clear matters during heavy Central Texas storms.',
    nearby: ['buda', 'manchaca'],
  }),
  city('manchaca', 'Manchaca', 'Travis County', ['Manchaca'], {
    neighborhoods: [],
    local: 'Manchaca’s larger, wooded lots south of Austin mean more trees over the roofline. Live oak leaves and twigs tend to collect at gutter corners and downspout openings.',
    nearby: ['austin', 'buda', 'kyle'],
  }),
];
export const cityBySlug = Object.fromEntries(cities.map(c => [c.slug, c]));
// A city is served when any of its ZIPs is enabled in the admin coverage map.
export const cityServed = (c, enabledZips) => c.zips.some(zip => enabledZips.includes(zip));
export const landingServices = {
  'gutter-cleaning': { slug: 'gutter-cleaning', name: 'Gutter cleaning', serviceId: 'gutter-cleaning', bookingName: 'Gutter cleaning' },
  'gutter-repair': { slug: 'gutter-repair', name: 'Gutter repair', serviceId: 'gutter-repair', bookingName: 'Gutter repair' },
};
