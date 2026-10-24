// Residential service planning groups, not official neighborhood/city boundaries.
// A ZIP may appear under more than one community but has one shared enabled flag.
export const coverageGroups = [
  { name: 'Austin neighborhoods', areas: [
    { name: 'Central Austin', zips: ['78701','78703','78705','78731','78751','78756'] },
    { name: 'North Austin', zips: ['78717','78726','78727','78728','78729','78750','78752','78753','78754','78757','78758','78759'] },
    { name: 'South Austin', zips: ['78704','78739','78741','78744','78745','78747','78748','78749'] },
    { name: 'East Austin', zips: ['78702','78721','78722','78723','78724','78725','78742'] },
    { name: 'West Austin', zips: ['78730','78732','78733','78735','78736','78737','78746'] },
  ] },
  { name: 'North & northeast', areas: [
    { name: 'Round Rock', zips: ['78664','78665','78681'] },
    { name: 'Pflugerville', zips: ['78660'] },
    { name: 'Georgetown', zips: ['78626','78628','78633'] },
    { name: 'Hutto', zips: ['78634'] },
  ] },
  { name: 'Northwest of Austin', areas: [
    { name: 'Cedar Park', zips: ['78613','78641'] },
    { name: 'Leander', zips: ['78641'] },
  ] },
  { name: 'West Austin & lake-area communities', areas: [
    { name: 'Bee Cave', zips: ['78738'] },
    { name: 'Lakeway', zips: ['78734','78738'] },
    { name: 'West Lake Hills', zips: ['78746'] },
  ] },
  { name: 'South of Austin', areas: [
    { name: 'Buda', zips: ['78610'] },
    { name: 'Kyle', zips: ['78640'] },
    { name: 'Manchaca', zips: ['78652'] },
  ] },
];
export const coverageZips = [...new Set(coverageGroups.flatMap(g => g.areas.flatMap(a => a.zips)))].sort();
export const zipLabels = Object.fromEntries(coverageZips.map(zip => [zip, coverageGroups.flatMap(g => g.areas.filter(a => a.zips.includes(zip)).map(a => a.name)).join(' / ')]));
export function enabledCoverage(document) {
  return coverageZips.filter(zip => document?.enabledZips?.includes(zip));
}
