// Lines on a shared street, drawn side by side (DECISIONS, Open: many lines on the map, (a); the systems audit's seventh
// round found them drawn over one another, the later hiding the earlier). Each segment of a line's route, between two of its
// points, stands at its own place among the lines that drive that segment: in ribbon widths from the street's middle, to the
// right of the way the route runs (MapLibre's line-offset), so a line alone on its street keeps to the middle. On a segment
// k lines share, their places run left to right by each line's id times the way it drives there, +1 along the segment's
// lesser end first and -1 against it. That order holds whichever way the segment's ends are taken, so it is the same on
// every segment two lines share, and two lines that drive a street together keep their order all along it: none crosses
// another until they part. A line that drives a segment both ways, out and back, has a place each way, so its way back keeps
// its order with the lines beside it too: with one place, the first way's, it swapped sides with them where it turned back
// (the change's review: twice on the pacing run's second company, and at 18 places on a late game of 30 lines). A line
// joining or leaving moves the others half a ribbon over, at the point it does.
import type { LngLatPair } from '../../sim/types';

/** A route's ribbon at zoom 12 and at 16, in CSS pixels, and so a place's step, held beyond: overlays.ts draws lines with it. */
export const RIBBON_PX = [3, 7] as const;

/** The ribbon's width at `zoom`, as the route layer's paint has it. */
export function ribbonPx(zoom: number): number {
  const t = Math.min(1, Math.max(0, (zoom - 12) / 4));
  return RIBBON_PX[0] + (RIBBON_PX[1] - RIBBON_PX[0]) * t;
}

/** A segment's ends to 1e-7 of a degree (about a centimetre), so two lines on the same street share its key. */
const end = (p: LngLatPair) => `${Math.round(p[0] * 1e7)},${Math.round(p[1] * 1e7)}`;

/** A segment's key, the lesser end first, and whether `a` to `b` runs that way; null for a segment of no length. */
export function segmentOf(a: LngLatPair, b: LngLatPair): { key: string; along: boolean } | null {
  const [ka, kb] = [end(a), end(b)];
  if (ka === kb) return null;
  return ka < kb ? { key: `${ka} ${kb}`, along: true } : { key: `${kb} ${ka}`, along: false };
}

export interface RouteOf {
  readonly id: number;
  readonly route: readonly LngLatPair[];
}

/** Each segment's lines, in their places from the left of the segment's own way: each line's id and the way it drives there. */
export type Places = ReadonlyMap<string, readonly { readonly id: number; readonly along: boolean }[]>;

/**
 * Calls `each` with each segment of `route` that has a length: its index (from point i to i + 1), its key and whether the route
 * drives it from its lesser end, as segmentOf has them. Each point's end is worked out once: on a late game of 30 lines and 6,402
 * points, `npm run bench sides` puts the places at 3.8 ms at p50 and every line's sides at 3.2, which took 5.4 and 4.0 with each
 * end worked out twice.
 */
function eachSegment(route: readonly LngLatPair[], each: (i: number, key: string, along: boolean) => void): void {
  let a = route.length ? end(route[0]!) : '';
  for (let i = 1; i < route.length; i++) {
    const b = end(route[i]!);
    if (a !== b) each(i - 1, a < b ? `${a} ${b}` : `${b} ${a}`, a < b);
    a = b;
  }
}

/** Where each line stands on each segment of the streets its route drives. */
export function placesOf(lines: readonly RouteOf[]): Places {
  const at = new Map<string, { id: number; along: boolean }[]>();
  for (const line of lines) {
    eachSegment(line.route, (_, key, along) => {
      let here = at.get(key);
      if (!here) at.set(key, (here = []));
      // A line that drives a segment twice the same way has one place there; out and back, a place each way.
      if (!here.some((e) => e.id === line.id && e.along === along)) here.push({ id: line.id, along });
    });
  }
  // Ids from 0 are taken from 1, so a line's place differs with the way it drives (key: id + 1, signed).
  const order = (e: { id: number; along: boolean }) => (e.id + 1) * (e.along ? 1 : -1);
  for (const here of at.values()) here.sort((a, b) => order(a) - order(b));
  return at;
}

/**
 * Line `id`'s side on each segment of `route` (route.length - 1 of them): in ribbon widths from the street's middle, to the
 * right of the way the route runs, as `places` stands it. A segment of no length, or one `places` does not have the line on
 * (an earlier route of a line that changed), stands in the middle.
 */
export function sidesAlong(places: Places, id: number, route: readonly LngLatPair[]): Float32Array {
  const sides = new Float32Array(Math.max(0, route.length - 1));
  eachSegment(route, (i, key, along) => {
    const here = places.get(key);
    const k = here ? here.findIndex((e) => e.id === id && e.along === along) : -1;
    if (!here || k < 0) return;
    // Its place from the left of the segment's own way, then the side of the way this route drives it.
    const fromMiddle = k - (here.length - 1) / 2;
    const side = along ? fromMiddle : -fromMiddle;
    sides[i] = side === 0 ? 0 : side;
  });
  return sides;
}

