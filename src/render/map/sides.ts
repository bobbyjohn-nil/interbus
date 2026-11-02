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

/** The squared distance from `p` to the segment from `a` to `b`, all on screen. */
function toSegment(p: readonly [number, number], a: readonly [number, number], b: readonly [number, number]): number {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  const length = dx * dx + dy * dy;
  const t = length > 0 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length)) : 0;
  return (a[0] + t * dx - p[0]) ** 2 + (a[1] + t * dy - p[1]) ** 2;
}

/** A line a click hit, and the run of its route the map drew there (runsOf's first and last segments) when it hit one. */
export interface Hit {
  readonly id: number;
  readonly first?: number | undefined;
  readonly last?: number | undefined;
}

/**
 * The lines beside those a click hit: every line on the segment nearest the click (`at`, on screen, where `project` puts a place)
 * of each hit line's run, or of its whole route for a hit on its name or a stop, in their places from the left of that segment's
 * own way. Side by side, the lines on a street stand wider than a click's few pixels reach, so a click on any of them takes them
 * all in, as a click took in every line drawn over another before (DECISIONS, Open: many lines on the map, (b)). Only the run's
 * own segments: the map finds a ribbon where line-offset draws it, but the nearest segment of the whole route, by the street's
 * middle, lay in the street a line turns into near a corner where it turns toward its side, and a click on its ribbon there
 * listed it alone (the change's review).
 */
export function linesBeside(
  places: Places,
  lines: readonly RouteOf[],
  hits: readonly Hit[],
  at: readonly [number, number],
  project: (p: LngLatPair) => readonly [number, number],
): number[] {
  const beside = new Set<number>();
  for (const { id, first, last } of hits) {
    const route = lines.find((l) => l.id === id)?.route ?? [];
    const nearest = { key: '', d: Infinity };
    eachSegment(route, (i, key) => {
      if ((first !== undefined && i < first) || (last !== undefined && i > last)) return;
      const d = toSegment(at, project(route[i]!), project(route[i + 1]!));
      if (d < nearest.d) Object.assign(nearest, { key, d });
    });
    for (const e of places.get(nearest.key) ?? []) beside.add(e.id);
  }
  return [...beside];
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
