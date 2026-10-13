// The bake's street graph (PLAN §5): the streets a bus may drive, split at junctions, chains of
// degree-2 nodes collapsed, and only the largest piece every node of which can reach every other
// (so no one-way stub traps a bus). Reads the OPL text osm.py writes. Ported in spirit from V1's
// pipeline (`Intralines@7af45b1:src/game/data/pipeline.js:240-420`, S14), with:
// - OPL escapes decoded before any tag is read ("25%20%mph" is 25 mph, not 25 km/h);
// - bus access by a written precedence: bus, then psv, then motor_vehicle, then access, then hgv
//   (PLAN §5: hgv=no closes Storrow and Memorial Drives); maxheight under 3.5 m closes a street,
//   whether tagged on the way or on a barrier node it passes, in metres or feet and inches;
// - D17: busways and bus-only streets open to all traffic, and nothing else of transit survives;
// - one-way streets kept one-way (oneway=-1 reversed; oneway:bus=no exempts buses);
// - integer output: positions in decimetres in the city frame, lengths in decimetres, times in
//   centiseconds, so the bytes are the same on every machine (G8).

/** Streets in the routable graph: osm.py's drivable classes, service roads excluded (PLAN §5). */
export const GRAPH_CLASSES = new Set([
  'motorway', 'motorway_link', 'trunk', 'trunk_link', 'primary', 'primary_link', 'secondary',
  'secondary_link', 'tertiary', 'tertiary_link', 'unclassified', 'residential', 'living_street',
  'road', 'busway', 'bus_guideway',
]);

/** Free-flow speeds where a street carries no maxspeed, km/h (a tunable; buses rarely beat them in Boston). */
export const CLASS_KMH = {
  motorway: 88, motorway_link: 56, trunk: 64, trunk_link: 48, primary: 48, primary_link: 40,
  secondary: 40, secondary_link: 35, tertiary: 35, tertiary_link: 32, unclassified: 32,
  residential: 30, road: 30, living_street: 15, busway: 40, bus_guideway: 40,
};

/** A street lower than this is closed to buses (PLAN §5). */
export const MIN_CLEARANCE_M = 3.5;

/** OPL escapes a character as %<hex code point>%; "%20%" is a space. */
export function decodeOpl(text) {
  return text.replace(/%([0-9a-fA-F]+)%/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)));
}

function parseTags(field) {
  const tags = {};
  if (!field) return tags;
  for (const pair of field.split(',')) {
    const eq = pair.indexOf('=');
    if (eq > 0) tags[decodeOpl(pair.slice(0, eq))] = decodeOpl(pair.slice(eq + 1));
  }
  return tags;
}

/** OPL text into nodes, ways and relations (the subset osm.py writes: no metadata). */
export function parseOpl(text) {
  const nodes = new Map();
  const ways = [];
  const relations = [];
  for (const line of text.split('\n')) {
    if (!line) continue;
    const fields = {};
    for (const part of line.split(' ')) fields[part[0]] = part.slice(1);
    const kind = line[0];
    const id = Number(line.slice(1, line.indexOf(' ')));
    const tags = parseTags(fields.T);
    if (kind === 'n') nodes.set(id, { id, lon: Number(fields.x), lat: Number(fields.y), tags });
    else if (kind === 'w') ways.push({ id, tags, refs: fields.N ? fields.N.split(',').map((r) => Number(r.slice(1))) : [] });
    else if (kind === 'r') relations.push({ id, tags, members: fields.M ? fields.M.split(',') : [] });
  }
  return { nodes, ways, relations };
}

