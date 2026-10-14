// Stops, depots and route ends snap through one grid of street nodes (GD-05), which leaves out
// motorways and ramps: the owner's first playtest found buses looping kilometres out of their way
// in Back Bay and downtown when a click by the Mass Pike or the I-93 tunnel put a stop on the
// highway (docs/playtests/2026-10-14-owner-first-look.md).
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildGraph } from './city/graph';
import { createRouter } from './city/route';
import { loadCity, type City, type Street } from './city/simfile';
import { BUSES_KEEP_ONE_WAY } from './config/lines';
import { distXY, frameFor, SpatialGrid, toXY, type LngLat, type XY } from './core/geo';
import { createRng, seedFor } from './core/rng';
import { checkStopSite } from './rules/stop';
import { newGame } from './state';
import { createWorld, depotSiteContext, lineDraftContext, nearestNode, stopNode } from './world';

/** A residential street along y = 0 and a one-way motorway along y = 30 above it, joined by ramps at both ends. */
function besideAMotorway(): City {
  const nodes: [number, number][] = [[0, 0], [200, 0], [400, 0], [0, 30], [200, 30], [400, 30]];
  const roads: [a: number, b: number, cls: string, oneway: -1 | 0 | 1][] = [
    [0, 1, 'residential', 0],
    [1, 2, 'residential', 0],
    [3, 4, 'motorway', 1],
    [4, 5, 'motorway', 1],
    [0, 3, 'motorway_link', 0],
    [2, 5, 'motorway_link', 0],
  ];
  const graph = buildGraph(nodes, roads.map(([a, b, , oneway]) => ({ a, b, dm: Math.round(distXY(nodes[a]!, nodes[b]!) * 10), cs: 100, oneway })));
  const streets: Street[] = roads.map(([a, b, cls, oneway]) => ({ cls, name: cls, oneway, points: [nodes[a]!, nodes[b]!] }));
  return {
    id: 'test',
    extent: 'test',
    frame: frameFor([-71.08, 42.35]),
    cellMetres: 250,
    graph,
    streets,
    cells: [],
    tripScalePermille: 1000,
    gravityBetaM: 1000,
    gateways: [],
    depotLand: [],
    landmarks: [],
  };
}

describe('a stop never stands on a motorway', () => {
  const city = besideAMotorway();
  const world = createWorld(city, newGame({ id: 'test', revision: 'test', hash: '-' }, { name: 'x', colour: '#000000' }, 1));
  const click: XY = [200, 25]; // 5 m from the motorway node, 25 m from the street's

  it('knows which nodes a stop may stand on', () => {
    expect([0, 1, 2, 3, 4, 5].map((n) => stopNode(city, n))).toEqual([true, true, true, false, false, false]);
  });

  it('snaps the line tool, the stop rule, the depot rule and routing to the street, not the motorway', () => {
    expect(nearestNode(world, click)).toBe(1);
    expect(lineDraftContext(world).nearestNode(click, 150)?.node).toBe(1);
    expect(checkStopSite(lineDraftContext(world), click)).toMatchObject({ ok: true, kind: 'new', node: 1 });
    expect(depotSiteContext(world).nearestNode(click, 150)?.node).toBe(1);
  });
});

const index = JSON.parse(readFileSync('cities/index.json', 'utf8')) as { cities: { sim: { file: string } }[] };
const innerFile = `public/cities/${index.cities[0]!.sim.file}`;

describe.skipIf(!existsSync(innerFile))('legs on Inner Boston, against the straight line (bench/routes.ts)', () => {
  const loaded = loadCity(readFileSync(innerFile, 'utf8'));
  if (!loaded.ok) throw new Error(loaded.problem);
  const city = loaded.city;
  const nodes = new SpatialGrid<number>(200);
  for (let n = 0; n < city.graph.nodeCount; n++) if (stopNode(city, n)) nodes.add([city.graph.x[n]!, city.graph.y[n]!], n);
  const router = createRouter(city.graph, { oneway: BUSES_KEEP_ONE_WAY });
  const leg = (a: XY, b: XY) => {
    const na = nodes.nearest(a, 400)?.item;
    const nb = nodes.nearest(b, 400)?.item;
    if (na === undefined || nb === undefined) return null;
    const g = city.graph;
    return { ratio: router.route(na, nb)!.dm / 10 / distXY([g.x[na]!, g.y[na]!], [g.x[nb]!, g.y[nb]!]), same: na === nb, onMotorway: !stopNode(city, na) || !stopNode(city, nb) };
  };

  it('drives Prudential to Back Bay station and back in under 2.5 times the straight line (7,976 m back, 18 times, before)', () => {
    const a = toXY(city.frame, [-71.082, 42.347]);
    const b = toXY(city.frame, [-71.076, 42.3473]);
    expect(leg(a, b)!.ratio).toBeLessThan(2.5);
    expect(leg(b, a)!.ratio).toBeLessThan(2.5);
  });

  it.each([
    ['Back Bay', [-71.09, 42.345, -71.069, 42.356]],
    ['downtown', [-71.066, 42.349, -71.051, 42.363]],
  ] as [string, [number, number, number, number]][])('in %s, sends under 1 in 20 of 300 click pairs over twice the straight line, and none over 5 times or onto a motorway', (name, box) => {
    // Measured 2026-10-14: before, 30.1% and 28.8% over twice, the worst 41.3 and 20.4 times; now 1.4% and 1.6%, the worst 2.4 and 2.2.
    const rng = createRng(seedFor(name, 'routes'));
    const ratios: number[] = [];
    while (ratios.length < 300) {
      const a = toXY(city.frame, [rng.range(box[0], box[2]), rng.range(box[1], box[3])] as LngLat);
      const b = toXY(city.frame, [rng.range(box[0], box[2]), rng.range(box[1], box[3])] as LngLat);
      const d = distXY(a, b);
      if (d < 250 || d > 600) continue;
      const l = leg(a, b);
      if (!l || l.same) continue;
      expect(l.onMotorway).toBe(false);
      ratios.push(l.ratio);
    }
    expect(ratios.filter((r) => r > 2).length / ratios.length).toBeLessThan(0.05);
    expect(Math.max(...ratios)).toBeLessThan(5);
  });
});
