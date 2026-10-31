import { coverageGroups } from './coverage-data.mjs';
// One landing page per service city. ZIPs come from the coverage directory so pages,
// booking eligibility and the map always agree. Austin rolls up its neighborhood groups.
const zipsFor = areaNames => [...new Set(coverageGroups.flatMap(g => g.areas.filter(a => areaNames.includes(a.name)).flatMap(a => a.zips)))].sort();
const city = (slug, name, county, areaNames, details) => ({ slug, name, county, areaNames, zips: zipsFor(areaNames), debris: null, ...details });
// Facts shared by every city page, each with the source it came from (researched October 2026).
export const regionFacts = [
  { title: 'About 36 inches of rain a year', text: 'The Austin area averages 36.25 inches of rain a year (1991–2020 normal at Camp Mabry), spread across every season. When it comes in a downpour, clogged gutters spill it right next to the house.', source: { label: 'National Weather Service', url: 'https://www.weather.gov/media/ewx/climate/ClimateSummary-ewx-Austin.pdf' } },
  { title: 'Oak season fills gutters fast', text: 'Oak pollen and the stringy tassels (catkins) that follow usually fall from late February through May, peaking around April. A cleaning in late spring clears the biggest load of the year.', source: { label: 'KVUE', url: 'https://kvue.com/article/weather/austin-oak-pollen-spike/269-4e67c818-a6da-4225-8e32-a1fd913d8546' } },
];
const clay = { title: 'Clay soil and your foundation', text: 'Expansive clay of the Blackland Prairie swells when wet and shrinks as it dries. Gutters that overflow or downspouts that empty against the slab put water where it can shift a foundation, so keep downspouts clear and draining a few feet away from the house.', source: { label: 'Texas Water Development Board', url: 'https://www.twdb.texas.gov/conservation/education/doc/tx_State_soil.pdf' } };
const hill = { title: 'Hill Country slopes and runoff', text: 'Thin soil over limestone and sloped lots mean rain runs off fast. Overflowing gutters send that water across beds, walkways, and driveways, so downspouts that carry water where you want it matter here.', source: null };
const mixed = { title: 'Two kinds of ground', text: 'East of I-35 you’ll find expansive Blackland Prairie clay that swells and shrinks with moisture; to the west, thinner soil over limestone where water runs off fast. Either way, clear gutters and downspouts that drain away from the house protect the foundation and landscaping.', source: { label: 'Texas Water Development Board', url: 'https://www.twdb.texas.gov/conservation/education/doc/tx_State_soil.pdf' } };
export const cities = [
  city('austin', 'Austin', 'Travis County', ['Central Austin', 'North Austin', 'South Austin', 'East Austin', 'West Austin'], {
    neighborhoods: ['Hyde Park', 'Tarrytown', 'Allandale', 'Mueller', 'Circle C'],
    local: 'Austin’s live oaks shed most of their leaves in late winter and spring, right when oak pollen tassels pile up on roofs. Older central neighborhoods also see pecan and cedar elm debris through the fall.',
    ground: mixed,
    debris: { text: 'Austin Resource Recovery collects yard trimmings at the curb each week. Set leaves out in paper lawn bags or a reusable container, and keep branches under 5 feet long.', source: { label: 'Austin Resource Recovery', url: 'https://www.austintexas.gov/trash' } },
    nearby: ['west-lake-hills', 'round-rock', 'pflugerville', 'manchaca'],
  }),
  city('round-rock', 'Round Rock', 'Williamson County', ['Round Rock'], {
    neighborhoods: ['Forest Creek', 'Brushy Creek', 'Teravista'],
    local: 'Round Rock mixes established neighborhoods with mature shade trees and newer subdivisions where wind-blown leaves and roof grit collect in gutter corners.',
    ground: mixed,
    debris: { text: 'Round Rock residents can drop off brush for free (up to 2 cubic yards) at the city’s Brush Recycling Center on Deepwood Drive with a current city water bill and driver’s license, and pick up free mulch there too.', source: { label: 'City of Round Rock', url: 'https://www.roundrocktexas.gov/departments/parks-and-recreation/forestry/recycling-pick/' } },
    nearby: ['pflugerville', 'georgetown', 'hutto', 'cedar-park'],
  }),
  city('pflugerville', 'Pflugerville', 'Travis County', ['Pflugerville'], {
    neighborhoods: ['Falcon Pointe', 'Blackhawk', 'Avalon'],
    local: 'Many Pflugerville homes sit in open, newer neighborhoods. Even without heavy tree cover, spring storms push leaves, seed pods, and shingle grit into gutters and downspouts.',
    ground: clay,
    nearby: ['round-rock', 'hutto', 'austin'],
  }),
  city('georgetown', 'Georgetown', 'Williamson County', ['Georgetown'], {
    neighborhoods: ['Old Town', 'Sun City', 'Berry Creek'],
    local: 'From the historic homes near the courthouse square to Sun City, Georgetown properties range from mature tree canopy to open lots, so buildup varies a lot from street to street.',
    ground: mixed,
    debris: { text: 'Inside city limits, yard trimmings are picked up at the curb once a month, on your first recycling day of the month. Extra trimmings can go to the transfer station on W.L. Walden Road.', source: { label: 'City of Georgetown', url: 'https://recycle.georgetown.org/?p=2434' } },
    nearby: ['round-rock', 'leander', 'hutto'],
  }),
  city('hutto', 'Hutto', 'Williamson County', ['Hutto'], {
    neighborhoods: ['Star Ranch', 'Carmel Creek'],
    local: 'Hutto’s newer subdivisions tend to have young trees, but open land means wind carries leaves, grass, and grit onto roofs. Clear gutters keep water moving away from slab foundations.',
    ground: clay,
    nearby: ['round-rock', 'pflugerville', 'georgetown'],
  }),
  city('cedar-park', 'Cedar Park', 'Williamson County', ['Cedar Park'], {
    neighborhoods: ['Buttercup Creek', 'Twin Creeks', 'Ranch at Brushy Creek'],
    local: 'Cedar Park neighborhoods often sit among Ashe juniper and live oak, which drop fine debris and leaves year-round and clog downspouts faster than you might expect.',
    ground: hill,
    nearby: ['leander', 'round-rock', 'austin'],
  }),
  city('leander', 'Leander', 'Williamson County', ['Leander'], {
    neighborhoods: ['Crystal Falls', 'Travisso', 'Mason Hills'],
    local: 'Leander is growing fast, with hillside neighborhoods near the Hill Country and newer streets to the east. Hilltop homes catch more wind-blown debris than you’d guess from the yard.',
    ground: mixed,
    debris: { text: 'The city holds spring and fall cleanup events at the Public Works facility (607 Municipal Drive), where Leander residents can drop off non-hazardous waste.', source: { label: 'City of Leander', url: 'https://www.leandertx.gov/517/Garbage-Recycling' } },
    nearby: ['cedar-park', 'georgetown', 'round-rock'],
  }),
  city('bee-cave', 'Bee Cave', 'Travis County', ['Bee Cave'], {
    neighborhoods: ['Falconhead', 'Spanish Oaks'],
    local: 'Bee Cave homes are surrounded by Hill Country live oaks and cedar. Spring leaf drop and oak pollen are the big gutter-clogging season here.',
    ground: hill,
    nearby: ['lakeway', 'west-lake-hills', 'austin'],
  }),
  city('lakeway', 'Lakeway', 'Travis County', ['Lakeway'], {
    neighborhoods: ['Rough Hollow', 'Lakeway Highlands'],
    local: 'Lakeway’s wooded, hilly lots near Lake Travis put a lot of oak and cedar debris on roofs. We work on one- and two-story homes, so tell us about slopes and access when you book.',
    ground: hill,
    debris: { text: 'Yard waste is picked up on your regular service day each week, with no call-ahead: up to eight closed bags or tied bundles (no larger than 3 by 3 feet, 35 pounds max) in total.', source: { label: 'City of Lakeway', url: 'https://www.lakeway-tx.gov/208/Yard-Waste-Service' } },
    nearby: ['bee-cave', 'west-lake-hills', 'austin'],
  }),
  city('west-lake-hills', 'West Lake Hills', 'Travis County', ['West Lake Hills'], {
    neighborhoods: [],
    local: 'West Lake Hills has some of the densest tree canopy in the area. Heavy live oak cover means gutters can fill quickly, especially after spring leaf drop.',
    ground: hill,
    nearby: ['austin', 'bee-cave', 'lakeway'],
  }),
  city('buda', 'Buda', 'Hays County', ['Buda'], {
    neighborhoods: ['Garlic Creek', 'Whispering Hollow', 'Sunfield'],
    local: 'Buda’s neighborhoods range from older homes with big shade trees to newer streets near I-35. Spring storms are when clogged gutters usually show up as overflow.',
    ground: clay,
    nearby: ['kyle', 'manchaca', 'austin'],
  }),
  city('kyle', 'Kyle', 'Hays County', ['Kyle'], {
    neighborhoods: ['Plum Creek', 'Hometown Kyle', 'Waterleaf'],
    local: 'Kyle’s fast-growing neighborhoods often have young trees, but wind still carries leaves and grit onto roofs. Keeping downspouts clear matters during heavy Central Texas storms.',
    ground: clay,
    debris: { text: 'Bagged yard debris goes out in approved brown paper bags beside your green cart. Kyle utility customers also get bulky pickups each year and a free monthly landfill drop-off.', source: { label: 'City of Kyle', url: 'https://cityofkyle.com/Waste' } },
    nearby: ['buda', 'manchaca'],
  }),
  city('manchaca', 'Manchaca', 'Travis County', ['Manchaca'], {
    neighborhoods: [],
    local: 'Manchaca’s larger, wooded lots south of Austin mean more trees over the roofline. Live oak leaves and twigs tend to collect at gutter corners and downspout openings.',
    ground: clay,
    nearby: ['austin', 'buda', 'kyle'],
  }),
];
export const cityBySlug = Object.fromEntries(cities.map(c => [c.slug, c]));
export const citySlugForArea = areaName => cities.find(c => c.areaNames.includes(areaName))?.slug;
// A city is served when any of its ZIPs is enabled in the admin coverage map.
export const cityServed = (c, enabledZips) => c.zips.some(zip => enabledZips.includes(zip));
export const landingServices = {
  'gutter-cleaning': { slug: 'gutter-cleaning', name: 'Gutter cleaning', serviceId: 'gutter-cleaning', bookingName: 'Gutter cleaning' },
  'gutter-repair': { slug: 'gutter-repair', name: 'Gutter repair', serviceId: 'gutter-repair', bookingName: 'Gutter repair' },
};
