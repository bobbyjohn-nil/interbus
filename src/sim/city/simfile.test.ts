import { describe, expect, it } from 'vitest';
import { bakeSim, cityFrame } from '../../../tools/bake/sim.mjs';
import { distXY, frameFor, toXY, type LngLat, type XY } from '../core/geo';
import { createRouter } from './route';
import { loadCity, type City } from './simfile';

// The committed fixture, baked in-process from its pinned inputs (tools/bake/sim.mjs, I17).
const text = bakeSim('boston', 'mini-boston').text;
const loaded = loadCity(text);
if (!loaded.ok) throw new Error(loaded.problem);
const city: City = loaded.city;
const INNER_BOSTON: [number, number, number, number] = [-71.16, 42.315, -70.98, 42.405];

function nearestNode(at: XY): number {
  let best = -1;
  let bestD = Infinity;
  for (let n = 0; n < city.graph.nodeCount; n++) {
    const d = distXY(at, [city.graph.x[n]!, city.graph.y[n]!]);
    if (d < bestD) [best, bestD] = [n, d];
  }
  return best;
}

describe("mini-Boston's sim.json", () => {
  it('loads whole: every street, cell, resident and job', () => {
    expect(city.graph.nodeCount).toBe(681);
    expect(city.graph.edgeA.length).toBe(1037);
    expect(city.cells).toHaveLength(84);
    expect(city.cells.reduce((s, c) => s + c.residents, 0)).toBe(105_620);
    expect(city.cells.reduce((s, c) => s + c.jobs, 0)).toBe(186_144);
    expect(city.streets.every((s) => s.points.length >= 2)).toBe(true);
    // Three small industrial parcels, the nearest about 330 m from the debug line; no gateways,
    // since the fixture keeps only commutes with both ends in its box.
    expect(city.depotLand).toHaveLength(3);
    expect(city.gateways).toEqual([]);
    // The landmarks the fixture's box holds, where contracts are offered (the M3 spec, item 1).
    expect(city.landmarks.map((l) => l.name)).toEqual(['Copley Square', 'Longwood', 'Kenmore']);
  });

  it("uses exactly the sim's own frame: the bake and the game measure alike", () => {
    expect(city.frame).toEqual(cityFrame(INNER_BOSTON));
    expect(city.frame).toEqual(frameFor([-71.16, 42.315], 42.36));
  });

  it('is one network a bus can drive from anywhere to anywhere and back (I10)', () => {
    // Forward and backward reach from node 0 over open half-edges.
    const g = city.graph;
    const reach = (forward: boolean) => {
      const seen = new Uint8Array(g.nodeCount);
      const stack = [0];
      seen[0] = 1;
      while (stack.length) {
        const u = stack.pop()!;
        for (let k = g.start[u]!; k < g.start[u + 1]!; k++) {
          const open = forward ? g.slotOpen[k] : g.slotOpen[g.slotTwin[k]!];
          const v = g.slotNode[k]!;
          if (open && !seen[v]) {
            seen[v] = 1;
            stack.push(v);
          }
        }
      }
      return seen.reduce((s, x) => s + x, 0);
    };
    expect(reach(true)).toBe(g.nodeCount);
    expect(reach(false)).toBe(g.nodeCount);
  });

  it('puts at least 90% of built-up street nodes within 650 m of where people live (I10)', () => {
    // Built-up: a node in a cell that holds residents or jobs.
    const homes = city.cells.flatMap((c) => c.homes);
    const occupied = new Set(city.cells.filter((c) => c.residents + c.jobs > 0).map((c) => `${c.i}:${c.j}`));
    let builtUp = 0;
    let near = 0;
    for (let n = 0; n < city.graph.nodeCount; n++) {
      const p: XY = [city.graph.x[n]!, city.graph.y[n]!];
      if (!occupied.has(`${Math.floor(p[0] / city.cellMetres)}:${Math.floor(p[1] / city.cellMetres)}`)) continue;
      builtUp++;
      if (homes.some((h) => distXY(p, [h.x, h.y]) <= 650)) near++;
    }
    expect(builtUp).toBeGreaterThan(300);
    expect(near / builtUp).toBeGreaterThanOrEqual(0.9);
  });

  it('drives Copley to Longwood in 3–4 km of streets, as the spec expects', () => {
    const at = (p: LngLat) => nearestNode(toXY(city.frame, p));
    const router = createRouter(city.graph);
    const there = router.route(at([-71.077, 42.3499]), at([-71.1035, 42.336]));
    const back = router.route(at([-71.1035, 42.336]), at([-71.077, 42.3499]));
    for (const path of [there, back]) {
      expect(path).not.toBeNull();
      expect(path!.dm / 10).toBeGreaterThan(2_760); // never shorter than the straight line
      expect(path!.dm / 10).toBeLessThan(4_500);
    }
  });
});

