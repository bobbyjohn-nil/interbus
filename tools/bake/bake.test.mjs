// Tests for the bake skeleton (PLAN §5, §14 item 5). Run: npm run test:scripts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { blocksCsv, blocksFromDbf, clipBlocks, clipLodes, controlTotals } from './census.mjs';
import { checkFixture } from './fixture.mjs';
import { inBox, parseDbf, readCity, ROOT, splitCsv } from './lib.mjs';
import { planProblems } from './plan.mjs';

const PYTHON = process.env.BAKE_PYTHON ?? 'python3';

/** A dBASE III table like TIGER/Line's, built in memory. */
function dbf(fields, rows, deleted = []) {
  const recordLength = 1 + fields.reduce((n, f) => n + f.length, 0);
  const headerLength = 32 + 32 * fields.length + 1;
  const buf = Buffer.alloc(headerLength + recordLength * rows.length + 1, 0x20);
  buf.fill(0, 0, headerLength);
  buf[0] = 0x03;
  buf.writeUInt32LE(rows.length, 4);
  buf.writeUInt16LE(headerLength, 8);
  buf.writeUInt16LE(recordLength, 10);
  fields.forEach((f, i) => {
    const at = 32 + 32 * i;
    buf.write(f.name, at, 'latin1');
    buf[at + 11] = f.type.charCodeAt(0);
    buf[at + 16] = f.length;
  });
  buf[headerLength - 1] = 0x0d;
  rows.forEach((row, r) => {
    let at = headerLength + r * recordLength;
    buf[at] = deleted.includes(r) ? 0x2a : 0x20;
    at++;
    for (const f of fields) {
      const value = String(row[f.name] ?? '');
      const text = f.type === 'N' ? value.padStart(f.length) : value.padEnd(f.length);
      buf.write(text, at, 'latin1');
      at += f.length;
    }
  });
  buf[buf.length - 1] = 0x1a;
  return buf;
}

const BLOCK_FIELDS = [
  { name: 'GEOID20', type: 'C', length: 15 },
  { name: 'ALAND20', type: 'N', length: 14 },
  { name: 'AWATER20', type: 'N', length: 14 },
  { name: 'INTPTLAT20', type: 'C', length: 11 },
  { name: 'INTPTLON20', type: 'C', length: 12 },
  { name: 'HOUSING20', type: 'N', length: 12 },
  { name: 'POP20', type: 'N', length: 12 },
];

// Two blocks in one block group (same first 12 digits) in Boston, one in Cambridge, one outside both.
const BLOCKS = [
  { GEOID20: '250250101031000', ALAND20: 9000, AWATER20: 0, INTPTLAT20: '+42.3490000', INTPTLON20: '-071.0800000', HOUSING20: 40, POP20: 70 },
  { GEOID20: '250250101031001', ALAND20: 8000, AWATER20: 10, INTPTLAT20: '+42.3500000', INTPTLON20: '-071.0900000', HOUSING20: 20, POP20: 31 },
  { GEOID20: '250173531011000', ALAND20: 7000, AWATER20: 0, INTPTLAT20: '+42.3700000', INTPTLON20: '-071.1000000', HOUSING20: 5, POP20: 9 },
  { GEOID20: '250214001001000', ALAND20: 6000, AWATER20: 0, INTPTLAT20: '+42.3300000', INTPTLON20: '-071.1300000', HOUSING20: 1, POP20: 2 },
];
const CROSSWALK = new Map([
  ['250250101031000', '2502507000'],
  ['250250101031001', '2502507000'],
  ['250173531011000', '2501711000'],
  ['250214001001000', '2502109175'],
]);
const MUNIS = [
  { name: 'Boston', ctycsub: '2502507000', pop20: 101 },
  { name: 'Cambridge', ctycsub: '2501711000', pop20: 9 },
];

