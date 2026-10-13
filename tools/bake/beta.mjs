// The gravity decay fitted to LODES (the M3 spec, r1; PLAN §5): the β, in metres, for which the
// game's commuter matrix (src/sim/demand/commuters.ts: each cell's workers spread over the other
// cells' jobs by exp(-d/β), within the cutoff) gives the same mean commute between cells as LODES's
// own origin-destination pairs with both ends inside the area. V1 used 4 km for every city.
//
// `node tools/bake/beta.mjs <city> <extent>` measures it on an extent's inputs: the fixture's
// committed OD clip, or the play extent's blocks with the mirrored OD file.
import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { createGunzip } from 'node:zlib';
import { buildCells, readLodes } from './cells.mjs';
import { ROOT, sourcesDir } from './lib.mjs';

/** Jobs beyond this pull no commuters (src/sim/config/demand.ts GRAVITY_CUTOFF_KM). */
export const CUTOFF_KM = 45;

/** A cell's weighted centre of homes or of work, in metres, or null. Points are in decimetres. */
function centre(points) {
  const w = points.reduce((s, p) => s + p.w, 0);
  return w > 0 ? [points.reduce((s, p) => s + p.x * p.w, 0) / w / 10, points.reduce((s, p) => s + p.y * p.w, 0) / w / 10] : null;
}

/** Straight-line km from each cell's homes to every cell's work, as the game measures it. */
export function cellKm(cells) {
  const homes = cells.map((c) => centre(c.homes));
  const work = cells.map((c) => centre(c.work));
  const n = cells.length;
  const km = new Float64Array(n * n).fill(Number.NaN);
  for (let i = 0; i < n; i++) {
    if (!homes[i]) continue;
    for (let j = 0; j < n; j++) if (work[j]) km[i * n + j] = Math.hypot(homes[i][0] - work[j][0], homes[i][1] - work[j][1]) / 1000;
  }
  return km;
}

/** The game's mean commute in km at decay `betaM`: each cell's workers over the other cells' jobs within the cutoff. */
export function modelMeanKm(cells, km, betaM) {
  const n = cells.length;
  let trips = 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const workers = cells[i].workers;
    if (workers <= 0) continue;
    let weight = 0;
    let weighted = 0;
    for (let j = 0; j < n; j++) {
      const d = km[i * n + j];
      if (i === j || !(d <= CUTOFF_KM)) continue;
      const w = cells[j].jobs * Math.exp((-d * 1000) / betaM);
      weight += w;
      weighted += w * d;
    }
    if (weight <= 0) continue;
    trips += workers;
    sum += workers * (weighted / weight);
  }
  return sum / trips;
}

/** LODES's mean commute in km over pairs [homeCell, workCell, commuters] between different cells within the cutoff. */
export function observedMeanKm(cells, km, pairs) {
  const n = cells.length;
  let trips = 0;
  let sum = 0;
  for (const [i, j, count] of pairs) {
    const d = km[i * n + j];
    if (i === j || !(d <= CUTOFF_KM)) continue;
    trips += count;
    sum += count * d;
  }
  return sum / trips;
}

/** The β in whole tens of metres whose modelled mean commute meets the observed one (bisection; the mean grows with β). */
export function fitBeta(cells, pairs) {
  const km = cellKm(cells);
  const target = observedMeanKm(cells, km, pairs);
  let lo = 100;
  let hi = 100_000;
  while (hi - lo > 10) {
    const mid = (lo + hi) / 2;
    if (modelMeanKm(cells, km, mid) < target) lo = mid;
    else hi = mid;
  }
  return { betaM: Math.round((lo + hi) / 20) * 10, observedKm: target, km };
}

