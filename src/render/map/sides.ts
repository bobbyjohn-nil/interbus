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

/**
 * Where a place lies on the ground, in the world's pixels at `zoom`, y to the south: Web Mercator over 512 px tiles, as MapLibre lays
 * its world, and as line-offset lays a ribbon, a pixel at the map's zoom. The screen tilts it; the ground does not.
 */
export function groundAt(zoom: number): (p: readonly [number, number]) => [number, number] {
  const world = 512 * 2 ** zoom;
  return (p) => [((p[0] + 180) / 360) * world, ((1 - Math.log(Math.tan(Math.PI / 4 + (p[1] * Math.PI) / 360)) / Math.PI) / 2) * world];
}

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
  const hitAt = new Map<number, number>();
  let nearest: Nearest = { key: '', a: [0, 0], b: [0, 0], d: Infinity };
  for (const { id, first, last } of hits) {
    const n = nearestSegment(places, lines.find((l) => l.id === id)?.route ?? [], { id, first, last }, at, project, ribbon);
    if (n.d < (hitAt.get(id) ?? Infinity)) hitAt.set(id, n.d);
    if (n.d < nearest.d) nearest = n;
  }
  const by = new Map<number, number>();
  const here = places.get(nearest.key) ?? [];
  here.forEach((e, k) => by.set(e.id, Math.min(by.get(e.id) ?? Infinity, toRibbon(at, nearest.a, nearest.b, pxOf(here, k, ribbon)))));
  for (const [id, d] of hitAt) if (!by.has(id)) by.set(id, d);
  return [...by].sort((x, y) => x[1] - y[1]).map(([id]) => id);
}

/** How far a click (`at`) lies from the middle of line `hit.id`'s ribbon on the run the map hit (all its route, unset), in pixels as `project` lays its places, `ribbon` pixels a place; Infinity for a line not there. */
export function ribbonDistance(places: Places, lines: readonly RouteOf[], hit: Hit, at: readonly [number, number], project: (p: LngLatPair) => readonly [number, number], ribbon: number): number {
  return Math.sqrt(nearestSegment(places, lines.find((l) => l.id === hit.id)?.route ?? [], hit, at, project, ribbon).d);
}

/** Where a line stands on a segment: its place `k` of `here` from the street's middle, in pixels, to the right of the segment's own way. */
function pxOf(here: readonly unknown[], k: number, ribbon: number): number {
  return (k - (here.length - 1) / 2) * ribbon;
}

/** A segment of a route on screen: its places' key, its ends as its own way runs, and the squared distance from a click to a ribbon on it. */
interface Nearest {
  readonly key: string;
  readonly a: readonly [number, number];
  readonly b: readonly [number, number];
  readonly d: number;
}

/** The segment of `route`, line `hit.id`'s, among the hit run's segments (all, unset), whose ribbon of that line lies nearest the click. */
function nearestSegment(places: Places, route: readonly LngLatPair[], { id, first, last }: Hit, at: readonly [number, number], project: (p: LngLatPair) => readonly [number, number], ribbon: number): Nearest {
  let nearest: Nearest = { key: '', a: [0, 0], b: [0, 0], d: Infinity };
  eachSegment(route, (i, key, along) => {
    if ((first !== undefined && i < first) || (last !== undefined && i > last)) return;
    const here = places.get(key) ?? [];
    const k = here.findIndex((e) => e.id === id && e.along === along);
    // The segment as its own way runs, its lesser end first, which the places stand from.
    const [a, b] = along ? [project(route[i]!), project(route[i + 1]!)] : [project(route[i + 1]!), project(route[i]!)];
    const d = toRibbon(at, a, b, k < 0 ? 0 : pxOf(here, k, ribbon));
    if (d < nearest.d) nearest = { key, a, b, d };
  });
  return nearest;
}

/** A run of a route at one side: its points (its ends shared with the runs either side), its side, and its first and last segments. */
export interface Run {
  readonly points: readonly LngLatPair[];
  readonly side: number;
  readonly first: number;
  readonly last: number;
}