test('splitCsv reads quoted fields with commas and doubled quotes', () => {
  assert.deepEqual(splitCsv('250250101031000,"Boston city, MA","say ""hi""",'), ['250250101031000', 'Boston city, MA', 'say "hi"', '']);
  assert.throws(() => splitCsv('"open'), /unterminated/);
});

test('parseDbf reads TIGER-style records and skips deleted ones', () => {
  const { fields, rows } = parseDbf(dbf(BLOCK_FIELDS, BLOCKS, [3]));
  assert.deepEqual(fields.map((f) => f.name), BLOCK_FIELDS.map((f) => f.name));
  assert.equal(rows.length, 3);
  assert.equal(rows[1].GEOID20, '250250101031001');
  assert.equal(rows[1].POP20, '31');
});

test('blocks keep their full 15-digit ids and numeric fields', () => {
  const blocks = blocksFromDbf(dbf(BLOCK_FIELDS, BLOCKS));
  assert.deepEqual(blocks[0], { geoid: '250250101031000', lon: -71.08, lat: 42.349, pop20: 70, housing20: 40, aland20: 9000, awater20: 0 });
  assert.throws(() => blocksFromDbf(dbf(BLOCK_FIELDS, [{ ...BLOCKS[0], GEOID20: '250250101031' }])), /not 15 digits/);
});

test('G4 sums each municipality exactly and fails on any shortfall or unknown block', () => {
  const blocks = blocksFromDbf(dbf(BLOCK_FIELDS, BLOCKS));
  const good = controlTotals(blocks, CROSSWALK, MUNIS);
  assert.equal(good.ok, true);
  assert.deepEqual(good.rows.map((r) => r.sum), [101, 9]);
  assert.equal(controlTotals(blocks, CROSSWALK, [{ ...MUNIS[0], pop20: 100 }]).ok, false);
  // V1's bug: ids cut to 12 digits (block groups) no longer join, and G4 says so.
  const sliced = blocks.map((b) => ({ ...b, geoid: b.geoid.slice(0, 12) }));
  const bad = controlTotals(sliced, CROSSWALK, MUNIS);
  assert.equal(bad.ok, false);
  assert.equal(bad.unknown.length, 4);
});

test('clipBlocks keeps blocks whose internal point is in the box, edges included, sorted by id', () => {
  const blocks = blocksFromDbf(dbf(BLOCK_FIELDS, [...BLOCKS].reverse()));
  const box = [-71.09, 42.34, -71.08, 42.35];
  assert.deepEqual(clipBlocks(blocks, CROSSWALK, box).map((b) => b.geoid), ['250250101031000', '250250101031001']);
  assert.equal(inBox(box, -71.0900001, 42.345), false);
  const csv = blocksCsv(clipBlocks(blocks, CROSSWALK, box));
  assert.equal(csv.split('\n')[1], '250250101031000,-71.08,42.349,70,40,9000,0,2502507000');
});

