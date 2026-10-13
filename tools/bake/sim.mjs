// Writes a city's sim.json, format 1 (PLAN §5 "Pack"): the street graph, the cells, the gateways
// and calib, in integers, with the frame they share. Gates G1–G3 run first and the bake refuses to
// write, naming the number, if one fails. Each extent has its own gate profile in city.json: the
// fixture box cannot hold 400 cells, and clipping it strands one-way streets at its edges.
//
//   node tools/bake/sim.mjs <city> <extent> [--out <file>]   bake (only the fixture until week 3)
//   node tools/bake/sim.mjs <city> <extent> --lock            bake and record the golden hash
//   node tools/bake/sim.mjs <city> <extent> --check           bake and compare with the golden (PR CI)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildCells, readLodes } from './cells.mjs';
import { fixtureDir } from './fixture.mjs';
import { readCity, ROOT, sha256 } from './lib.mjs';
import { buildStreets, parseOpl } from './streets.mjs';

export const SIM_FORMAT = 1;
/** Residents count as served when a kept street passes within this distance (G3). */
export const STREET_REACH_M = 300;

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

function readFixtureInputs(cityId) {
  const { config } = readCity(cityId);
  const dir = fixtureDir(config.fixture.id);
  const text = (name) => readFileSync(join(dir, name), 'utf8');
  const [, ...rows] = text('blocks.csv').trim().split('\n');
  const blocks = rows.map((line) => {
    const v = line.split(',');
    return { geoid: v[0], lon: Number(v[1]), lat: Number(v[2]), pop20: Number(v[3]) };
  });
  return { osm: parseOpl(text('osm.opl')), blocks, ...readLodes(text('lodes-rac.csv'), text('lodes-wac.csv')) };
}

/** Bakes sim.json for one extent of a city; throws, naming the gate, if one fails. */
export function bakeSim(cityId, extentId) {
  const { entry, config } = readCity(cityId);
  const profile = config.gates?.[extentId];
  if (!profile) throw new Error(`sim: no gate profile for ${extentId} in cities/${cityId}/city.json`);
  if (extentId !== config.fixture.id) throw new Error(`sim: only the fixture bakes in week 2; ${extentId} waits for the week-3 bake job`);
  const inputs = readFixtureInputs(cityId);
  const frame = cityFrame(entry.extent);
  const adjust = JSON.parse(readFileSync(join(ROOT, 'cities', cityId, 'adjust.json'), 'utf8'));
  const streets = buildStreets(inputs.osm, frame, adjust);
  const cells = buildCells({ blocks: inputs.blocks, rac: inputs.rac, wac: inputs.wac, frame, cellMetres: config.cellMetres });
  const near = residentsNearStreets(cells, streets);

  const gates = [
    ['G1 cells', cells.length, cells.length >= profile.cells[0] && cells.length <= profile.cells[1], `${profile.cells[0]}–${profile.cells[1]}`],
    ['G2 nodes', streets.nodes.length, streets.nodes.length <= profile.maxNodes, `≤${profile.maxNodes}`],
    ['G2 kept share', Number(streets.report.keptShare.toFixed(4)), streets.report.keptShare >= profile.keptShare, `≥${profile.keptShare}`],
    ['G3 residents near a street', Number(near.toFixed(4)), near >= profile.residentsNearStreet, `≥${profile.residentsNearStreet}`],
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
    // The fixture keeps only commutes with both ends inside the box, so it has no gateways.
    gateways: [],
    calib: { tripScalePermille: 1000 },
  };
  const text = `${JSON.stringify(sim)}\n`;
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
      closed: streets.report.closed,
    },
  };
}

/** Where an extent's golden hash lives: the fixture's beside its inputs (Inner Boston's arrives with the week-3 bake job). */
export function simLockPath(cityId, extentId) {
  const { config } = readCity(cityId);
  if (extentId !== config.fixture.id) throw new Error(`sim: no golden for ${extentId} yet`);
  return join(fixtureDir(config.fixture.id), 'sim.lock.json');
}

function main() {
  const [cityId, extentId, ...flags] = process.argv.slice(2);
  if (!cityId || !extentId) {
    console.error('usage: node tools/bake/sim.mjs <city> <extent> [--out <file>] [--lock] [--check]');
    process.exit(2);
  }
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
      about: 'The golden hash of this fixture\'s sim.json (I17): `node tools/bake/sim.mjs <city> <extent> --check` re-bakes it and fails on any byte of difference. Written with --lock.',
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
  try {
    main();
  } catch (error) {
    console.error(error.message ?? error);
    process.exit(1);
  }
}