/** How many places each segment of `route` has (route.length - 1 of them), as `places` stands the lines: 0 where no line drives it. */
export function placesAlong(places: Places, route: readonly LngLatPair[]): Float32Array {
  const counts = new Float32Array(Math.max(0, route.length - 1));
  eachSegment(route, (i, key) => void (counts[i] = places.get(key)?.length ?? 0));
  return counts;
}

/** The squared distance from `p` to the segment from `a` to `b`, all on screen. */
function toSegment(p: readonly [number, number], a: readonly [number, number], b: readonly [number, number]): number {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  const length = dx * dx + dy * dy;
  const t = length > 0 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length)) : 0;
  return (a[0] + t * dx - p[0]) ** 2 + (a[1] + t * dy - p[1]) ** 2;
}

/** The squared distance from `p` to the ribbon `px` pixels to the right of the segment from `a` to `b`, as line-offset lays it (screen, y down). */
function toRibbon(p: readonly [number, number], a: readonly [number, number], b: readonly [number, number], px: number): number {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  const length = Math.hypot(dx, dy);
  if (length === 0) return toSegment(p, a, b);
  const [rx, ry] = [(-dy / length) * px, (dx / length) * px];
  return toSegment(p, [a[0] + rx, a[1] + ry], [b[0] + rx, b[1] + ry]);
}

/** A line a click hit, and the run of its route the map drew there (runsOf's first and last segments) when it hit one. */
export interface Hit {
  readonly id: number;
  readonly first?: number | undefined;
  readonly last?: number | undefined;
}

/**
 * The lines at a click, nearest first: every line on the segment whose ribbon, among those of the runs the map hit (`hits`, or a
 * hit line's whole route for a hit on its name or a stop), lies nearest the click (`at`, on screen, where `project` puts a place,
 * `ribbon` pixels a place), each by how far its own ribbon there lies from the click, then any other line hit, by its own. Side by
 * side, the lines on a street stand wider than a click's few pixels reach, so a click on any of them takes them all in, as a
 * click took in every line drawn over another before (DECISIONS, Open: many lines on the map, (b)). Only the run's own segments:
 * the map finds a ribbon where line-offset draws it, but the nearest segment of the whole route, by the street's middle, lay in
 * the street a line turns into near a corner where it turns toward its side, and a click on its ribbon there listed it alone
 * (the change's review). By the ribbons, not the street's middle and not the map's order of the hits: listed in MapLibre's
 * order, a click in the middle of Line 2's ribbon put Line 5 first, and a click at a corner on Line 4 alone listed Lines 6 and 9
 * too, which drive the street round it and have no ribbon within 8 px (the systems audit's twenty-first round).
 */
export function linesHere(
  places: Places,
  lines: readonly RouteOf[],
  hits: readonly Hit[],
  at: readonly [number, number],
  project: (p: LngLatPair) => readonly [number, number],
  ribbon: number,
): number[] {
  // Where each line stands on a segment: its place from the street's middle, in pixels, to the right of the segment's own way.
  const pxOf = (here: readonly unknown[], k: number) => (k - (here.length - 1) / 2) * ribbon;
  const hitAt = new Map<number, number>();
  let nearest = { key: '', a: [0, 0] as readonly [number, number], b: [0, 0] as readonly [number, number], d: Infinity };
  for (const { id, first, last } of hits) {
    const route = lines.find((l) => l.id === id)?.route ?? [];
    eachSegment(route, (i, key, along) => {
      if ((first !== undefined && i < first) || (last !== undefined && i > last)) return;
      const here = places.get(key) ?? [];
      const k = here.findIndex((e) => e.id === id && e.along === along);
      // The segment as its own way runs, its lesser end first, which the places stand from.
      const [a, b] = along ? [project(route[i]!), project(route[i + 1]!)] : [project(route[i + 1]!), project(route[i]!)];
      const d = toRibbon(at, a, b, k < 0 ? 0 : pxOf(here, k));
      if (d < (hitAt.get(id) ?? Infinity)) hitAt.set(id, d);
      if (d < nearest.d) nearest = { key, a, b, d };
    });
  }
  const by = new Map<number, number>();
  const here = places.get(nearest.key) ?? [];
  here.forEach((e, k) => by.set(e.id, Math.min(by.get(e.id) ?? Infinity, toRibbon(at, nearest.a, nearest.b, pxOf(here, k)))));
  for (const [id, d] of hitAt) if (!by.has(id)) by.set(id, d);
  return [...by].sort((x, y) => x[1] - y[1]).map(([id]) => id);
}

/** A route cut where its side changes: each run's points (its ends shared with the runs either side), its side, and its first and last segments. */
export function runsOf(
  route: readonly LngLatPair[],
  sides: Float32Array,
): { readonly points: readonly LngLatPair[]; readonly side: number; readonly first: number; readonly last: number }[] {
  const runs: { points: LngLatPair[]; side: number; first: number; last: number }[] = [];
  for (let i = 1; i < route.length; i++) {
    const side = sides[i - 1] ?? 0;
    const run = runs[runs.length - 1];
    if (run && run.side === side) {
      run.points.push(route[i]!);
      run.last = i - 1;
    } else runs.push({ points: [route[i - 1]!, route[i]!], side, first: i - 1, last: i - 1 });
  }
  return runs;
}