/** The way from `a` to `b` on the ground, east and north, a unit long; null for no length. */
function wayOf(a: LngLatPair, b: LngLatPair): readonly [number, number] | null {
  const [dx, dy] = [(b[0] - a[0]) * Math.cos((a[1] * Math.PI) / 180), b[1] - a[1]];
  const length = Math.hypot(dx, dy);
  return length > 0 ? [dx / length, dy / length] : null;
}

/** Whether `route` turns back on itself at its point `i`: the segment into it and the one out of it meet at over 150°. */
export function turnsBack(route: readonly LngLatPair[], i: number): boolean {
  if (i < 1 || i + 1 >= route.length) return false;
  const [into, out] = [wayOf(route[i - 1]!, route[i]!), wayOf(route[i]!, route[i + 1]!)];
  return into !== null && out !== null && into[0] * out[0] + into[1] * out[1] < -Math.cos(Math.PI / 6);
}

/**
 * A route cut where its side changes (each run drawn at its side by line-offset, overlays.ts), and, with `atTurnBacks`, where it
 * turns back on itself off the street's middle: drawn as one run there, its two ways stood either side of the stop it turned at,
 * five ribbons apart on a late game, and MapLibre drew no hairpin between them (the systems audit's twenty-first round).
 */
export function runsOf(route: readonly LngLatPair[], sides: Float32Array, atTurnBacks = false): Run[] {
  const runs: { points: LngLatPair[]; side: number; first: number; last: number }[] = [];
  for (let i = 1; i < route.length; i++) {
    const side = sides[i - 1] ?? 0;
    const run = runs[runs.length - 1];
    if (run && run.side === side && !(atTurnBacks && side !== 0 && turnsBack(route, i - 1))) {
      run.points.push(route[i]!);
      run.last = i - 1;
    } else runs.push({ points: [route[i - 1]!, route[i]!], side, first: i - 1, last: i - 1 });
  }
  return runs;
}

/** How far a bridge reaches along a segment from its corner, in metres, at most half the segment. */
export const BRIDGE_M = 4;

/** The sides strictly between `from` and `to`, a ribbon apart from `from`: the steps a ribbon takes across, none a ribbon or less. */
function stepsBetween(from: number, to: number): number[] {
  const steps: number[] = [];
  for (let c = from + Math.sign(to - from); Math.sign(to - c) === Math.sign(to - from) && c !== to; c += Math.sign(to - from)) steps.push(c);
  return steps;
}

/**
 * The steps a ribbon takes across from the street's middle to `to`: half a place first, then a place at a time, none at `to`. A
 * whole place first from the middle needed a corner piece there, which stood beside that step and the run after it for BRIDGE_M,
 * the ribbon two and a half ribbons wide, 17.5 px across at zoom 18 where a ribbon is 7 (the 30-line late game's Line 24, the
 * systems audit's twenty-fourth round); half a place on, the run before's cap carries the ribbon onto the first step, as it does
 * along a street at a change of half a place (CAPS_CARRY).
 */
function stepsFromMiddle(to: number): number[] {
  const steps: number[] = [];
  for (let c = 0.5 * Math.sign(to); Math.abs(c) < Math.abs(to); c += Math.sign(to)) steps.push(c);
  return steps;
}

/**
 * The pieces that carry a line's ribbon from one of its runs (runsOf) to the next, each at a side of its own, so it never breaks
 * where its side changes. Each run is drawn by line-offset with round caps, which meet only where the two ends stand within a
 * ribbon of each other: where a line's side changed by more, or at a corner, the ribbon broke, gaps of up to 14 px at zoom 16 on
 * the busy scene, and where it turned back at a stop its two ways stood apart (the systems audit's twenty-first round). At a
 * corner or on along the street, a piece turns the corner at the run's side before, as the run would have, where the round caps
 * would not carry the ribbon on without it (CAPS_CARRY), then steps across at most a ribbon at a time to the side after, each piece
 * BRIDGE_M along the segment after; from the street's middle, where a corner piece would be laid, half a place first instead
 * (stepsFromMiddle). Where the line turns back, steps
 * across the street along the segment before, from its side one way to its side back: a bar at the stop it turns at.
 */
