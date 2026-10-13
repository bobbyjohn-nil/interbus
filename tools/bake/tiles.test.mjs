// Tests for the map file's transit strip and G10 (D17, PLAN §5). Run: npm run test:scripts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { PMTiles, tileIdToZxy, zxyToTileId } from 'pmtiles';
import { decodeValue, featuresOf, fields, rewriteTile } from './mvt.mjs';
import { readPmtiles, writePmtiles } from './pmtiles.mjs';
import { stripTransit, transitLeft } from './tiles.mjs';
import { ROOT } from './lib.mjs';
import { looksLikeTransit, tileVerdict } from './transit.mjs';

// A tiny vector-tile encoder, so the tests build tiles by hand rather than trusting the code under test.
const varint = (v) => {
  const out = [];
  while (v >= 0x80) {
    out.push((v % 128) | 0x80);
    v = Math.floor(v / 128);
  }
  out.push(v);
  return Buffer.from(out);
};
const field = (n, bytes) => Buffer.concat([varint(n * 8 + 2), varint(bytes.length), bytes]);
const str = (n, s) => field(n, Buffer.from(s, 'utf8'));
const packed = (n, values) => field(n, Buffer.concat(values.map(varint)));

/** A layer of point features, each { props, at: [x, y] } with string properties. */
function layer(name, features) {
  const keys = [];
  const values = [];
  const index = (list, v) => (list.includes(v) ? list.indexOf(v) : list.push(v) - 1);
  const encoded = features.map(({ props, at }, i) => {
    const tags = Object.entries(props).flatMap(([k, v]) => [index(keys, k), index(values, v)]);
    const zz = (n) => (n << 1) ^ (n >> 31);
    return field(2, Buffer.concat([Buffer.from([0x08]), varint(i + 1), packed(2, tags), Buffer.from([0x18, 1]), packed(4, [9, zz(at[0]), zz(at[1])])]));
  });
  const body = Buffer.concat([
    Buffer.from([0x78, 2]), // version 2
    str(1, name),
    ...encoded,
    ...keys.map((k) => str(3, k)),
    ...values.map((v) => field(4, str(1, v))),
    Buffer.from([0x28]), varint(4096), // extent
  ]);
  return field(3, body);
}

const streetTile = () =>
  Buffer.concat([
    layer('roads', [
      { props: { kind: 'minor_road', kind_detail: 'residential', name: 'Marlborough Street' }, at: [10, 20] },
      { props: { kind: 'rail', kind_detail: 'subway' }, at: [30, 40] },
      { props: { kind: 'other', kind_detail: 'busway', name: 'Silver Line' }, at: [50, 60] },
      { props: { kind: 'ferry' }, at: [70, 80] },
    ]),
    layer('pois', [{ props: { kind: 'bus_stop', name: 'Copley' }, at: [5, 5] }]),
    layer('landuse', [
      { props: { kind: 'railway' }, at: [1, 1] },
      { props: { kind: 'park' }, at: [2, 2] },
    ]),
  ]);

test('the strip drops transit, opens a busway as a service street, and keeps everything else byte for byte', () => {
  const before = streetTile();
  const { tile, dropped, changed } = rewriteTile(before, (l, p) => {
    const v = tileVerdict(l, p);
    return v === 'street' ? { kind: 'minor_road', kind_detail: 'service' } : v;
  });
  const after = featuresOf(tile);
  assert.deepEqual(
    after.map((f) => [f.layer, f.props.kind, f.props.kind_detail ?? null, f.props.name ?? null]),
    [
      ['roads', 'minor_road', 'residential', 'Marlborough Street'],
      ['roads', 'minor_road', 'service', 'Silver Line'],
      ['landuse', 'park', null, null],
    ],
  );
  assert.deepEqual([...dropped].sort(), [['landuse:railway', 1], ['pois:bus_stop', 1], ['roads:ferry', 1], ['roads:rail/subway', 1]]);
  assert.deepEqual([...changed], [['roads:other/busway', 1]]);
  // The pois layer had only a stop, so it is gone; kept features keep their exact bytes and geometry.
  const layersOf = (t) => fields(t).map((f) => Buffer.from(fields(f.body).find((p) => p.field === 1).body).toString());
  assert.deepEqual(layersOf(tile), ['roads', 'landuse']);
  const featureBytes = (t, layerName) => fields(fields(t).find((f) => Buffer.from(fields(f.body).find((p) => p.field === 1).body).toString() === layerName).body).filter((p) => p.field === 2);
  const geometry = (f) => Buffer.from(fields(f.body).find((p) => p.field === 4).raw).toString('hex');
  const [resBefore, , buswayBefore] = featureBytes(before, 'roads');
  const [resAfter, buswayAfter] = featureBytes(tile, 'roads');
  assert.equal(Buffer.compare(resBefore.raw, resAfter.raw), 0);
  assert.equal(geometry(buswayAfter), geometry(buswayBefore));
});

