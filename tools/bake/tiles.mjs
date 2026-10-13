// The map file's half of D17 and G10 (PLAN §5): strips every transit feature from a city's tiles
// and opens bus-only streets as service streets, then checks no feature that reads as transit is
// left. The City tiles workflow runs it on go-pmtiles' extract before publishing. And PLAN §5's
// height row for r1: buildings OSM gives no height take Overture's (the City heights workflow).
//
//   node tools/bake/tiles.mjs strip <in.pmtiles> <out.pmtiles>
//   node tools/bake/tiles.mjs check <file.pmtiles>
//   node tools/bake/tiles.mjs heights <in.pmtiles> <overture-heights.csv.gz> <out.pmtiles>
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { featuresOf, rewriteTile } from './mvt.mjs';
import { packTile, readPmtiles, tileIdToZxy, unpackTile, writePmtiles } from './pmtiles.mjs';
import { looksLikeTransit, OPENED_STREET, tileVerdict } from './transit.mjs';

const add = (into, from) => {
  for (const [k, v] of from) into.set(k, (into.get(k) ?? 0) + v);
};

/** Strips transit from an archive's bytes; returns the new bytes and counts of what was dropped and opened. */
export function stripTransit(buf) {
  const { header, metadata, tiles } = readPmtiles(buf);
  const dropped = new Map();
  const opened = new Map();
  const out = tiles.map((t) => {
    const result = rewriteTile(unpackTile(header, t.data), (layer, props) => {
      const verdict = tileVerdict(layer, props);
      return verdict === 'street' ? OPENED_STREET : verdict;
    });
    add(dropped, result.dropped);
    add(opened, result.changed);
    return { ...t, data: packTile(header, result.tile) };
  });
  const note = 'No existing transit (D17): rail, ferry, stops, stations, platforms and rail yards removed; bus-only streets drawn as service streets.';
  return { bytes: writePmtiles(header, { ...metadata, interbus: note }, out), dropped, opened };
}

/** G10 on an archive: every feature that still reads as transit, counted by layer and kind. */
export function transitLeft(buf) {
  const { header, tiles } = readPmtiles(buf);
  const left = new Map();
  for (const t of tiles) {
    for (const { layer, props } of featuresOf(unpackTile(header, t.data))) {
      if (!looksLikeTransit(layer, props)) continue;
      const key = `${layer}:${props.kind ?? ''}${props.kind_detail ? `/${props.kind_detail}` : ''}`;
      left.set(key, (left.get(key) ?? 0) + 1);
    }
  }
  return left;
}

const POLYGON = 3;

/** Web Mercator x and y in [0, 1) of a point in degrees. */
const mercator = (lon, lat) => {
  const s = Math.sin((lat * Math.PI) / 180);
  return [(lon + 180) / 360, 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)];
};

/** Even-odd test over every ring of a polygon, holes included. */
function inside(parts, x, y) {
  let odd = false;
  for (const ring of parts) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) odd = !odd;
    }
  }
  return odd;
}

/**
 * Buildings with no height take Overture's (PLAN §5's height row; r1). `csv` is
 * tools/bake/overture.py's `lon,lat,height`: a point inside each Overture footprint. At the
 * archive's top zoom, where footprints are drawn whole, each building without a height takes the
 * tallest Overture point inside any of its pieces; then every piece of it at every zoom takes that
 * height, by the feature id the tiles carry (a building cut by a tile edge, or simplified at a lower
 * zoom, keeps one height). OSM's own heights are kept. Returns the new bytes and counts of buildings
 * (distinct ids of footprints): with a height before, given one, and still without.
 */
