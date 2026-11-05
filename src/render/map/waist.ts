// How a line's ribbon looks where it goes from one of its runs to the next (sides.ts runsOf and bridgesOf), on the ground as MapLibre
// draws it: each piece offset by its side as line-offset lays it, a miter-offset polyline, stroked a ribbon wide with round caps and
// joins, in cells of RES px about the point. Its waist is the widest disc that passes inside the strokes from the run before, WAY px
// back along it, to the run after, WAY px on: a straight ribbon's is its own width, and two round caps a ribbon apart, which only
// touch, give a pixel or so. Its breadth is the widest disc within two ribbons of the point: round a ribbon's own corner it is 1.2
// ribbons, and two pieces side by side a ribbon apart make up to two. As the systems audit's twenty-third round's first lane measured
// them. For the tests and `npm run bench sides`; the game never draws from it.
import { groundAt, ribbonPx, type Run } from './sides';
import type { LngLatPair } from '../../sim/types';

const RES = 0.2;
const WIN = 32;
const WAY = 20;
type P = readonly [number, number];

/** The waist and breadth, in px at `zoom`, of a line's ribbon where its run `r - 1` ends and run `r` starts, with its `bridges`. */
export function linkShape(route: readonly LngLatPair[], runs: readonly Run[], bridges: readonly Run[], r: number, zoom: number): { readonly waist: number; readonly breadth: number } {
  const [was, now] = [runs[r - 1]!, runs[r]!];
  const ground = groundAt(zoom);
  const w = ribbonPx(zoom);
  const near = (pts: readonly LngLatPair[]) => pts.map((p) => ground(p) as P);
  const before = offset(near(was.points), was.side * w);
  const after = offset(near(now.points), now.side * w);
  const own = bridges.filter((b) => b.first === was.last && b.last === now.first).map((b) => offset(near(b.points), b.side * w));
  return shape([before, after, ...own], w, ground(route[now.first]!) as P, along([...before].reverse(), WAY), along(after, WAY));
}

/** A polyline on the ground (y down) offset `o` px to the right of its way, as line-offset lays it: each inner vertex along its miter. */
function offset(pts: readonly P[], o: number): P[] {
  const normal = (a: P, b: P): P => {
    const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
    const l = Math.hypot(dx, dy) || 1;
    return [-dy / l, dx / l];
  };
  return pts.map((p, i) => {
    const [prev, next] = [i > 0 ? normal(pts[i - 1]!, p) : null, i < pts.length - 1 ? normal(p, pts[i + 1]!) : null];
    if (!prev || !next) {
      const m = (prev ?? next)!;
      return [p[0] + m[0] * o, p[1] + m[1] * o] as const;
    }
    const [sx, sy] = [prev[0] + next[0], prev[1] + next[1]];
    const sl = Math.hypot(sx, sy) || 1;
    const scale = 1 / Math.max(0.2, (sx / sl) * prev[0] + (sy / sl) * prev[1]);
    return [p[0] + (sx / sl) * o * scale, p[1] + (sy / sl) * o * scale] as const;
  });
}

/** The point `d` px along `pts` from its start, or its end. */
function along(pts: readonly P[], d: number): P {
  let left = d;
  for (let i = 1; i < pts.length; i++) {
    const [a, b] = [pts[i - 1]!, pts[i]!];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (left <= l) return [a[0] + ((b[0] - a[0]) * left) / l, a[1] + ((b[1] - a[1]) * left) / l];
    left -= l;
  }
  return pts[pts.length - 1]!;
}