test('a Value reads as its type: string, double, sint, uint and bool', () => {
  const double = Buffer.alloc(9);
  double[0] = 0x19;
  double.writeDoubleLE(42.5, 1);
  assert.equal(decodeValue(str(1, 'Back Bay')), 'Back Bay');
  assert.equal(decodeValue(double), 42.5);
  assert.equal(decodeValue(Buffer.concat([Buffer.from([0x30]), varint(5)])), -3);
  assert.equal(decodeValue(Buffer.concat([Buffer.from([0x28]), varint(675647)])), 675647);
  assert.equal(decodeValue(Buffer.from([0x38, 1])), true);
});

/** An archive of tiles at Back Bay: z14 and z15 street tiles and a run of two identical ocean tiles. */
function archive(tiles) {
  const header = {
    tileCompression: 2, tileType: 1, minZoom: 14, maxZoom: 15, centerZoom: 14,
    minLonE7: -711782300, minLatE7: 423015300, maxLonE7: -709617700, maxLatE7: 424184700, centerLonE7: -710850000, centerLatE7: 423500000,
  };
  return writePmtiles(header, { vector_layers: [] }, tiles.map(({ z, x, y, data, run = 1 }) => ({ tileId: zxyToTileId(z, x, y), runLength: run, data: gzipSync(data) })));
}
const sample = () =>
  archive([
    { z: 14, x: 4956, y: 6060, data: streetTile() },
    { z: 15, x: 9912, y: 12120, data: streetTile() },
    { z: 15, x: 9913, y: 12120, data: layer('water', [{ props: { kind: 'ocean' }, at: [0, 0] }]), run: 2 },
  ]);

test('an archive written here reads back through the pmtiles library the game uses', async () => {
  const bytes = sample();
  const lib = new PMTiles({ getKey: () => 'sample', getBytes: async (offset, length) => ({ data: bytes.buffer.slice(bytes.byteOffset + offset, bytes.byteOffset + offset + length) }) });
  const header = await lib.getHeader();
  assert.deepEqual([header.minZoom, header.maxZoom, header.numAddressedTiles, header.numTileEntries, header.numTileContents], [14, 15, 4, 3, 2]);
  // The library hands back tiles uncompressed.
  const street = await lib.getZxy(15, 9912, 12120);
  const stored = readPmtiles(bytes).tiles.find((t) => t.tileId === zxyToTileId(15, 9912, 12120));
  assert.equal(Buffer.compare(Buffer.from(street.data), gunzipSync(stored.data)), 0);
  assert.equal(featuresOf(Buffer.from(street.data)).length, 7);
  // The run's second tile is the next tile id along the Hilbert curve, stored once.
  const first = zxyToTileId(15, 9913, 12120);
  const [z, x, y] = tileIdToZxy(first + 1);
  const [a, b] = [await lib.getZxy(15, 9913, 12120), await lib.getZxy(z, x, y)];
  assert.ok(a && b);
  assert.equal(Buffer.compare(Buffer.from(a.data), Buffer.from(b.data)), 0);
});

test('G10 fails the raw extract, and passes once transit is stripped (D17)', () => {
  const raw = sample();
  const left = transitLeft(raw);
  assert.deepEqual(
    [...left].sort(),
    [['landuse:railway', 2], ['pois:bus_stop', 2], ['roads:ferry', 2], ['roads:other/busway', 2], ['roads:rail/subway', 2]],
  );
  const { bytes, dropped, opened } = stripTransit(raw);
  assert.equal(transitLeft(bytes).size, 0);
  assert.equal([...dropped.values()].reduce((s, v) => s + v, 0), 8);
  assert.deepEqual([...opened], [['roads:other/busway', 2]]);
  assert.match(readPmtiles(bytes).metadata.interbus, /D17/);
});

test('G10 reads kinds as words, so a transit kind the strip does not list still fails', () => {
  assert.equal(tileVerdict('pois', { kind: 'tram_halt' }), 'keep');
  assert.ok(looksLikeTransit('pois', { kind: 'tram_halt' }));
  assert.ok(looksLikeTransit('roads', { kind: 'other', kind_detail: 'busway' }));
  assert.ok(looksLikeTransit('pois', { kind: 'airport;ferry_terminal;shipyard;cargo' }));
  for (const kind of ['fire_station', 'charging_station', 'trailhead', 'terminal', 'aerodrome', 'bicycle_rental']) assert.ok(!looksLikeTransit('pois', { kind }), kind);
  assert.ok(!looksLikeTransit('pois', { kind: 'fitness_centre', kind_detail: 'trampoline' }));
  assert.ok(!looksLikeTransit('roads', { kind: 'minor_road', kind_detail: 'service' }));
});

test('every map file cities/index.json ships holds no transit (G10, D17)', (t) => {
  const index = JSON.parse(readFileSync(join(ROOT, 'cities', 'index.json'), 'utf8'));
  for (const city of index.cities) {
    const path = join(ROOT, 'public', 'cities', city.tiles.file);
    // CI fetches the city files first (npm run cities); a checkout without them skips, saying so.
    if (!existsSync(path)) {
      t.skip(`${city.tiles.file} is not downloaded; run npm run cities`);
      continue;
    }
    assert.deepEqual([...transitLeft(readFileSync(path))], [], city.tiles.file);
  }
});