export function joinHeights(buf, csv) {
  const { header, metadata, tiles } = readPmtiles(buf);
  const rows = csv.trim().split('\n').slice(1);
  const px = new Float64Array(rows.length);
  const py = new Float64Array(rows.length);
  const ph = new Float64Array(rows.length);
  rows.forEach((row, k) => {
    const [lon, lat, h] = row.split(',').map(Number);
    [px[k], py[k]] = mercator(lon, lat);
    ph[k] = h;
  });
  // Points ordered by x, so a tile's are one binary search and a scan away.
  const order = Int32Array.from(px.keys()).sort((a, b) => px[a] - px[b]);
  const sortedX = Float64Array.from(order, (k) => px[k]);
  const firstAtLeast = (x) => {
    let lo = 0;
    let hi = sortedX.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (sortedX[mid] < x) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  const tagged = new Set();
  const untagged = new Set();
  const found = new Map();
  for (const t of tiles) {
    const [z, x, y] = tileIdToZxy(t.tileId);
    if (z !== header.maxZoom) continue;
    const n = 2 ** z;
    // This tile's points, in tile units (the layer's extent is read per feature).
    const near = [];
    for (let i = firstAtLeast(x / n); i < sortedX.length && sortedX[i] < (x + 1) / n; i++) {
      const k = order[i];
      if (py[k] >= y / n && py[k] < (y + 1) / n) near.push(k);
    }
    rewriteTile(unpackTile(header, t.data), (layer, props, feature) => {
      // Only footprints stand up in 3D: the layer's address points are left alone.
      if (layer !== 'buildings' || feature.id === null || feature.type !== POLYGON) return 'keep';
      if (props.height !== undefined) {
        tagged.add(feature.id);
        return 'keep';
      }
      untagged.add(feature.id);
      if (near.length === 0) return 'keep';
      const parts = feature.parts();
      const e = feature.extent;
      let best = found.get(feature.id) ?? -Infinity;
      for (const k of near) {
        const tx = (px[k] * n - x) * e;
        const ty = (py[k] * n - y) * e;
        if (ph[k] > best && inside(parts, tx, ty)) best = ph[k];
      }
      if (best > -Infinity) found.set(feature.id, best);
      return 'keep';
    });
  }
  // A building OSM gives a height on any piece keeps OSM's, so it never stands at two.
  for (const id of tagged) {
    found.delete(id);
    untagged.delete(id);
  }
  const out = tiles.map((t) => {
    const result = rewriteTile(unpackTile(header, t.data), (layer, props, feature) => {
      if (layer !== 'buildings' || props.height !== undefined || feature.id === null || feature.type !== POLYGON) return 'keep';
      const h = found.get(feature.id);
      return h === undefined ? 'keep' : { height: h };
    });
    return { ...t, data: result.changed.size ? packTile(header, result.tile) : t.data };
  });
  const note = `${metadata.interbus ?? ''} Building heights: OSM's where it has one, else Overture's (PLAN §5).`.trim();
  return {
    bytes: writePmtiles(header, { ...metadata, interbus: note }, out),
    counts: { withHeight: tagged.size, joined: found.size, without: untagged.size - found.size },
  };
}

const total = (m) => [...m.values()].reduce((s, v) => s + v, 0);
const list = (m) => [...m].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ');

function main([command, ...args]) {
  if (command === 'strip' && args.length === 2) {
    const input = readFileSync(args[0]);
    const { bytes, dropped, opened } = stripTransit(input);
    const left = transitLeft(bytes);
    if (left.size) throw new Error(`tiles: G10 ${total(left)} transit features left after the strip: ${list(left)}`);
    writeFileSync(args[1], bytes);
    console.log(`tiles: ${args[0]} (${input.length} B) → ${args[1]} (${bytes.length} B)`);
    console.log(`tiles: dropped ${total(dropped)} transit features: ${list(dropped)}`);
    console.log(`tiles: opened ${total(opened)} bus-only street features: ${list(opened)}`);
    console.log('tiles: G10 0 transit features left');
  } else if (command === 'heights' && args.length === 3) {
    const input = readFileSync(args[0]);
    const { bytes, counts } = joinHeights(input, gunzipSync(readFileSync(args[1])).toString('utf8'));
    const left = transitLeft(bytes);
    if (left.size) throw new Error(`tiles: G10 ${total(left)} transit features in the joined file: ${list(left)}`);
    writeFileSync(args[2], bytes);
    const all = counts.withHeight + counts.joined + counts.without;
    const pct = (v) => `${((v / all) * 100).toFixed(1)}%`;
    console.log(`tiles: ${args[0]} (${input.length} B) → ${args[2]} (${bytes.length} B)`);
    console.log(`tiles: ${all} buildings: ${counts.withHeight} with OSM's height (${pct(counts.withHeight)}), ${counts.joined} given Overture's (${pct(counts.joined)}), ${counts.without} still without (${pct(counts.without)})`);
    console.log('tiles: G10 0 transit features left');
  } else if (command === 'check' && args.length === 1) {
    const left = transitLeft(readFileSync(args[0]));
    if (left.size) throw new Error(`tiles: G10 ${total(left)} transit features in ${args[0]}: ${list(left)}`);
    console.log(`tiles: G10 0 transit features in ${args[0]}`);
  } else {
    throw new Error('usage: node tools/bake/tiles.mjs strip <in.pmtiles> <out.pmtiles> | check <file.pmtiles> | heights <in.pmtiles> <heights.csv.gz> <out.pmtiles>');
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    main(process.argv.slice(2));
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
