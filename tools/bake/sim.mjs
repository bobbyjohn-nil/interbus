// Writes a city's sim.json, format 1 (PLAN §5 "Pack"): the street graph, the cells, the gateways
// and calib, in integers, with the frame they share. Gates G1–G3 run first and the bake refuses to
// write, naming the number, if one fails. Each extent has its own gate profile in city.json: the
// fixture box cannot hold 400 cells, and clipping it strands one-way streets at its edges.
//
// The fixture bakes from its committed inputs; the play extent (Inner Boston) from the mirrored
// sources, cut first by extent.mjs (about 5 minutes the first time, then reused).
//
//   node tools/bake/sim.mjs <city> <extent> [--out <file>]   bake
//   node tools/bake/sim.mjs <city> <extent> --lock            bake and record the golden hash
//   node tools/bake/sim.mjs <city> <extent> --check           bake and compare with the golden
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { areaRings, inRing, isAerodrome, isDepotLand, isWater, ringCentre } from './areas.mjs';
import { buildCells, readLodes } from './cells.mjs';
import { cutExtent, extentDir, playExtent } from './extent.mjs';
import { fixtureDir } from './fixture.mjs';
import { readCity, ROOT, sha256 } from './lib.mjs';
import { airportGateway, assignInbound, roadGateways } from './gateways.mjs';
import { buildStreets, GRAPH_CLASSES, parseOpl } from './streets.mjs';
import { isTransitTags } from './transit.mjs';

export const SIM_FORMAT = 1;
/** Residents count as served when a kept street passes within this distance (G3). */
export const STREET_REACH_M = 300;
/** The map file covers the extent and this much around it (src/cities.ts paddedBounds); G6 holds the sim to it. */
export const MAP_PAD_M = 1_500;
/** G7: sim.json's budget, gzipped (PLAN §5). */
export const SIM_GZIP_BUDGET = 1_048_576;
/** G5: the airport gateway must lie this close to its aerodrome. */
export const AIRPORT_REACH_M = 500;

/** The city frame: metres per degree on WGS 84 at the extent's centre, origin at its south-west corner. Same series as src/sim/core/geo.ts frameFor. */
export function cityFrame(extent) {
  const [w, s, , n] = extent;
  const phi = (((s + n) / 2) * Math.PI) / 180;
  return {
    origin: [w, s],
    metresPerDegLon: 111_412.84 * Math.cos(phi) - 93.5 * Math.cos(3 * phi) + 0.118 * Math.cos(5 * phi),
    metresPerDegLat: 111_132.954 - 559.822 * Math.cos(2 * phi) + 1.175 * Math.cos(4 * phi),
  };
}

/** Share of residents with a kept street within `reach` metres of their block (G3). */
export function residentsNearStreets(cells, streets, reach = STREET_REACH_M) {
  const cell = 200;
  const grid = new Map();
  const key = (i, j) => `${i}:${j}`;
  for (const e of streets.edges) {
    const pts = [streets.nodes[e.a], ...e.points.slice(1, -1), streets.nodes[e.b]].map(([x, y]) => [x / 10, y / 10]);
    for (let k = 1; k < pts.length; k++) {
      const seg = [pts[k - 1], pts[k]];
      const [i0, i1] = [Math.floor(Math.min(seg[0][0], seg[1][0]) / cell), Math.floor(Math.max(seg[0][0], seg[1][0]) / cell)];
      const [j0, j1] = [Math.floor(Math.min(seg[0][1], seg[1][1]) / cell), Math.floor(Math.max(seg[0][1], seg[1][1]) / cell)];
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) (grid.get(key(i, j)) ?? grid.set(key(i, j), []).get(key(i, j))).push(seg);
    }
  }
  const near = ([px, py]) => {
    const r = Math.ceil(reach / cell);
    const [ci, cj] = [Math.floor(px / cell), Math.floor(py / cell)];
    for (let i = ci - r; i <= ci + r; i++) {
      for (let j = cj - r; j <= cj + r; j++) {
        for (const [[ax, ay], [bx, by]] of grid.get(key(i, j)) ?? []) {
          const dx = bx - ax;
          const dy = by - ay;
          const len2 = dx * dx + dy * dy;
          const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
          if ((px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2 <= reach * reach) return true;
        }
      }
    }
    return false;
  };
  let total = 0;
  let served = 0;
  for (const c of cells) {
    for (const p of c.homes) {
      total += p.w;
      if (near([p.x / 10, p.y / 10])) served += p.w;
    }
  }
  return total === 0 ? 1 : served / total;
}

/** Where an extent's inputs are, and the box they were clipped to. */
function inputsOf(cityId, extentId) {
  const { config } = readCity(cityId);
  if (extentId === config.fixture.id) return { dir: fixtureDir(extentId), box: config.fixture.box };
  const play = playExtent(cityId);
  if (extentId !== play.id) throw new Error(`sim: ${extentId} is neither the fixture nor the play extent of ${cityId}`);
  return { dir: extentDir(cityId, extentId), box: play.box };
}