/** The waist from `from` to `to`, and the breadth about `c`, of the strokes `pieces`, `w` px wide, all in px within WIN of `c`. */
function shape(pieces: readonly (readonly P[])[], w: number, c: P, from: P, to: P): { readonly waist: number; readonly breadth: number } {
  const N = Math.ceil((2 * WIN) / RES);
  const x0 = c[0] - WIN;
  const y0 = c[1] - WIN;
  const inside = new Uint8Array(N * N);
  const r2 = (w / 2) ** 2;
  for (const pts of pieces) {
    for (let i = 0; i + 1 < pts.length; i++) {
      const [a, b] = [pts[i]!, pts[i + 1]!];
      const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
      const l2 = dx * dx + dy * dy;
      const [k0, k1] = [Math.max(0, Math.floor((Math.min(a[0], b[0]) - w / 2 - x0) / RES)), Math.min(N - 1, Math.ceil((Math.max(a[0], b[0]) + w / 2 - x0) / RES))];
      const [j0, j1] = [Math.max(0, Math.floor((Math.min(a[1], b[1]) - w / 2 - y0) / RES)), Math.min(N - 1, Math.ceil((Math.max(a[1], b[1]) + w / 2 - y0) / RES))];
      for (let j = j0; j <= j1; j++) {
        const y = y0 + (j + 0.5) * RES;
        for (let k = k0; k <= k1; k++) {
          if (inside[j * N + k]) continue;
          const x = x0 + (k + 0.5) * RES;
          const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l2)) : 0;
          if ((a[0] + t * dx - x) ** 2 + (a[1] + t * dy - y) ** 2 <= r2) inside[j * N + k] = 1;
        }
      }
    }
  }
  // Each cell's squared distance, in cells, to the nearest cell outside (Felzenszwalb and Huttenlocher's transform), the window's
  // edge counting as inside.
  const INF = 1e12;
  const f = new Float64Array(N * N);
  for (let i = 0; i < N * N; i++) f[i] = inside[i] ? INF : 0;
  const line = new Float64Array(N);
  const out = new Float64Array(N);
  const v = new Int32Array(N);
  const z = new Float64Array(N + 1);
  const pass = () => {
    let k = 0;
    v[0] = 0;
    [z[0], z[1]] = [-INF, INF];
    for (let q = 1; q < N; q++) {
      let s = (line[q]! + q * q - (line[v[k]!]! + v[k]! * v[k]!)) / (2 * q - 2 * v[k]!);
      while (s <= z[k]!) {
        k--;
        s = (line[q]! + q * q - (line[v[k]!]! + v[k]! * v[k]!)) / (2 * q - 2 * v[k]!);
      }
      k++;
      v[k] = q;
      [z[k], z[k + 1]] = [s, INF];
    }
    k = 0;
    for (let q = 0; q < N; q++) {
      while (z[k + 1]! < q) k++;
      out[q] = (q - v[k]!) ** 2 + line[v[k]!]!;
    }
  };
  for (let x = 0; x < N; x++) {
    for (let y = 0; y < N; y++) line[y] = f[y * N + x]!;
    pass();
    for (let y = 0; y < N; y++) f[y * N + x] = out[y]!;
  }
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) line[x] = f[y * N + x]!;
    pass();
    for (let x = 0; x < N; x++) f[y * N + x] = out[x]!;
  }
  // The widest disc that passes: the path from `from` to `to` whose narrowest cell is widest (Dijkstra's, on that narrowest).
  const cell = (p: P) => Math.min(N - 1, Math.max(0, Math.floor((p[1] - y0) / RES))) * N + Math.min(N - 1, Math.max(0, Math.floor((p[0] - x0) / RES)));
  const [s, t] = [cell(from), cell(to)];
  const best = new Float64Array(N * N);
  best[s] = f[s]!;
  const heap: number[] = [s];
  const above = (a: number, b: number) => best[a]! > best[b]!;
  const done = new Uint8Array(N * N);
  while (heap.length > 0) {
    const i = heap[0]!;
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      for (let k = 0; ; ) {
        const [l, r] = [2 * k + 1, 2 * k + 2];
        let m = k;
        if (l < heap.length && above(heap[l]!, heap[m]!)) m = l;
        if (r < heap.length && above(heap[r]!, heap[m]!)) m = r;
        if (m === k) break;
        [heap[k], heap[m]] = [heap[m]!, heap[k]!];
        k = m;
      }
    }
    if (done[i]) continue;
    done[i] = 1;
    if (i === t) break;
    const [x, y] = [i % N, Math.floor(i / N)];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
      const [nx, ny] = [x + dx, y + dy];
      if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
      const j = ny * N + nx;
      if (done[j] || !inside[j]) continue;
      const value = Math.min(best[i]!, f[j]!);
      if (value <= best[j]!) continue;
      best[j] = value;
      heap.push(j);
      for (let k = heap.length - 1; k > 0; ) {
        const p = (k - 1) >> 1;
        if (!above(heap[k]!, heap[p]!)) break;
        [heap[k], heap[p]] = [heap[p]!, heap[k]!];
        k = p;
      }
    }
  }
  let widest = 0;
  const reach = (2 * w) / RES;
  const middle = N / 2;
  for (let y = Math.max(0, Math.floor(middle - reach)); y < Math.min(N, Math.ceil(middle + reach)); y++) {
    for (let x = Math.max(0, Math.floor(middle - reach)); x < Math.min(N, Math.ceil(middle + reach)); x++) {
      if ((x + 0.5 - middle) ** 2 + (y + 0.5 - middle) ** 2 <= reach * reach) widest = Math.max(widest, f[y * N + x]!);
    }
  }
  return { waist: 2 * Math.sqrt(best[t]!) * RES, breadth: 2 * Math.sqrt(widest) * RES };
}