test('LODES clips keep OD rows only when home and workplace are both inside', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'bake-'));
  try {
    const od = join(dir, 'od.csv');
    writeFileSync(
      od,
      [
        'w_geocode,h_geocode,S000,SA01,createdate',
        'A,A,5,1,20250101',
        'A,B,3,1,20250101',
        'B,A,2,0,20250101',
        'C,A,7,2,20250101',
        'C,C,1,0,20250101',
      ].join('\n'),
    );
    const inside = new Set(['A', 'B']);
    assert.equal(await clipLodes(od, 'od', inside), 'w_geocode,h_geocode,S000,SA01,createdate\nA,A,5,1,20250101\nA,B,3,1,20250101\nB,A,2,0,20250101\n');
    const wac = join(dir, 'wac.csv');
    writeFileSync(wac, 'w_geocode,C000\nA,9\nC,4\n');
    assert.equal(await clipLodes(wac, 'wac', inside), 'w_geocode,C000\nA,9\n');
    const rac = join(dir, 'rac.csv');
    writeFileSync(rac, 'h_geocode,C000\nB,3\nZ,1\n');
    assert.equal(await clipLodes(rac, 'rac', inside), 'h_geocode,C000\nB,3\n');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// A street crossing the box edge, a building, a bus stop and its route, a bus lane, industrial
// land drawn by an untagged ring, and a road wholly outside.
const OPL_IN = `n1 v1 x-71.09 y42.34
n2 v1 Thighway=traffic_signals x-71.08 y42.345
n3 v1 x-71.2 y42.4
n4 v1 Thighway=bus_stop,name=Copley x-71.077 y42.35
n5 v1 x-71.3 y42.5
n6 v1 x-71.31 y42.51
n7 v1 Tamenity=bench x-71.085 y42.341
n8 v1 x-71.086 y42.342
n9 v1 x-71.087 y42.343
n10 v1 x-71.086 y42.344
w10 v1 Thighway=primary,name=Boylston%20%Street,bus:lanes=yes|designated Nn1,n2,n3
w11 v1 Tbuilding=yes Nn1,n2
w12 v1 Thighway=residential Nn5,n6
w13 v1 T Nn8,n9,n10,n8
w14 v1 Thighway=footway Nn1,n2
r20 v1 Ttype=route,route=bus,ref=39 Mw10@,n4@stop
r21 v1 Ttype=route,route=bus,ref=9 Mw12@
r22 v1 Ttype=multipolygon,landuse=industrial Mw13@outer
r23 v1 Ttype=route,route=bicycle Mw10@
`;
const OPL_OUT = `n1 T x-71.09 y42.34
n2 Thighway=traffic_signals x-71.08 y42.345
n3 T x-71.2 y42.4
n4 Thighway=bus_stop,name=Copley x-71.077 y42.35
n8 T x-71.086 y42.342
n9 T x-71.087 y42.343
n10 T x-71.086 y42.344
w10 Thighway=primary,name=Boylston%20%Street,bus:lanes=yes|designated Nn1,n2,n3
w13 T Nn8,n9,n10,n8
r20 Ttype=route,route=bus,ref=39 Mw10@,n4@stop
r22 Ttype=multipolygon,landuse=industrial Mw13@outer
`;

test('osm.py clips whole ways, transit and area members to the box, deterministically', (t) => {
  const probe = spawnSync(PYTHON, ['-I', '-c', 'import osmium'], { encoding: 'utf8' });
  if (probe.status !== 0) {
    if (process.env.CI) assert.fail(`pyosmium is not installed for ${PYTHON}: ${probe.stderr}`);
    t.skip(`pyosmium not installed for ${PYTHON}; pip install --require-hashes --no-deps -r tools/bake/requirements.txt`);
    return;
  }
  const dir = mkdtempSync(join(tmpdir(), 'bake-osm-'));
  try {
    writeFileSync(join(dir, 'in.opl'), OPL_IN);
    const run = () =>
      execFileSync(PYTHON, ['-I', join(ROOT, 'tools/bake/osm.py'), 'clip', join(dir, 'in.opl'), '-71.09,42.34,-71.07,42.36', join(dir, 'out.opl')], {
        encoding: 'utf8',
      });
    assert.deepEqual(JSON.parse(run()), { nodes: 7, ways: 2, relations: 2 });
    const first = readFileSync(join(dir, 'out.opl'), 'utf8');
    assert.equal(first, OPL_OUT);
    run();
    assert.equal(readFileSync(join(dir, 'out.opl'), 'utf8'), first);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Boston's bake settings plan cleanly and the committed fixture matches its manifest", () => {
  const city = readCity('boston');
  assert.deepEqual(planProblems(city), []);
  const problems = checkFixture('boston');
  // Before the first cut the fixture does not exist; once it does it must match exactly.
  if (city.lock) assert.deepEqual(problems, []);
  else assert.deepEqual(problems, ['mini-boston has not been cut yet']);
});
