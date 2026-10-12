// `npm run bake:plan [city]`: what a bake of this city would read, write and check, without running
// it or touching the network (PLAN §5, §14 item 5). Fails on settings that cannot bake.
import { existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { checkFixture, fixtureDir } from './fixture.mjs';
import { boxInside, readCity, sourcesDir } from './lib.mjs';

const GATES = [
  'G1 400–1,000 cells',
  'G2 ≤16,000 street nodes, one component with ≥98% of drivable km',
  'G3 ≥99% of residents within 300 m of a street',
  'G4 Σ POP20 per municipality equals its census count exactly',
  'G5 geography sanity (no residents in water; Logan holds the airport gateway)',
  'G6 map and demand agree',
  'G7 sizes (sim.json ≤1 MB gzip, map ≤40 MB)',
  'G8 two runners give the same bytes',
  'G9 load ≤300 ms',
  'G10 no transit feature survives (D17)',
];

/** Settings problems that would stop a bake, or an empty list. */
export function planProblems({ entry, config }) {
  const problems = [];
  const extent = entry.extent;
  if (!(extent[0] < extent[2] && extent[1] < extent[3])) problems.push(`extent ${JSON.stringify(extent)} is not west,south,east,north`);
  if (!boxInside(config.fixture.box, extent)) problems.push(`the fixture box ${JSON.stringify(config.fixture.box)} is not inside the extent`);
  const ids = config.sources.map((s) => s.id);
  for (const needed of ['osm', 'blocks', 'lodes-od-main', 'lodes-od-aux', 'lodes-rac', 'lodes-wac', 'lodes-xwalk']) {
    if (!ids.includes(needed)) problems.push(`city.json names no "${needed}" source`);
  }
  if (new Set(ids).size !== ids.length) problems.push('city.json names a source twice');
  for (const m of config.municipalities.list) {
    if (!/^\d{10}$/.test(m.ctycsub)) problems.push(`${m.name}: ctycsub must be 10 digits`);
    if (!Number.isInteger(m.pop20) || m.pop20 <= 0) problems.push(`${m.name}: pop20 must be a census count`);
  }
  return problems;
}

function main() {
  const cityId = process.argv[2] ?? 'boston';
  const city = readCity(cityId);
  const { entry, config, lock } = city;
  const [w, s, e, n] = entry.extent;
  const kmEW = ((e - w) * 111.32 * Math.cos((((s + n) / 2) * Math.PI) / 180)).toFixed(1);
  const kmNS = ((n - s) * 111.32).toFixed(1);
  console.log(`Bake plan for ${entry.name} (${cityId})`);
  console.log(`  extent   ${entry.extent.join(', ')}  (${kmEW} × ${kmNS} km; cells of ${config.cellMetres} m)`);
  console.log(`  play     ${config.municipalities.list.map((m) => `${m.name} ${m.pop20.toLocaleString('en-US')}`).join(' · ')}`);
  console.log(`  fixture  ${config.fixture.id}: ${config.fixture.box.join(', ')}`);
  console.log('Sources (fetched once by the "Bake sources" workflow, then read only from its mirror):');
  for (const source of config.sources) {
    const locked = lock?.sources.find((x) => x.id === source.id);
    const local = locked && join(sourcesDir(cityId), locked.asset);
    const here = local && existsSync(local) && statSync(local).size === locked.bytes ? 'here' : 'not downloaded';
    console.log(`  ${source.id.padEnd(14)} ${locked ? `${locked.asset}, ${locked.bytes.toLocaleString('en-US')} B, ${here}` : 'not locked yet'}`);
  }
  if (lock) console.log(`  mirror   ${lock.mirror.base}`);
  console.log('Steps: fetch → sources (mirror, hash-checked) → census + osm → cells, graph, gateways → pack → gates');
  console.log(`Fixture: ${fixtureDir(config.fixture.id).replace(`${process.cwd()}/`, '')}`);
  for (const p of checkFixture(cityId)) console.log(`  ! ${p}`);
  console.log('Gates (the bake refuses to write on any failure):');
  for (const g of GATES) console.log(`  ${g}`);
  const problems = planProblems(city);
  for (const p of problems) console.error(`plan: ${p}`);
  if (problems.length) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
