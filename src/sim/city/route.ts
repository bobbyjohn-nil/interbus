// A* over the street graph, ported from V2 (`Intralines_City_dep@archive/intralines-city-v1:
// Gaming/src/20-city.js:1992-2110`, S12): a binary heap with lazy deletion and scratch arrays reused
// through a generation stamp, so nothing is cleared per search. Changed on the way in:
// - the search state is a directed half-edge (a CSR slot), not a node, so a turn cost or a one-way
//   street can never close a node on the wrong arrival (K13; V1 routing.ts:276-293, and V2 closed
//   nodes, correct only while it had neither);
// - costs are whole centiseconds and the heuristic is floored, so sums are exact and it stays
//   admissible; ties break by cost, then slot id, the same on every engine;
// - the scratch belongs to a Router the worker owns, not a hidden slot on the city.
// Congestion never enters routing (V2 dynamic-traffic.md:72).
import type { Graph } from './graph';

export interface Path {
  readonly nodes: number[];
  readonly edges: number[];
  /** Whole centiseconds of free-flow driving. */
  readonly cs: number;
  /** Whole decimetres. */
  readonly dm: number;
}

/** Extra centiseconds to turn at `node` from edge `inEdge` onto `outEdge`; 0 by default. */
export type TurnCost = (node: number, inEdge: number, outEdge: number) => number;

export interface Router {
  route(from: number, to: number, turnCost?: TurnCost): Path | null;
}

const GEN_LIMIT = 2_000_000_000;

/** `oneway: false` drives every street both ways; the default keeps to one-way streets. */
export function createRouter(g: Graph, { oneway = true }: { readonly oneway?: boolean } = {}): Router {
  const drivable = (k: number) => !oneway || g.slotOpen[k] === 1;
  const slots = g.slotNode.length;
  const best = new Int32Array(slots);
  const seen = new Uint32Array(slots);
  const closed = new Uint32Array(slots);
  const prev = new Int32Array(slots);
  let gen = 0;
  // Heap of slots keyed by f, then slot id.
  let heapSlot = new Int32Array(64);
  let heapF = new Float64Array(64);
  let size = 0;

  const less = (i: number, j: number) => heapF[i]! < heapF[j]! || (heapF[i] === heapF[j] && heapSlot[i]! < heapSlot[j]!);
  const swap = (i: number, j: number) => {
    [heapSlot[i], heapSlot[j]] = [heapSlot[j]!, heapSlot[i]!];
    [heapF[i], heapF[j]] = [heapF[j]!, heapF[i]!];
  };
  const push = (slot: number, f: number) => {
    if (size === heapSlot.length) {
      const s = new Int32Array(size * 2);
      s.set(heapSlot);
      heapSlot = s;
      const ff = new Float64Array(size * 2);
      ff.set(heapF);
      heapF = ff;
    }
    heapSlot[size] = slot;
    heapF[size] = f;
    let i = size++;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!less(i, parent)) break;
      swap(i, parent);
      i = parent;
    }
  };
  const pop = (): number => {
    const top = heapSlot[0]!;
    size--;
    if (size > 0) {
      heapSlot[0] = heapSlot[size]!;
      heapF[0] = heapF[size]!;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < size && less(l, m)) m = l;
        if (r < size && less(r, m)) m = r;
        if (m === i) break;
        swap(i, m);
        i = m;
      }
    }
    return top;
  };

  const heuristic = (node: number, to: number) => {
    const dx = g.x[to]! - g.x[node]!;
    const dy = g.y[to]! - g.y[node]!;
    // Metres to decimetres, at the fastest edge's pace, floored: never more than the true cost.
    return Math.floor(Math.sqrt(dx * dx + dy * dy) * 10 * g.minCsPerDm);
  };

  return {
    route(from, to, turnCost) {
      for (const node of [from, to]) if (!Number.isInteger(node) || node < 0 || node >= g.nodeCount) throw new RangeError(`no node ${node}`);
      if (from === to) return { nodes: [from], edges: [], cs: 0, dm: 0 };
      if (++gen >= GEN_LIMIT) {
        seen.fill(0);
        closed.fill(0);
        gen = 1;
      }
      size = 0;
      for (let k = g.start[from]!; k < g.start[from + 1]!; k++) {
        if (!drivable(k)) continue;
        best[k] = g.edgeCs[g.slotEdge[k]!]!;
        seen[k] = gen;
        prev[k] = -1;
        push(k, best[k]! + heuristic(g.slotNode[k]!, to));
      }
      while (size > 0) {
        const k = pop();
        if (closed[k] === gen) continue;
        closed[k] = gen;
        const node = g.slotNode[k]!;
        if (node === to) return unwind(k);
        const inEdge = g.slotEdge[k]!;
        for (let out = g.start[node]!; out < g.start[node + 1]!; out++) {
          if (closed[out] === gen || !drivable(out)) continue;
          const outEdge = g.slotEdge[out]!;
          const cost = best[k]! + g.edgeCs[outEdge]! + (turnCost ? turnCost(node, inEdge, outEdge) : 0);
          if (seen[out] !== gen || cost < best[out]!) {
            seen[out] = gen;
            best[out] = cost;
            prev[out] = k;
            push(out, cost + heuristic(g.slotNode[out]!, to));
          }
        }
      }
      return null;

      function unwind(last: number): Path {
        const slots: number[] = [];
        for (let s = last; s !== -1; s = prev[s]!) {
          slots.push(s);
          if (slots.length > g.slotNode.length) throw new Error('a parent cycle in the router');
        }
        slots.reverse();
        const edges = slots.map((s) => g.slotEdge[s]!);
        const nodes = [from, ...slots.map((s) => g.slotNode[s]!)];
        const dm = edges.reduce((sum, e) => sum + g.edgeDm[e]!, 0);
        return { nodes, edges, cs: best[last]!, dm };
      }
    },
  };
}
