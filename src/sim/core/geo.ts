// The one geo module (K54: V1 and V3 had five), ported from V1 (`Intralines@7af45b1:src/game/geo.ts`,
// S15). Changed on the way in:
// - one local frame per city, computed once, where V1 recomputed cos(lat) five ways;
// - the true metres per degree at the city's latitude (an ellipsoid series), where V1's 110,540 m
//   per degree of latitude is the equator's and runs 0.59% short north–south at Boston;
// - the spatial grid works in metres with integer cell keys, where V1 used degrees and "x:y" strings.
// The bake computes the frame in Node and writes it to sim.json, so every engine reads the same
// constants instead of evaluating Math.cos itself.

export type LngLat = readonly [lon: number, lat: number];
export type XY = readonly [x: number, y: number];

/** A flat frame in metres around one point: accurate to well under 0.1% across Inner Boston. */
export interface Frame {
  readonly origin: LngLat;
  readonly metresPerDegLon: number;
  readonly metresPerDegLat: number;
}

/** Metres per degree at `lat` on the WGS 84 ellipsoid (the usual series), and a frame from `origin`. */
export function frameFor(origin: LngLat, lat = origin[1]): Frame {
  const phi = (lat * Math.PI) / 180;
  return {
    origin,
    metresPerDegLat: 111_132.954 - 559.822 * Math.cos(2 * phi) + 1.175 * Math.cos(4 * phi),
    metresPerDegLon: 111_412.84 * Math.cos(phi) - 93.5 * Math.cos(3 * phi) + 0.118 * Math.cos(5 * phi),
  };
}

export function toXY(frame: Frame, p: LngLat): XY {
  return [(p[0] - frame.origin[0]) * frame.metresPerDegLon, (p[1] - frame.origin[1]) * frame.metresPerDegLat];
}

export function toLngLat(frame: Frame, p: XY): LngLat {
  return [frame.origin[0] + p[0] / frame.metresPerDegLon, frame.origin[1] + p[1] / frame.metresPerDegLat];
}

/** Straight-line metres in the frame. Math.sqrt, not Math.hypot, which engines may round differently. */
export function distXY(a: XY, b: XY): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  return Math.sqrt(dx * dx + dy * dy);
}

export function distM(frame: Frame, a: LngLat, b: LngLat): number {
  return distXY(toXY(frame, a), toXY(frame, b));
}

/** Great-circle metres on a 6,371 km sphere: the yardstick the tests hold the frame to. */
export function haversineM(a: LngLat, b: LngLat): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b[1] - a[1]) / 2) ** 2 + Math.cos(r(a[1])) * Math.cos(r(b[1])) * Math.sin(r(b[0] - a[0]) / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

/** Running length along a polyline: element i is the metres from the first point to point i (V1 routing.ts:319-326). */
export function cumulativeDist(points: readonly XY[]): number[] {
  const out = [0];
  for (let i = 1; i < points.length; i++) out.push((out[i - 1] as number) + distXY(points[i - 1] as XY, points[i] as XY));
  return out;
}

/** Ray casting (V1 geo.ts:124-134), in the frame's metres. */
export function pointInRing(ring: readonly XY[], p: XY): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i] as XY;
    const [xj, yj] = ring[j] as XY;
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Metres from `p` to the nearest point of a ring's edges (V1 geo.ts:137-154). */
export function distToRing(ring: readonly XY[], p: XY): number {
  let best = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j] as XY;
    const b = ring[i] as XY;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
    best = Math.min(best, distXY(p, [a[0] + t * dx, a[1] + t * dy]));
  }
  return best;
}

/** Items bucketed by square cells of `cellM` metres (V1's SpatialGrid, geo.ts:69-117, in metres). */
export class SpatialGrid<T> {
  private readonly cells = new Map<number, { p: XY; item: T; order: number }[]>();
  private count = 0;

  constructor(private readonly cellM: number) {
    if (!(cellM > 0)) throw new RangeError(`cell size must be positive, got ${cellM}`);
  }

  private key(cx: number, cy: number): number {
    return (cx + 1_048_576) * 2_097_152 + (cy + 1_048_576);
  }

  add(p: XY, item: T): void {
    const k = this.key(Math.floor(p[0] / this.cellM), Math.floor(p[1] / this.cellM));
    const bucket = this.cells.get(k);
    const entry = { p, item, order: this.count++ };
    if (bucket) bucket.push(entry);
    else this.cells.set(k, [entry]);
  }

  /** Every item within `radiusM`, nearest first; equal distances in the order they were added. */
  within(p: XY, radiusM: number): { item: T; p: XY; distM: number }[] {
    const out: { item: T; p: XY; distM: number; order: number }[] = [];
    const [x0, x1] = [Math.floor((p[0] - radiusM) / this.cellM), Math.floor((p[0] + radiusM) / this.cellM)];
    const [y0, y1] = [Math.floor((p[1] - radiusM) / this.cellM), Math.floor((p[1] + radiusM) / this.cellM)];
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        for (const e of this.cells.get(this.key(cx, cy)) ?? []) {
          const d = distXY(p, e.p);
          if (d <= radiusM) out.push({ item: e.item, p: e.p, distM: d, order: e.order });
        }
      }
    }
    out.sort((a, b) => a.distM - b.distM || a.order - b.order);
    return out.map(({ item, p: q, distM: d }) => ({ item, p: q, distM: d }));
  }

  /** Calls `visit` for every item within `radiusM`, in no particular order, without allocating. */
  forEachWithin(p: XY, radiusM: number, visit: (item: T, distM: number) => void): void {
    const [x0, x1] = [Math.floor((p[0] - radiusM) / this.cellM), Math.floor((p[0] + radiusM) / this.cellM)];
    const [y0, y1] = [Math.floor((p[1] - radiusM) / this.cellM), Math.floor((p[1] + radiusM) / this.cellM)];
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const bucket = this.cells.get(this.key(cx, cy));
        if (!bucket) continue;
        for (const e of bucket) {
          const d = distXY(p, e.p);
          if (d <= radiusM) visit(e.item, d);
        }
      }
    }
  }

  nearest(p: XY, maxM: number): { item: T; p: XY; distM: number } | null {
    return this.within(p, maxM)[0] ?? null;
  }
}
