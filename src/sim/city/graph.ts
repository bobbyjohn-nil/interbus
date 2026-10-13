// The street graph the sim routes on, ported from V2's CSR (`Intralines_City_dep@archive/
// intralines-city-v1:Gaming/src/20-city.js:1527-1561`, S12) onto typed arrays. Lengths and times are
// whole decimetres and centiseconds, so path sums are exact and the same in any order (I8). The bake
// (tools/bake) builds the graph and sim.json carries its edge list; the worker only rebuilds the
// CSR from it, through this one function. V2's connectAll, which invents straight streets between
// pieces, does not port: real Boston keeps its main component and gate G2 names what it dropped.

export interface EdgeInput {
  readonly a: number;
  readonly b: number;
  /** Length along the street, whole decimetres. */
  readonly dm: number;
  /** Free-flow driving time, whole centiseconds. */
  readonly cs: number;
}

export interface Graph {
  readonly nodeCount: number;
  /** Node positions in the city frame's metres. */
  readonly x: Float64Array;
  readonly y: Float64Array;
  readonly edgeA: Int32Array;
  readonly edgeB: Int32Array;
  readonly edgeDm: Int32Array;
  readonly edgeCs: Int32Array;
  /**
   * CSR adjacency: the slots of node i are start[i] .. start[i + 1] - 1. Slot k leaves its node along
   * edge slotEdge[k] to node slotNode[k]. Each undirected edge has two slots, so a slot is a directed
   * half-edge: the router's search state (K13).
   */
  readonly start: Int32Array;
  readonly slotNode: Int32Array;
  readonly slotEdge: Int32Array;
  /** The slot leaving the other end of the same edge in the other direction. */
  readonly slotTwin: Int32Array;
  /** The fewest centiseconds any edge takes per decimetre: the A* heuristic's speed limit. */
  readonly minCsPerDm: number;
}

function wholePositive(n: number, what: string): void {
  if (!Number.isSafeInteger(n) || n < 0) throw new RangeError(`${what} must be a whole number ≥ 0, got ${n}`);
}

export function buildGraph(nodes: readonly (readonly [number, number])[], edges: readonly EdgeInput[]): Graph {
  const n = nodes.length;
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  nodes.forEach(([nx, ny], i) => {
    if (!Number.isFinite(nx) || !Number.isFinite(ny)) throw new RangeError(`node ${i} is not finite`);
    x[i] = nx;
    y[i] = ny;
  });
  const e = edges.length;
  const edgeA = new Int32Array(e);
  const edgeB = new Int32Array(e);
  const edgeDm = new Int32Array(e);
  const edgeCs = new Int32Array(e);
  const degree = new Int32Array(n + 1);
  let minCsPerDm = Infinity;
  edges.forEach((edge, i) => {
    for (const end of [edge.a, edge.b]) if (!Number.isInteger(end) || end < 0 || end >= n) throw new RangeError(`edge ${i} names node ${end}`);
    if (edge.a === edge.b) throw new RangeError(`edge ${i} is a loop`);
    wholePositive(edge.dm, `edge ${i} length`);
    wholePositive(edge.cs, `edge ${i} time`);
    if (edge.cs === 0) throw new RangeError(`edge ${i} takes no time`);
    edgeA[i] = edge.a;
    edgeB[i] = edge.b;
    edgeDm[i] = edge.dm;
    edgeCs[i] = edge.cs;
    degree[edge.a + 1]! += 1;
    degree[edge.b + 1]! += 1;
    if (edge.dm > 0) minCsPerDm = Math.min(minCsPerDm, edge.cs / edge.dm);
  });
  // Prefix sums, then fill each node's slots in edge order (V2's buildCSR), so the CSR is deterministic.
  const start = new Int32Array(n + 1);
  for (let i = 0; i < n; i++) start[i + 1] = start[i]! + degree[i + 1]!;
  const fill = start.slice(0, n);
  const slotNode = new Int32Array(2 * e);
  const slotEdge = new Int32Array(2 * e);
  const slotTwin = new Int32Array(2 * e);
  for (let i = 0; i < e; i++) {
    const a = edgeA[i]!;
    const b = edgeB[i]!;
    const ka = fill[a]!++;
    const kb = fill[b]!++;
    slotNode[ka] = b;
    slotEdge[ka] = i;
    slotNode[kb] = a;
    slotEdge[kb] = i;
    slotTwin[ka] = kb;
    slotTwin[kb] = ka;
  }
  return { nodeCount: n, x, y, edgeA, edgeB, edgeDm, edgeCs, start, slotNode, slotEdge, slotTwin, minCsPerDm: Number.isFinite(minCsPerDm) ? minCsPerDm : 0 };
}

/** Connected components by flood fill (V2's labelComponents, 20-city.js:1543-1561). */
export function labelComponents(g: Graph): { label: Int32Array; count: number } {
  const label = new Int32Array(g.nodeCount).fill(-1);
  const stack: number[] = [];
  let count = 0;
  for (let s = 0; s < g.nodeCount; s++) {
    if (label[s] !== -1) continue;
    label[s] = count;
    stack.push(s);
    while (stack.length > 0) {
      const u = stack.pop()!;
      for (let k = g.start[u]!; k < g.start[u + 1]!; k++) {
        const v = g.slotNode[k]!;
        if (label[v] === -1) {
          label[v] = count;
          stack.push(v);
        }
      }
    }
    count++;
  }
  return { label, count };
}