export function bridgesOf(route: readonly LngLatPair[], runs: readonly Run[]): Run[] {
  const toward = (from: LngLatPair, to: LngLatPair): LngLatPair => {
    const way = wayOf(from, to);
    const length = way ? Math.hypot((to[0] - from[0]) * Math.cos((from[1] * Math.PI) / 180), to[1] - from[1]) * 111_195 : 0;
    const t = length > 0 ? Math.min(0.5, BRIDGE_M / length) : 0;
    return [from[0] + t * (to[0] - from[0]), from[1] + t * (to[1] - from[1])];
  };
  const bridges: Run[] = [];
  for (let r = 1; r < runs.length; r++) {
    const [was, now] = [runs[r - 1]!, runs[r]!];
    const i = now.first;
    const [into, at, out] = [route[i - 1]!, route[i]!, route[i + 1]!];
    const span = { first: was.last, last: now.first };
    if (turnsBack(route, i)) {
      // Along the way in, the side back stands at its negative: across from the one to the other.
      for (const side of stepsBetween(was.side, -now.side)) bridges.push({ points: [toward(at, into), at], side, ...span });
    } else {
      let steps = stepsBetween(was.side, now.side);
      // The corner, only where the run before and the next piece, a step or the run after, would not overlap enough without it.
      let corner = capsApart(into, at, out, was.side, steps[0] ?? now.side) > CAPS_CARRY;
      // From the street's middle, half a place first instead, whose caps carry the ribbon on (stepsFromMiddle).
      if (corner && was.side === 0) {
        steps = stepsFromMiddle(now.side);
        corner = capsApart(into, at, out, 0, steps[0] ?? now.side) > CAPS_CARRY;
      }
      if (corner) bridges.push({ points: [toward(at, into), at, toward(at, out)], side: was.side, ...span });
      for (const side of steps) bridges.push({ points: [at, toward(at, out)], side, ...span });
    }
  }
  return bridges;
}

/**
 * How far apart, in ribbons, a run's end and the next piece's start may stand (capsApart) for their round caps to carry the ribbon on
 * with no corner piece: within it, the two overlap across two thirds of a ribbon at least, and along a street by half a ribbon at a
 * change of half a place. The corner piece there only widened the ribbon by half a ribbon for BRIDGE_M on along the street, 9 to 10
 * px for 4.6 m at zoom 18 where it is 7 px, at 16 to 40 points on each of the four networks `npm run bench sides` lays (the systems
 * audit's twenty-second round). A ribbon apart, the caps only touch, so where a step or a change of a whole place stands so, as along
 * a street, the ribbon still turns at the side before, alongside the next piece for BRIDGE_M; round a corner a change of a whole
 * place can stand nearer, as -0.5 to 0.5 at a right angle does, 0.71 apart, and the caps carry it. From the street's middle too:
 * there no corner piece was laid, so a line leaving the middle a whole place over met the next piece at a point, the ribbon 0.9 to
 * 1.7 px across there at zoom 16 to 18, at 8 of the four networks' 278 links that do not turn back (the twenty-third round).
 */
const CAPS_CARRY = 0.75;

/**
 * How far apart, in ribbons, a run's end at `at`, coming in from `into` at side `from`, and the next piece's start, going on to `out`
 * at side `to`, stand from each other's ribbon: the nearer of each one's middle to the other's middle line, a half-line from its own
 * end, square to its own way and a ribbon a unit. Where the line turns toward the side of the street it stands on, before the corner
 * or after it, the next piece starts over the run before's ribbon, or the run before ends over the next piece's, so the two overlap
 * whole however far apart their caps stand. Measured
 * cap to cap, a corner piece went there too and only widened the corner to two ribbons for BRIDGE_M, 14.1 px across where 8.8
 * without it at zoom 18 on the first company's Line 7, at 20 of the four networks' 278 links (the twenty-third round).
 */