describe('refusals (never repaired at load)', () => {
  const data = () => JSON.parse(text) as Record<string, unknown>;
  const problem = (mutate: (d: Record<string, unknown>) => void) => {
    const d = data();
    mutate(d);
    const r = loadCity(JSON.stringify(d));
    return r.ok ? 'loaded' : `${r.reason}: ${r.problem}`;
  };

  it('refuses text that is not JSON, or another format', () => {
    expect(loadCity('{nope')).toMatchObject({ ok: false, reason: 'not_json' });
    expect(problem((d) => void (d.format = 2))).toBe('wrong_format: format 2, not 1');
  });

  it('refuses a broken street, a split network and cells whose points lose people', () => {
    expect(problem((d) => void ((d.edges as unknown[][])[0]![1] = 99_999))).toMatch(/^malformed: edges\[0\]: names a missing node/);
    expect(problem((d) => void ((d.edges as unknown[][])[0]![4] = 2))).toMatch(/oneway 2/);
    expect(problem((d) => void ((d.nodes as number[]).push(0, 0)))).toMatch(/more than one piece/);
    expect(problem((d) => void (((d.cells as { homes: number[] }[])[0]!.homes[2]! += 1)))).toMatch(/do not add up to its residents/);
    // Demand keeps a cell's sub-points in an 8-bit mask, so a ninth is refused, not silently misread.
    expect(problem((d) => void (d.cells as { homes: number[]; residents: number }[]).forEach((c) => {
      while (c.homes.length < 27) c.homes.push(0, 0, 0);
    }))).toMatch(/cells\[0\]\.homes: 9 points, more than 8/);
    expect(problem((d) => void ((d.calib as { tripScalePermille: number }).tripScalePermille = 0))).toMatch(/tripScalePermille/);
    expect(problem((d) => void delete (d.calib as { gravityBetaM?: number }).gravityBetaM)).toMatch(/gravityBetaM/);
    // Gateways name a street node and the cells their commuters work in; depot land is rings.
    expect(problem((d) => void (d.gateways = [{ name: 'Mass Pike', kind: 'road', node: 99_999, inbound: [] }]))).toMatch(/gateways\[0\]/);
    expect(problem((d) => void (d.gateways = [{ name: 'Mass Pike', kind: 'road', node: 0, inbound: [99_999, 5] }]))).toMatch(/missing cell/);
    expect(problem((d) => void (d.gateways = [{ name: 'Mass Pike', kind: 'ferry', node: 0, inbound: [] }]))).toMatch(/gateways\[0\]/);
    expect(problem((d) => void (d.depotLand = [[0, 0, 10, 10]]))).toMatch(/depotLand\[0\]/);
    expect(problem((d) => void delete d.depotLand)).toMatch(/depotLand: not a list/);
    expect(problem((d) => void delete d.landmarks)).toMatch(/landmarks: not a list/);
    expect(problem((d) => void (d.landmarks = [{ name: '', x: 0, y: 0 }]))).toMatch(/landmarks\[0\]/);
    expect(problem((d) => void (d.landmarks = [{ name: 'Longwood', x: 1.5, y: 0 }]))).toMatch(/landmarks\[0\]/);
  });
});