function readInputs(dir) {
  const text = (name) => readFileSync(join(dir, name), 'utf8');
  const [, ...rows] = text('blocks.csv').trim().split('\n');
  const blocks = rows.map((line) => {
    const v = line.split(',');
    return { geoid: v[0], lon: Number(v[1]), lat: Number(v[2]), pop20: Number(v[3]) };
  });
  const inbound = existsSync(join(dir, 'lodes-inbound.csv'))
    ? {
        rows: text('lodes-inbound.csv').trim().split('\n').slice(1).map((line) => {
          const [tract, w, jobs] = line.split(',');
          return { tract, w, jobs: Number(jobs) };
        }),
        centres: new Map(text('tracts.csv').trim().split('\n').slice(1).map((line) => {
          const [tract, lon, lat] = line.split(',');
          return [tract, [Number(lon), Number(lat)]];
        })),
      }
    : null;
  return { osm: parseOpl(text('osm.opl')), blocks, inbound, ...readLodes(text('lodes-rac.csv'), text('lodes-wac.csv')) };
}

/** The extent's gravity decay in whole metres, from its calib (tools/bake/beta.mjs measures it); a bake without one refuses. */
function gravityBetaM(config, extentId) {
  const beta = config.calib?.[extentId]?.gravityBetaM;
  if (!Number.isInteger(beta) || beta <= 0) throw new Error(`sim: cities' city.json has no calib.${extentId}.gravityBetaM; measure it with tools/bake/beta.mjs`);
  return beta;
}

