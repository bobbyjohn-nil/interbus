import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { buildGraph, labelComponents, type EdgeInput, type Graph } from './graph';
import { createRouter } from './route';

/** A w × h street grid, 100 m blocks, with random speeds and some streets missing. */
function grid(w: number, h: number, seed: number, missing = 0.1): Graph {
  const rng = createRng(seed);
  const nodes: [number, number][] = [];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) nodes.push([i * 100, j * 100]);
  const edges: EdgeInput[] = [];
  const link = (a: number, b: number) => {
    if (rng.next() < missing) return;
    const dm = 1000 + rng.int(0, 80); // a little longer than the straight line, as streets are
    const kmh = rng.pick([15, 25, 40, 60]);
    edges.push({ a, b, dm, cs: Math.round((dm / 10 / (kmh / 3.6)) * 100) });
  };
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      if (i + 1 < w) link(j * w + i, j * w + i + 1);
      if (j + 1 < h) link(j * w + i, (j + 1) * w + i);
    }
  }
  return buildGraph(nodes, edges);
}

/** Plain Dijkstra over nodes: the yardstick. */
function dijkstra(g: Graph, from: number): Float64Array {
  const dist = new Float64Array(g.nodeCount).fill(Infinity);
  const done = new Uint8Array(g.nodeCount);
  dist[from] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < g.nodeCount; i++) if (!done[i] && dist[i]! < Infinity && (u === -1 || dist[i]! < dist[u]!)) u = i;
    if (u === -1) return dist;
    done[u] = 1;
    for (let k = g.start[u]!; k < g.start[u + 1]!; k++) {
      const v = g.slotNode[k]!;
      dist[v] = Math.min(dist[v]!, dist[u]! + g.edgeCs[g.slotEdge[k]!]!);
    }
  }
}

describe('graph', () => {
  it('writes each street twice in the CSR, the two slots twinned', () => {
    const g = buildGraph([[0, 0], [1, 0], [2, 0]], [{ a: 0, b: 1, dm: 10, cs: 100 }, { a: 1, b: 2, dm: 10, cs: 100 }]);
    expect([...g.start]).toEqual([0, 1, 3, 4]);
    for (let k = 0; k < g.slotNode.length; k++) {
      const twin = g.slotTwin[k]!;
      expect(g.slotEdge[twin]).toBe(g.slotEdge[k]);
      expect(g.slotTwin[twin]).toBe(k);
    }
  });

  it('refuses loops, missing nodes and fractional or zero times', () => {
    expect(() => buildGraph([[0, 0]], [{ a: 0, b: 0, dm: 1, cs: 1 }])).toThrow(RangeError);
    expect(() => buildGraph([[0, 0], [1, 0]], [{ a: 0, b: 2, dm: 1, cs: 1 }])).toThrow(RangeError);
    expect(() => buildGraph([[0, 0], [1, 0]], [{ a: 0, b: 1, dm: 1.5, cs: 1 }])).toThrow(RangeError);
    expect(() => buildGraph([[0, 0], [1, 0]], [{ a: 0, b: 1, dm: 1, cs: 0 }])).toThrow(RangeError);
  });

  it('counts connected pieces', () => {
    expect(labelComponents(grid(8, 6, 1, 0)).count).toBe(1);
    const split = buildGraph([[0, 0], [1, 0], [5, 0], [6, 0]], [{ a: 0, b: 1, dm: 10, cs: 10 }, { a: 2, b: 3, dm: 10, cs: 10 }]);
    expect(labelComponents(split)).toEqual({ label: Int32Array.from([0, 0, 1, 1]), count: 2 });
  });
});

describe('A* (ported from V2, on directed half-edges)', () => {
  it('finds the optimum Dijkstra finds, on 400 random trips over three cities', () => {
    for (const seed of [1, 2, 3]) {
      const g = grid(30, 24, seed);
      const router = createRouter(g);
      const rng = createRng(100 + seed);
      for (let t = 0; t < 400 / 3; t++) {
        const from = rng.int(0, g.nodeCount - 1);
        const to = rng.int(0, g.nodeCount - 1);
        const truth = dijkstra(g, from)[to]!;
        const path = router.route(from, to);
        if (truth === Infinity) {
          expect(path).toBeNull();
          continue;
        }
        expect(path?.cs, `${from} → ${to}`).toBe(truth);
        // The path is real: each edge joins its two nodes, and the sums add up.
        path!.edges.forEach((e, i) => {
          const ends = [g.edgeA[e], g.edgeB[e]];
          expect(ends).toContain(path!.nodes[i]);
          expect(ends).toContain(path!.nodes[i + 1]);
        });
        expect(path!.edges.reduce((s, e) => s + g.edgeCs[e]!, 0)).toBe(path!.cs);
        expect(path!.edges.reduce((s, e) => s + g.edgeDm[e]!, 0)).toBe(path!.dm);
      }
    }
  });

  it('returns null when there is no way through, and a trivial path to itself', () => {
    const g = buildGraph([[0, 0], [1, 0], [5, 0], [6, 0]], [{ a: 0, b: 1, dm: 10, cs: 10 }, { a: 2, b: 3, dm: 10, cs: 10 }]);
    const router = createRouter(g);
    expect(router.route(0, 3)).toBeNull();
    expect(router.route(2, 2)).toEqual({ nodes: [2], edges: [], cs: 0, dm: 0 });
  });

  it('gives the same paths from two fresh routers, and from one reused 10,000 times', () => {
    const g = grid(20, 20, 9);
    const a = createRouter(g);
    const b = createRouter(g);
    const rng = createRng(77);
    const trips = Array.from({ length: 200 }, () => [rng.int(0, 399), rng.int(0, 399)] as const);
    for (let i = 0; i < 50; i++) for (const [f, t] of trips) a.route(f, t);
    for (const [f, t] of trips) expect(a.route(f, t)).toEqual(b.route(f, t));
  });

  it('takes the better arrival when a turn costs time (K13)', () => {
    // S→A→X is quicker to X than S→B→X, but turning from A–X onto X–T costs 100. Closing X on its
    // first arrival, as V1 and V2 did, misses S→B→X→T entirely.
    //        A
    //      /   \
    //    S       X — T
    //      \   /
    //        B
    const g = buildGraph(
      [[0, 0], [5, 5], [5, -5], [10, 0], [15, 0]],
      [
        { a: 0, b: 1, dm: 100, cs: 10 }, // S–A
        { a: 1, b: 3, dm: 100, cs: 10 }, // A–X
        { a: 0, b: 2, dm: 100, cs: 12 }, // S–B
        { a: 2, b: 3, dm: 100, cs: 12 }, // B–X
        { a: 3, b: 4, dm: 100, cs: 10 }, // X–T
      ],
    );
    const awkwardTurn = (node: number, inEdge: number, outEdge: number) => (node === 3 && inEdge === 1 && outEdge === 4 ? 100 : 0);
    const path = createRouter(g).route(0, 4, awkwardTurn);
    expect(path?.nodes).toEqual([0, 2, 3, 4]);
    expect(path?.cs).toBe(34);
  });
});