/** Metres from an OSM length: "3.2", "3.2 m", "11'6\"", "12'". Null for none, default or nonsense. */
export function parseMetres(value) {
  if (value === undefined) return null;
  const v = value.trim();
  const feet = v.match(/^(\d+(?:\.\d+)?)\s*'\s*(?:(\d+(?:\.\d+)?)\s*")?$/);
  if (feet) return Number(feet[1]) * 0.3048 + Number(feet[2] ?? 0) * 0.0254;
  const metres = v.match(/^(\d+(?:\.\d+)?)\s*(m)?$/);
  return metres ? Number(metres[1]) : null;
}

/** km/h from maxspeed: "25 mph", "40", "40 km/h". Null when absent or unreadable. */
export function parseKmh(value) {
  if (value === undefined) return null;
  const m = value.trim().match(/^(\d+(?:\.\d+)?)\s*(mph|km\/h|kmh)?$/);
  if (!m) return null;
  const n = Number(m[1]) * (m[2] === 'mph' ? 1.609344 : 1);
  return Math.min(Math.max(n, 10), 120);
}

const YES = new Set(['yes', 'designated', 'permissive', 'destination']);
const NO = new Set(['no', 'private', 'delivery', 'agricultural', 'forestry', 'customers', 'discouraged']);

/**
 * May a bus drive this street? The first of bus, psv, motor_vehicle, access that says yes or no
 * decides; then hgv=no closes it (Massachusetts parkways), and a low clearance always does.
 * Returns the reason when closed, for the bake report.
 */
export function busAccess(tags) {
  const clearance = parseMetres(tags.maxheight);
  if (clearance !== null && clearance < MIN_CLEARANCE_M) return `maxheight ${tags.maxheight}`;
  for (const key of ['bus', 'psv', 'motor_vehicle', 'access']) {
    if (YES.has(tags[key])) return null;
    if (NO.has(tags[key])) return `${key}=${tags[key]}`;
  }
  if (tags.hgv === 'no') return 'hgv=no';
  return null;
}

/** 1: drive along the way's node order only; -1: against it only; 0: both ways. */
export function onewayOf(tags) {
  if (tags['oneway:bus'] === 'no' || tags['oneway:psv'] === 'no') return 0;
  const v = tags.oneway;
  if (v === 'yes' || v === '1' || v === 'true') return 1;
  if (v === '-1' || v === 'reverse') return -1;
  if (v === undefined && (tags.junction === 'roundabout' || tags.highway === 'motorway')) return 1;
  return 0;
}

/**
 * The routable graph in the city frame. `frame` is { origin: [lon, lat], metresPerDegLon,
 * metresPerDegLat } (src/sim/core/geo.ts writes the same constants). `adjust` is the city's
 * adjust.json: streets OSM leaves untagged that are closed to buses anyway.
 */
export function buildStreets(osm, frame, adjust = { closeToBuses: [] }) {
  const closedByName = new Map(adjust.closeToBuses.map((c) => [c.name, c.why]));
  const toXY = (n) => [(n.lon - frame.origin[0]) * frame.metresPerDegLon, (n.lat - frame.origin[1]) * frame.metresPerDegLat];
  const closed = [];
  const lowNodes = new Set();
  for (const n of osm.nodes.values()) {
    const h = parseMetres(n.tags.maxheight);
    if (h !== null && h < MIN_CLEARANCE_M) lowNodes.add(n.id);
  }

  // 1. The ways a bus may drive, in id order.
  const drivable = [];
  for (const way of [...osm.ways].sort((a, b) => a.id - b.id)) {
    if (!GRAPH_CLASSES.has(way.tags.highway)) continue;
    if (way.refs.length < 2 || way.refs.some((r) => !osm.nodes.has(r))) continue;
    const why =
      busAccess(way.tags) ??
      (way.refs.some((r) => lowNodes.has(r)) ? 'a low barrier on it' : null) ??
      (closedByName.has(way.tags.name) ? 'adjust.json' : null);
    if (why) {
      closed.push({ way: way.id, name: way.tags.name ?? '', why });
      continue;
    }
    drivable.push(way);
  }

  // 2. Junctions: way ends, and nodes two drivable ways (or one way twice) pass through.
  const uses = new Map();
  for (const way of drivable) for (const r of way.refs) uses.set(r, (uses.get(r) ?? 0) + 1);
  const isJunction = (way, i) => i === 0 || i === way.refs.length - 1 || uses.get(way.refs[i]) > 1;

  // 3. Segments between junctions, each with its polyline, length and time.
  let segments = [];
  for (const way of drivable) {
    const kmh = parseKmh(way.tags.maxspeed) ?? CLASS_KMH[way.tags.highway];
    const oneway = onewayOf(way.tags);
    let from = 0;
    for (let i = 1; i < way.refs.length; i++) {
      if (!isJunction(way, i)) continue;
      const refs = way.refs.slice(from, i + 1);
      const points = refs.map((r) => toXY(osm.nodes.get(r)));
      let metres = 0;
      for (let k = 1; k < points.length; k++) metres += Math.sqrt((points[k][0] - points[k - 1][0]) ** 2 + (points[k][1] - points[k - 1][1]) ** 2);
      if (refs[0] !== refs[refs.length - 1]) {
        segments.push({ a: refs[0], b: refs[refs.length - 1], points, metres, seconds: metres / (kmh / 3.6), oneway, cls: way.tags.highway, name: way.tags.name ?? way.tags.ref ?? '', way: way.id });
      }
      from = i;
    }
  }

  // 4. Collapse chains through nodes with exactly two segments, when the directions agree.
  segments = collapse(segments);

  // 5. Keep the largest strongly connected piece (by drivable length).
  const kept = largestStrongPiece(segments);
  const totalMetres = segments.reduce((s, e) => s + e.metres, 0);
  const keptMetres = kept.reduce((s, e) => s + e.metres, 0);

  // 6. Number nodes by OSM id, edges by (a, b, way), so a rebake of the same inputs is identical.
  const nodeIds = [...new Set(kept.flatMap((e) => [e.a, e.b]))].sort((a, b) => a - b);
  const index = new Map(nodeIds.map((id, i) => [id, i]));
  const dm = (m) => Math.round(m * 10);
  const nodes = nodeIds.map((id) => toXY(osm.nodes.get(id)).map(dm));
  const edges = kept
    .map((e) => ({
      a: index.get(e.a),
      b: index.get(e.b),
      dm: Math.max(1, dm(e.metres)),
      cs: Math.max(1, Math.round(e.seconds * 100)),
      oneway: e.oneway,
      cls: e.cls,
      name: e.name,
      way: e.way,
      points: e.points.map((p) => p.map(dm)),
    }))
    .sort((x, y) => x.a - y.a || x.b - y.b || x.way - y.way || x.dm - y.dm);
  return {
    nodes,
    edges,
    report: {
      nodes: nodes.length,
      edges: edges.length,
      keptKm: Math.round(keptMetres) / 1000,
      droppedKm: Math.round(totalMetres - keptMetres) / 1000,
      keptShare: totalMetres > 0 ? keptMetres / totalMetres : 0,
      closed,
    },
  };
}

/** Merges a→v→b chains where v has exactly two segments and nothing else meets there. */
function collapse(segments) {
  const live = new Set(segments);
  const at = new Map();
  const touch = (node, seg) => {
    if (!at.has(node)) at.set(node, new Set());
    at.get(node).add(seg);
  };
  for (const s of segments) {
    touch(s.a, s);
    touch(s.b, s);
  }
  // Nodes in a fixed order, so the same chains merge the same way every time.
  for (const v of [...at.keys()].sort((x, y) => x - y)) {
    const here = at.get(v);
    if (!here || here.size !== 2) continue;
    const [s1, s2] = [...here].sort((x, y) => x.way - y.way || x.a - y.a);
    if (s1 === s2 || s1.cls !== s2.cls) continue;
    // Orient both as passing through v: first ends at v, second starts at v.
    const first = s1.b === v ? s1 : reverse(s1);
    const second = s2.a === v ? s2 : reverse(s2);
    if (first.oneway !== second.oneway) continue;
    if (first.a === second.b) continue; // would close a loop
    const merged = {
      a: first.a,
      b: second.b,
      points: [...first.points, ...second.points.slice(1)],
      metres: first.metres + second.metres,
      seconds: first.seconds + second.seconds,
      oneway: first.oneway,
      cls: first.cls,
      name: first.name || second.name,
      way: Math.min(first.way, second.way),
    };
    for (const s of [s1, s2]) {
      live.delete(s);
      at.get(s.a)?.delete(s);
      at.get(s.b)?.delete(s);
    }
    at.delete(v);
    live.add(merged);
    touch(merged.a, merged);
    touch(merged.b, merged);
  }
  return [...live];
}

function reverse(s) {
  return { ...s, a: s.b, b: s.a, points: [...s.points].reverse(), oneway: -s.oneway };
}

/** The strongly connected piece with the most drivable length (Kosaraju, iterative). */
function largestStrongPiece(segments) {
  const ids = [...new Set(segments.flatMap((s) => [s.a, s.b]))].sort((a, b) => a - b);
  const index = new Map(ids.map((id, i) => [id, i]));
  const out = ids.map(() => []);
  const inn = ids.map(() => []);
  for (const s of segments) {
    const a = index.get(s.a);
    const b = index.get(s.b);
    if (s.oneway >= 0) {
      out[a].push(b);
      inn[b].push(a);
    }
    if (s.oneway <= 0) {
      out[b].push(a);
      inn[a].push(b);
    }
  }
  const order = [];
  const seen = new Uint8Array(ids.length);
  for (let s = 0; s < ids.length; s++) {
    if (seen[s]) continue;
    const stack = [[s, 0]];
    seen[s] = 1;
    while (stack.length) {
      const top = stack[stack.length - 1];
      const [u, i] = top;
      if (i < out[u].length) {
        top[1]++;
        const v = out[u][i];
        if (!seen[v]) {
          seen[v] = 1;
          stack.push([v, 0]);
        }
      } else {
        order.push(u);
        stack.pop();
      }
    }
  }
  const comp = new Int32Array(ids.length).fill(-1);
  let count = 0;
  for (let k = order.length - 1; k >= 0; k--) {
    const s = order[k];
    if (comp[s] !== -1) continue;
    const stack = [s];
    comp[s] = count;
    while (stack.length) {
      const u = stack.pop();
      for (const v of inn[u]) {
        if (comp[v] === -1) {
          comp[v] = count;
          stack.push(v);
        }
      }
    }
    count++;
  }
  const length = new Float64Array(count);
  for (const s of segments) {
    const ca = comp[index.get(s.a)];
    if (ca === comp[index.get(s.b)]) length[ca] += s.metres;
  }
  let best = 0;
  for (let c = 1; c < count; c++) if (length[c] > length[best]) best = c;
  return segments.filter((s) => comp[index.get(s.a)] === best && comp[index.get(s.b)] === best);
}