/** Bakes sim.json for one extent of a city; throws, naming the gate, if one fails. */
export function bakeSim(cityId, extentId) {
  const { entry, config } = readCity(cityId);
  const profile = config.gates?.[extentId];
  if (!profile) throw new Error(`sim: no gate profile for ${extentId} in cities/${cityId}/city.json`);
  const { dir, box } = inputsOf(cityId, extentId);
  if (!existsSync(join(dir, 'osm.opl'))) throw new Error(`sim: ${extentId}'s inputs are not cut yet; run \`node tools/bake/extent.mjs ${cityId}\``);
  const inputs = readInputs(dir);
  const frame = cityFrame(entry.extent);
  const adjust = JSON.parse(readFileSync(join(ROOT, 'cities', cityId, 'adjust.json'), 'utf8'));
  const streets = buildStreets(inputs.osm, frame, adjust, box);
  const cells = buildCells({ blocks: inputs.blocks, rac: inputs.rac, wac: inputs.wac, frame, cellMetres: config.cellMetres });
  const near = residentsNearStreets(cells, streets);
  const toXY = ([lon, lat]) => [(lon - frame.origin[0]) * frame.metresPerDegLon, (lat - frame.origin[1]) * frame.metresPerDegLat];
  const inClip = ([lon, lat]) => lon >= box[0] && lon <= box[2] && lat >= box[1] && lat <= box[3];

  // Depot land: industrial areas whose centre lies in the clip, as rings in decimetres (D11, PLAN §3).
  const depotLand = areaRings(inputs.osm, isDepotLand)
    .filter((a) => inClip(ringCentre(a.ring)))
    .map((a) => a.ring.flatMap((p) => toXY(p).map((v) => Math.round(v * 10))));

  // Gateways, where the inputs carry commuters from beyond the play area (the extent, not the fixture).
  let gateways = [];
  let unplacedInbound = 0;
  if (inputs.inbound) {
    const airport = airportGateway(areaRings(inputs.osm, isAerodrome), streets, frame);
    const found = [...roadGateways(streets, frame, box), ...(airport ? [airport] : [])];
    const cellIndex = new Map(cells.map((c, i) => [`${c.i}:${c.j}`, i]));
    const blockAt = new Map(inputs.blocks.map((b) => [b.geoid, b]));
    const cellOf = (geoid) => {
      const b = blockAt.get(geoid);
      if (!b) return undefined;
      const [x, y] = toXY([b.lon, b.lat]);
      return cellIndex.get(`${Math.floor(x / config.cellMetres)}:${Math.floor(y / config.cellMetres)}`);
    };
    const assigned = assignInbound(found, inputs.inbound.rows, inputs.inbound.centres, cellOf, frame);
    unplacedInbound = assigned.unplaced;
    gateways = found.map((g, i) => ({ ...g, inbound: assigned.inbound[i] }));
  }

  // G5: residents standing in water, and an airport gateway on its aerodrome where the profile asks.
  const water = areaRings(inputs.osm, isWater).map((a) => a.ring.map(toXY));
  let wet = 0;
  for (const c of cells) {
    for (const p of c.homes) if (water.some((ring) => inRing(ring, p.x / 10, p.y / 10))) wet += p.w;
  }
  const aerodromes = areaRings(inputs.osm, isAerodrome).map((a) => a.ring.map(toXY));
  const airport = gateways.find((g) => g.kind === 'airport');
  const airportOk = !profile.airport || (airport !== undefined && aerodromes.some((ring) => inRing(ring, airport.x, airport.y) || ring.some(([x, y]) => Math.hypot(x - airport.x, y - airport.y) <= AIRPORT_REACH_M)));

  // Landmarks, where contracts are offered (the M3 spec, item 1): those the clip holds, in decimetres.
  const landmarkList = config.landmarks?.list ?? [];
  const landmarks = landmarkList.filter((l) => inClip([l.lon, l.lat])).map((l) => ({ name: l.name, xy: toXY([l.lon, l.lat]).map((v) => Math.round(v * 10)) }));

  // G6: the sim describes the place the map shows: every street node inside the map file's bounds,
  // every home and workplace and every listed landmark inside the extent.
  const [ex0, ey0] = toXY([entry.extent[0], entry.extent[1]]);
  const [ex1, ey1] = toXY([entry.extent[2], entry.extent[3]]);
  const inside = ([x, y], pad) => x >= ex0 - pad && x <= ex1 + pad && y >= ey0 - pad && y <= ey1 + pad;
  const strays =
    streets.nodes.filter(([x, y]) => !inside([x / 10, y / 10], MAP_PAD_M)).length +
    cells.reduce((n, c) => n + [...c.homes, ...c.work].filter((p) => !inside([p.x / 10, p.y / 10], 0)).length, 0) +
    landmarkList.filter((l) => !inside(toXY([l.lon, l.lat]), 0)).length;

  // G10 (D17): no transit feature reaches sim.json. The clip keeps every public-transport element so
  // this runs on real tags: only drivable streets become edges (busways as general streets, D17), and
  // transit-tagged land is never depot land. tools/bake/tiles.mjs checks the map file.
  const transitInInput = [...inputs.osm.nodes.values(), ...inputs.osm.ways, ...inputs.osm.relations].filter((e) => isTransitTags(e.tags)).length;
  const transitKept = streets.edges.filter((e) => !GRAPH_CLASSES.has(e.cls)).length + areaRings(inputs.osm, isDepotLand).filter((a) => isTransitTags(a.tags)).length;

  const gates = [
    ['G1 cells', cells.length, cells.length >= profile.cells[0] && cells.length <= profile.cells[1], `${profile.cells[0]}–${profile.cells[1]}`],
    ['G2 nodes', streets.nodes.length, streets.nodes.length <= profile.maxNodes, `≤${profile.maxNodes}`],
    ['G2 kept share', Number(streets.report.keptShare.toFixed(4)), streets.report.keptShare >= profile.keptShare, `≥${profile.keptShare}`],
    ['G3 residents near a street', Number(near.toFixed(4)), near >= profile.residentsNearStreet, `≥${profile.residentsNearStreet}`],
    ['G5 residents in water', wet, wet <= (profile.residentsInWater ?? 0), `≤${profile.residentsInWater ?? 0}`],
    ['G5 airport gateway on its aerodrome', airport ? airport.name : 'none', airportOk, profile.airport ? 'required' : 'not required'],
    ['G6 nodes, people or landmarks outside the map', strays, strays === 0, '0'],
    ['G10 transit features in sim.json', transitKept, transitKept === 0, `0 of the clip's ${transitInInput}`],
  ].map(([gate, value, ok, limit]) => ({ gate, value, ok, limit }));
  const failed = gates.filter((g) => !g.ok);
  if (failed.length) throw new Error(`sim: ${failed.map((g) => `${g.gate} ${g.value} (needs ${g.limit})`).join('; ')}`);

  const classes = [...new Set(streets.edges.map((e) => e.cls))].sort();
  const names = [...new Set(streets.edges.map((e) => e.name))].sort();
  const sim = {
    format: SIM_FORMAT,
    city: cityId,
    extent: extentId,
    frame,
    cellMetres: config.cellMetres,
    classes,
    names,
    nodes: streets.nodes.flat(),
    edges: streets.edges.map((e) => [e.a, e.b, e.dm, e.cs, e.oneway, classes.indexOf(e.cls), names.indexOf(e.name), e.points.slice(1, -1).flat()]),
    cells: cells.map((c) => ({
      i: c.i,
      j: c.j,
      residents: c.residents,
      workers: c.workers,
      jobs: c.jobs,
      sectors: c.sectors,
      homes: c.homes.flatMap((p) => [p.x, p.y, p.w]),
      work: c.work.flatMap((p) => [p.x, p.y, p.w]),
    })),
    // Commutes with one end outside the play area enter at gateways (Logan, the main road entries);
    // demand reads them with visitors in week 5. The fixture keeps only commutes inside its box.
    gateways: gateways.map((g) => ({ name: g.name, kind: g.kind, node: g.node, inbound: g.inbound.flat() })),
    depotLand,
    landmarks: landmarks.map((l) => ({ name: l.name, x: l.xy[0], y: l.xy[1] })),
    calib: { tripScalePermille: config.calib?.[extentId]?.tripScalePermille ?? 1000, gravityBetaM: gravityBetaM(config, extentId) },
  };
  const text = `${JSON.stringify(sim)}\n`;
  const gzipped = gzipSync(text, { level: 9 }).length;
  if (gzipped > SIM_GZIP_BUDGET) throw new Error(`sim: G7 sim.json is ${gzipped} B gzipped (needs ≤${SIM_GZIP_BUDGET})`);
  gates.push({ gate: 'G7 sim.json gzipped', value: gzipped, ok: true, limit: `≤${SIM_GZIP_BUDGET}` });
  return {
    text,
    sha256: sha256(text),
    report: {
      bytes: Buffer.byteLength(text),
      nodes: streets.nodes.length,
      edges: streets.edges.length,
      keptKm: streets.report.keptKm,
      droppedKm: streets.report.droppedKm,
      cells: cells.length,
      residents: cells.reduce((s, c) => s + c.residents, 0),
      workers: cells.reduce((s, c) => s + c.workers, 0),
      jobs: cells.reduce((s, c) => s + c.jobs, 0),
      gates,
      depotLand: { areas: depotLand.length, km2: Number((depotLand.reduce((sum, r) => sum + Math.abs(r.reduce((a, _, k) => (k % 2 ? a : a + r[k] * r[(k + 3) % r.length] - r[(k + 2) % r.length] * r[k + 1]), 0)) / 2, 0) / 1e8).toFixed(2)) },
      gateways: gateways.map((g) => ({ name: g.name, kind: g.kind, commuters: g.inbound.reduce((sum, [, n]) => sum + n, 0) })),
      landmarks: landmarks.map((l) => l.name),
      unplacedInbound,
      closed: streets.report.closed,
    },
  };
}