function capsApart(into: LngLatPair, at: LngLatPair, out: LngLatPair, from: number, to: number): number {
  const [back, on] = [wayOf(into, at), wayOf(at, out)];
  // A segment of no length has no way to stand a piece square to, and MapLibre draws nothing for a run of one: no corner piece,
  // where one stood a 4 m stub in the street's middle (the twenty-third round's review; no route on the four networks has one).
  if (!back || !on) return 0;
  const [end, start] = [rightOf(into, at, from), rightOf(at, out, to)];
  const toLine = (p: readonly [number, number], o: readonly [number, number], d: readonly [number, number]) => {
    const t = Math.max(0, (p[0] - o[0]) * d[0] + (p[1] - o[1]) * d[1]);
    return Math.hypot(p[0] - o[0] - t * d[0], p[1] - o[1] - t * d[1]);
  };
  return Math.min(toLine(start, end, [-back[0], -back[1]]), toLine(end, start, on));
}

/** A point `side` ribbons to the right of the way from `a` to `b`, from the way's start, on the ground (east and north), a ribbon a unit. */
function rightOf(a: LngLatPair, b: LngLatPair, side: number): readonly [number, number] {
  const way = wayOf(a, b) ?? [0, 0];
  return [way[1] * side, -way[0] * side];
}

/**
 * The gaps, in ribbons, along the chain a route's drawn pieces make across each point where one of its runs ends and the next
 * starts, in the order bridgesOf lays them: from the run before's end to the first bridge's start, from each bridge's end to the
 * next one's start, and from the last to the run after's start, each end at its piece's side square to the piece's way there. A
 * step's BRIDGE_M along the way counts for nothing, as each piece lies over the next along those same metres (at zoom 18 they
 * are 2.6 ribbons long); a piece's own corner is drawn whole by its round join, up to about 120 degrees (STATUS). Where the run
 * before meets the next piece by their round caps alone, with no corner piece, their gap is how far each stands from the other's
 * ribbon (capsApart). Round caps meet where a gap is a ribbon or less, and only touch at a ribbon: alongside each other for BRIDGE_M
 * that is a step, and caps alone that touch pinch the ribbon to a point, so those stand within CAPS_CARRY (`waist.ts` measures the
 * ribbon's width there). For the tests and `npm run bench sides`.
 */
export function ribbonGaps(route: readonly LngLatPair[], runs: readonly Run[], bridges: readonly Run[]): number[][] {
  const right = rightOf;
  return runs.slice(1).map((now, r) => {
    const was = runs[r]!;
    const at = route[now.first]!;
    const own = bridges.filter((x) => x.first === was.last && x.last === now.first);
    const chain: { start: readonly [number, number]; end: readonly [number, number] }[] = [{ start: [0, 0], end: right(route[was.last]!, at, was.side) }];
    for (const b of own) {
      const n = b.points.length;
      chain.push({ start: right(b.points[0]!, b.points[1]!, b.side), end: right(b.points[n - 2]!, b.points[n - 1]!, b.side) });
    }
    chain.push({ start: right(at, route[now.first + 1]!, now.side), end: [0, 0] });
    const gaps = chain.slice(1).map((next, k) => Math.hypot(next.start[0] - chain[k]!.end[0], next.start[1] - chain[k]!.end[1]));
    // With no corner piece, the run before meets the next piece, which starts at the point on the way on, by their caps alone.
    if (!turnsBack(route, now.first) && !own.some((b) => b.points.length === 3)) gaps[0] = capsApart(route[was.last]!, at, route[now.first + 1]!, was.side, own[0]?.side ?? now.side);
    return gaps;
  });
}
