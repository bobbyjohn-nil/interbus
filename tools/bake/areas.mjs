// Areas the bake reads from the clipped OSM (PLAN §5): industrial land for depots, water for G5's
// "no residents in water", and the aerodrome that holds Logan's gateway. osm.py keeps their ways
// and multipolygon members; this joins them into outer rings.
import { isTransitTags } from './transit.mjs';

/**
 * OSM tags that make an area depot land: industrial land use (V1's rule, without its 60 m margin),
 * unless it is also tagged as transit, such as a rail yard tagged industrial (D17, G10).
 */
export const isDepotLand = (tags) => tags.landuse === 'industrial' && !isTransitTags(tags);
/**
 * Water: natural=water or a riverbank. A bare water=* without natural=water is not counted: Brookline's
 * Single Tree Hill Reservoir is a park over a covered reservoir, tagged leisure=park and water=reservoir,
 * and 181 people live in a block inside it.
 */
export const isWater = (tags) => tags.natural === 'water' || tags.waterway === 'riverbank';
export const isAerodrome = (tags) => tags.aeroway === 'aerodrome';

/**
 * Outer rings of the areas whose tags match, each as [lon, lat] points with the closing point
 * dropped, with the tags of the way or relation it came from: closed ways first, then multipolygon
 * relations' outer ways joined end to end, each in id order. A ring the clip cut open is skipped.
 */
export function areaRings(osm, match) {
  const at = (refs) => {
    const pts = refs.map((r) => osm.nodes.get(r));
    return pts.every(Boolean) ? pts.map((n) => [n.lon, n.lat]) : null;
  };
  const out = [];
  for (const way of osm.ways) {
    if (!match(way.tags) || way.refs.length < 4 || way.refs[0] !== way.refs[way.refs.length - 1]) continue;
    const pts = at(way.refs.slice(0, -1));
    if (pts) out.push({ id: `w${way.id}`, tags: way.tags, ring: pts });
  }
  const ways = new Map(osm.ways.map((w) => [w.id, w]));
  for (const rel of osm.relations) {
    if (rel.tags.type !== 'multipolygon' || !match(rel.tags)) continue;
    const parts = rel.members
      .filter((m) => m.startsWith('w') && !m.endsWith('@inner'))
      .map((m) => ways.get(Number(m.slice(1).split('@')[0])))
      .filter(Boolean)
      .map((w) => [...w.refs]);
    while (parts.length) {
      const chain = parts.shift();
      for (let joined = true; joined && chain[0] !== chain[chain.length - 1]; ) {
        joined = false;
        const end = chain[chain.length - 1];
        const k = parts.findIndex((p) => p[0] === end || p[p.length - 1] === end);
        if (k >= 0) {
          const next = parts.splice(k, 1)[0];
          chain.push(...(next[0] === end ? next : [...next].reverse()).slice(1));
          joined = true;
        }
      }
      if (chain.length < 4 || chain[0] !== chain[chain.length - 1]) continue;
      const pts = at(chain.slice(0, -1));
      if (pts) out.push({ id: `r${rel.id}`, tags: rel.tags, ring: pts });
    }
  }
  return out;
}

/** Whether [x, y] lies inside the ring (even–odd rule). */
export function inRing(ring, x, y) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** A ring's area-weighted centre, or its first point if it has no area. */
export function ringCentre(ring) {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    a += f;
    cx += (ring[j][0] + ring[i][0]) * f;
    cy += (ring[j][1] + ring[i][1]) * f;
  }
  return a === 0 ? ring[0] : [cx / (3 * a), cy / (3 * a)];
}