/** Where an extent's golden hash lives: the fixture's beside its inputs, the play extent's under cities/<city>/. */
export function simLockPath(cityId, extentId) {
  const { config } = readCity(cityId);
  if (extentId === config.fixture.id) return join(fixtureDir(config.fixture.id), 'sim.lock.json');
  inputsOf(cityId, extentId);
  return join(ROOT, 'cities', cityId, `sim-${extentId}.lock.json`);
}

async function main() {
  const [cityId, extentId, ...flags] = process.argv.slice(2);
  if (!cityId || !extentId) {
    console.error('usage: node tools/bake/sim.mjs <city> <extent> [--out <file>] [--lock] [--check]');
    process.exit(2);
  }
  if (extentId !== readCity(cityId).config.fixture.id) await cutExtent(cityId);
  const baked = bakeSim(cityId, extentId);
  for (const g of baked.report.gates) console.log(`sim: ${g.gate} ${g.value} (${g.limit}) ok`);
  console.log(`sim: ${baked.report.nodes} nodes, ${baked.report.edges} edges, ${baked.report.cells} cells, ${baked.report.closed.length} ways closed to buses; ${baked.report.bytes} B, sha256 ${baked.sha256}`);
  const lockPath = simLockPath(cityId, extentId);
  if (flags.includes('--check')) {
    const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
    if (lock.sha256 !== baked.sha256 || lock.bytes !== baked.report.bytes) {
      console.error(`sim: the bake gives ${baked.sha256} (${baked.report.bytes} B) but the golden is ${lock.sha256} (${lock.bytes} B)`);
      process.exit(1);
    }
    console.log('sim: matches the golden hash');
  }
  if (flags.includes('--lock')) {
    const { closed, ...summary } = baked.report;
    const lock = {
      about: 'The golden hash of this extent\'s sim.json (I17): `node tools/bake/sim.mjs <city> <extent> --check` re-bakes it and fails on any byte of difference. Written with --lock.',
      format: SIM_FORMAT,
      sha256: baked.sha256,
      ...summary,
      closedToBuses: closed.map((c) => `${c.way} ${c.name || '(unnamed)'}: ${c.why}`),
    };
    writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
    console.log(`sim: wrote ${lockPath}`);
  }
  const out = flags.includes('--out') ? resolve(flags[flags.indexOf('--out') + 1]) : join(ROOT, '.cache/bake', cityId, `sim-${extentId}.json`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, baked.text);
  console.log(`sim: wrote ${out}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error.message ?? error);
    process.exit(1);
  });
}