/** OD rows (w_geocode, h_geocode, S000) to cell pairs, both blocks in `cellOfBlock`. */
export async function cellPairs(lineSource, cellOfBlock) {
  const sums = new Map();
  let cols = null;
  for await (const line of lineSource) {
    if (!line) continue;
    const f = line.split(',');
    if (!cols) {
      cols = [f.indexOf('w_geocode'), f.indexOf('h_geocode'), f.indexOf('S000')];
      continue;
    }
    const w = cellOfBlock.get(f[cols[0]]);
    const h = cellOfBlock.get(f[cols[1]]);
    if (w === undefined || h === undefined) continue;
    const key = `${h}:${w}`;
    sums.set(key, (sums.get(key) ?? 0) + Number(f[cols[2]]));
  }
  return [...sums].map(([key, n]) => [...key.split(':').map(Number), n]);
}

async function* fileLines(path) {
  const input = path.endsWith('.gz') ? createReadStream(path).pipe(createGunzip()) : createReadStream(path);
  yield* createInterface({ input, crlfDelay: Infinity });
}

/** Measures an extent: its cells from its cut inputs, its OD pairs, and the fit. */
export async function measure(cityId, extentId) {
  const city = JSON.parse(readFileSync(join(ROOT, 'cities', cityId, 'city.json'), 'utf8'));
  const entry = JSON.parse(readFileSync(join(ROOT, 'cities', 'index.json'), 'utf8')).cities.find((c) => c.id === cityId);
  const { cityFrame } = await import('./sim.mjs');
  const fixture = extentId === city.fixture.id;
  const dir = fixture ? join(ROOT, 'tools/bake/fixtures', extentId) : join(ROOT, '.cache/bake', cityId, extentId);
  const text = (name) => readFileSync(join(dir, name), 'utf8');
  const blocks = text('blocks.csv').trim().split('\n').slice(1).map((line) => {
    const v = line.split(',');
    return { geoid: v[0], lon: Number(v[1]), lat: Number(v[2]), pop20: Number(v[3]) };
  });
  const frame = cityFrame(entry.extent);
  const cells = buildCells({ blocks, ...readLodes(text('lodes-rac.csv'), text('lodes-wac.csv')), frame, cellMetres: city.cellMetres });
  const index = new Map(cells.map((c, k) => [`${c.i}:${c.j}`, k]));
  const cellOfBlock = new Map();
  for (const b of blocks) {
    const x = (b.lon - frame.origin[0]) * frame.metresPerDegLon;
    const y = (b.lat - frame.origin[1]) * frame.metresPerDegLat;
    const k = index.get(`${Math.floor(x / city.cellMetres)}:${Math.floor(y / city.cellMetres)}`);
    if (k !== undefined) cellOfBlock.set(b.geoid, k);
  }
  const odFiles = fixture
    ? ['lodes-od-main.csv', 'lodes-od-aux.csv'].map((f) => join(dir, f))
    : ['ma_od_main_JT00_2023.csv.gz', 'ma_od_aux_JT00_2023.csv.gz'].map((f) => join(sourcesDir(cityId), f));
  const pairs = [];
  for (const path of odFiles) if (existsSync(path)) pairs.push(...(await cellPairs(fileLines(path), cellOfBlock)));
  const { betaM, observedKm, km } = fitBeta(cells, pairs);
  return { cells: cells.length, commuters: pairs.reduce((s, p) => s + (p[0] === p[1] ? 0 : p[2]), 0), observedKm, betaM, v1MeanKm: modelMeanKm(cells, km, 4_000), fitMeanKm: modelMeanKm(cells, km, betaM) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cityId = 'boston', extentId = 'mini-boston'] = process.argv.slice(2);
  const m = await measure(cityId, extentId);
  console.log(`${cityId} ${extentId}: ${m.cells} cells, ${m.commuters} LODES commuters between different cells inside`);
  console.log(`LODES mean commute ${m.observedKm.toFixed(3)} km; at V1's β 4,000 m the game's is ${m.v1MeanKm.toFixed(3)} km`);
  console.log(`fitted β ${m.betaM} m, where the game's mean is ${m.fitMeanKm.toFixed(3)} km`);
}
