// How far a bus drives between two clicks, against the straight line, on Inner Boston: seeded click
// pairs 250–600 m apart in Back Bay and downtown, plus a few named legs, under four routings (stops
// on every node or off motorways; one-way streets kept or not). The owner's first playtest found
// "large loops" there (docs/playtests/2026-10-14-owner-first-look.md); this measures them.
// `npm run bench routes`.
import { createRouter, type Router } from '../src/sim/city/route';
import type { City } from '../src/sim/city/simfile';
import { BUSES_KEEP_ONE_WAY } from '../src/sim/config/lines';
import { SpatialGrid, distXY, toXY, type LngLat, type XY } from '../src/sim/core/geo';
import { createRng, seedFor } from '../src/sim/core/rng';
import { stopNode } from '../src/sim/world';
import { innerBostonCity } from './inner';

export const BOXES: [name: string, box: [number, number, number, number]][] = [
  ['Back Bay', [-71.09, 42.345, -71.069, 42.356]],
  ['Downtown', [-71.066, 42.349, -71.051, 42.363]],
];
export const NAMED: [name: string, from: LngLat, to: LngLat][] = [
  ['Copley to Boylston at Mass Ave', [-71.0775, 42.35], [-71.087, 42.3478]],
  ['Prudential to Back Bay station', [-71.082, 42.347], [-71.076, 42.3473]],
  ['Downtown Crossing to Government Center', [-71.0603, 42.3555], [-71.0592, 42.3597]],
  ['South Station to Park Street', [-71.0552, 42.3523], [-71.0624, 42.3564]],
];

interface Routing {
  readonly name: string;
  readonly nodes: SpatialGrid<number>;
  readonly router: Router;
}

function routing(city: City, name: string, offMotorways: boolean, oneway: boolean): Routing {
  const nodes = new SpatialGrid<number>(200);
  for (let n = 0; n < city.graph.nodeCount; n++) if (!offMotorways || stopNode(city, n)) nodes.add([city.graph.x[n]!, city.graph.y[n]!], n);
  return { name, nodes, router: createRouter(city.graph, { oneway }) };
}

/** Metres driven from one click to the other, and the straight line between the nodes they snap to. */
function leg(city: City, r: Routing, a: XY, b: XY): { m: number; straight: number; offStop: boolean } | null {
  const na = r.nodes.nearest(a, 400)?.item;
  const nb = r.nodes.nearest(b, 400)?.item;
  if (na === undefined || nb === undefined || na === nb) return null;
  const path = r.router.route(na, nb);
  if (!path) return null;
  const g = city.graph;
  const straight = distXY([g.x[na]!, g.y[na]!], [g.x[nb]!, g.y[nb]!]);
  return { m: path.dm / 10, straight, offStop: !stopNode(city, na) || !stopNode(city, nb) };
}

/** Seeded click pairs 250–600 m apart inside a box. */
export function clickPairs(city: City, box: [number, number, number, number], count: number, seed: string): [XY, XY][] {
  const rng = createRng(seedFor(seed, 'routes'));
  const pairs: [XY, XY][] = [];
  while (pairs.length < count) {
    const a = toXY(city.frame, [rng.range(box[0], box[2]), rng.range(box[1], box[3])]);
    const b = toXY(city.frame, [rng.range(box[0], box[2]), rng.range(box[1], box[3])]);
    const d = distXY(a, b);
    if (d >= 250 && d <= 600) pairs.push([a, b]);
  }
  return pairs;
}

const quantile = (xs: number[], q: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(q * xs.length))]!;

function main(): void {
  const city = innerBostonCity();
  if (!city) {
    console.log('bench routes: Inner Boston skipped; fetch it with `npm run cities`');
    return;
  }
  const routings = [
    routing(city, 'before: every node, one-way kept', false, true),
    routing(city, 'stops off motorways, one-way kept', true, true),
    routing(city, `shipped: stops off motorways, one-way ${BUSES_KEEP_ONE_WAY ? 'kept' : 'not kept'}`, true, BUSES_KEEP_ONE_WAY),
  ];
  for (const [box, bounds] of BOXES) {
    const pairs = clickPairs(city, bounds, 500, box);
    console.log(`\n${box}: 500 seeded click pairs 250–600 m apart, driven ÷ straight`);
    for (const r of routings) {
      const ratios: number[] = [];
      let offStop = 0;
      for (const [a, b] of pairs) {
        const l = leg(city, r, a, b);
        if (!l) continue;
        ratios.push(l.m / l.straight);
        if (l.offStop) offStop++;
      }
      const over2 = ratios.filter((x) => x > 2).length / ratios.length;
      console.log(`  ${r.name}: median ${quantile(ratios, 0.5).toFixed(2)}×, p99 ${quantile(ratios, 0.99).toFixed(1)}×, worst ${Math.max(...ratios).toFixed(1)}×, ${(over2 * 100).toFixed(1)}% over 2×, ${offStop} on a motorway node`);
    }
  }
  console.log('\nNamed legs, there / back, metres (straight line)');
  for (const [name, from, to] of NAMED) {
    const a = toXY(city.frame, from);
    const b = toXY(city.frame, to);
    for (const r of routings) {
      const there = leg(city, r, a, b);
      const back = leg(city, r, b, a);
      console.log(`  ${name}, ${r.name}: ${there ? Math.round(there.m) : '-'} / ${back ? Math.round(back.m) : '-'} (${there ? Math.round(there.straight) : '-'})`);
    }
  }
}

main();
