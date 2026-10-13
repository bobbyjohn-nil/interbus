// Gateways (PLAN §5): where people from beyond the play area come in. Road entries are found in the
// baked street graph, not listed by hand: each motorway, trunk or primary road that comes within
// 500 m of the extent's edge gives one, at its node nearest the edge, and entries closer than 600 m
// merge. Logan's airport gateway is the street node nearest the aerodrome's centre. Commuters who live
// outside the play area and work in it (LODES OD) enter at the road entry nearest their home tract's
// centre; demand starts reading them with visitors in week 5.
import { ringCentre } from './areas.mjs';

export const GATEWAY_CLASSES = new Set(['motorway', 'trunk', 'primary']);
export const GATEWAY_REACH_M = 500;
export const GATEWAY_MERGE_M = 600;

const toXY = (frame, [lon, lat]) => [(lon - frame.origin[0]) * frame.metresPerDegLon, (lat - frame.origin[1]) * frame.metresPerDegLat];

/** Road entries from the streets buildStreets returned: [{ name, kind: 'road', node, x, y }] in metres. */
export function roadGateways(streets, frame, box) {
  const [x0, y0] = toXY(frame, [box[0], box[1]]);
  const [x1, y1] = toXY(frame, [box[2], box[3]]);
  const best = new Map();
  for (const e of streets.edges) {
    if (!GATEWAY_CLASSES.has(e.cls)) continue;
    for (const node of [e.a, e.b]) {
      const [x, y] = streets.nodes[node].map((v) => v / 10);
      if (x < x0 || x > x1 || y < y0 || y > y1) continue;
      const sides = [x - x0, y - y0, x1 - x, y1 - y];
      const d = Math.min(...sides);
      if (d > GATEWAY_REACH_M) continue;
      const key = `${e.name}|${sides.indexOf(d)}`;
      const had = best.get(key);
      if (!had || d < had.d || (d === had.d && node < had.node)) best.set(key, { name: e.name || 'Road entry', node, x, y, d });
    }
  }
  // Nearest the edge first, so a merge keeps the entry that reaches furthest out.
  const sorted = [...best.values()].sort((a, b) => a.d - b.d || a.node - b.node);
  const kept = [];
  for (const g of sorted) {
    if (kept.some((k) => Math.hypot(k.x - g.x, k.y - g.y) < GATEWAY_MERGE_M)) continue;
    kept.push(g);
  }
  return kept.sort((a, b) => a.node - b.node).map(({ name, node, x, y }) => ({ name, kind: 'road', node, x, y }));
}

/** The airport gateway: the street node nearest the largest aerodrome's centre, or null. */
export function airportGateway(aerodromes, streets, frame) {
  if (!aerodromes.length) return null;
  const area = (ring) => Math.abs(ring.reduce((s, p, i) => { const q = ring[(i + 1) % ring.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0));
  const largest = [...aerodromes].sort((a, b) => area(b.ring) - area(a.ring) || (a.id < b.id ? -1 : 1))[0];
  const [cx, cy] = toXY(frame, ringCentre(largest.ring));
  let node = -1;
  let dist = Infinity;
  streets.nodes.forEach(([x, y], i) => {
    const d = Math.hypot(x / 10 - cx, y / 10 - cy);
    if (d < dist) {
      dist = d;
      node = i;
    }
  });
  const [x, y] = streets.nodes[node].map((v) => v / 10);
  return { name: largest.tags.name ?? 'Airport', kind: 'airport', node, x, y };
}

/**
 * Each road gateway's inbound commuters by cell: `rows` are { tract, w, jobs } (census.mjs
 * inboundByTract), `centres` maps a tract to [lon, lat], `cellOf` a workplace block to a cell index.
 * Returns, per gateway in order, [cell, commuters][] sorted by cell; the airport carries none.
 */
export function assignInbound(gateways, rows, centres, cellOf, frame) {
  const roads = gateways.map((g, i) => ({ g, i })).filter(({ g }) => g.kind === 'road');
  const sums = gateways.map(() => new Map());
  let unplaced = 0;
  for (const r of rows) {
    const centre = centres.get(r.tract);
    const cell = cellOf(r.w);
    if (!centre || cell === undefined || !roads.length) {
      unplaced += r.jobs;
      continue;
    }
    const [x, y] = toXY(frame, centre);
    let near = roads[0];
    let dist = Infinity;
    for (const road of roads) {
      const d = Math.hypot(road.g.x - x, road.g.y - y);
      if (d < dist) {
        dist = d;
        near = road;
      }
    }
    sums[near.i].set(cell, (sums[near.i].get(cell) ?? 0) + r.jobs);
  }
  return { inbound: sums.map((m) => [...m].sort((a, b) => a[0] - b[0])), unplaced };
}
