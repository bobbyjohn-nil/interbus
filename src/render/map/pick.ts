// Which demand dot the pointer is on (D25: the count of people shows "only when hovering on a demand
// point"). A dot's drawn radius grows with the square root of its people and with the zoom, the same
// numbers overlays.ts paints with; the pick is the dot whose circle holds the pointer, else the nearest
// centre within a few pixels, so the smallest dots (under 2 px at the opening zoom) can be found.

export type DotKind = 'home' | 'job';

/** A dot's radius in pixels is this times √people times the zoom's factor (overlays.ts paints with it). */
export const DOT_SCALE = 0.12;
/** The zoom's factor: half the scale at zoom 12, twice it at 16, straight between, held beyond. */
const ZOOM_STOPS: readonly (readonly [zoom: number, factor: number])[] = [
  [12, 0.5],
  [16, 2],
];

/** The radius a dot of `w` people draws at `zoom`, as the paint expression computes it. */
export function dotRadiusPx(w: number, zoom: number): number {
  const [[z0, f0], [z1, f1]] = ZOOM_STOPS as [readonly [number, number], readonly [number, number]];
  const t = Math.min(1, Math.max(0, (zoom - z0) / (z1 - z0)));
  return DOT_SCALE * (f0 + (f1 - f0) * t) * Math.sqrt(w);
}

/** The paint expression for the same radius. */
export function dotRadiusExpression(): unknown {
  return ['interpolate', ['linear'], ['zoom'], ...ZOOM_STOPS.flatMap(([z, f]) => [z, ['*', DOT_SCALE * f, ['sqrt', ['get', 'w']]]])];
}

/** A job's ring at most this wide: half the dot's radius below that, so the smallest stay a dot. */
export const RING_MAX_PX = 2;

/** The width of a job's ring of `w` jobs at `zoom`: half its radius, at most RING_MAX_PX, drawn inside it. */
export function ringWidthPx(w: number, zoom: number): number {
  const [[z0, f0], [z1, f1]] = ZOOM_STOPS as [readonly [number, number], readonly [number, number]];
  const t = Math.min(1, Math.max(0, (zoom - z0) / (z1 - z0)));
  const at = (f: number) => Math.min(RING_MAX_PX, (DOT_SCALE * f * Math.sqrt(w)) / 2);
  return at(f0) + (at(f1) - at(f0)) * t;
}

/**
 * A job's ring as MapLibre paints it: the stroke is drawn outward from the circle's radius, so the radius is the people
 * radius less the stroke, and the ring's outer edge is the radius the pick finds (the review of shape beside colour: drawn
 * outside it, a job of 19 drew at 2.7 px for 0.65, larger than a home of 140, and the pick missed a ring's outer pixel).
 * Both are straight between the same zoom stops, so their sum is dotRadiusPx at every zoom.
 */
export function ringExpressions(): { radius: unknown; width: unknown } {
  const width = (f: number) => ['min', RING_MAX_PX, ['/', ['*', DOT_SCALE * f, ['sqrt', ['get', 'w']]], 2]];
  return {
    width: ['interpolate', ['linear'], ['zoom'], ...ZOOM_STOPS.flatMap(([z, f]) => [z, width(f)])],
    radius: ['interpolate', ['linear'], ['zoom'], ...ZOOM_STOPS.flatMap(([z, f]) => [z, ['-', ['*', DOT_SCALE * f, ['sqrt', ['get', 'w']]], width(f)]])],
  };
}

/** How far outside a dot's circle the pointer may be and still pick it. */
export const PICK_SLOP_PX = 6;

export interface DotCandidate {
  readonly kind: DotKind;
  /** Its place in its kind's list (Dots.homes or Dots.jobs). */
  readonly i: number;
  /** On screen, in pixels. */
  readonly x: number;
  readonly y: number;
  readonly radiusPx: number;
}

/**
 * The dot under `point`: of those whose circle holds it, the one whose centre is nearest; else the dot
 * whose edge is nearest within `slopPx`; else null.
 */
export function pickDot<T extends DotCandidate>(candidates: readonly T[], [px, py]: readonly [number, number], slopPx = PICK_SLOP_PX): T | null {
  let inside: T | null = null;
  let insideD = Infinity;
  let near: T | null = null;
  let nearGap = Infinity;
  for (const c of candidates) {
    const d = Math.hypot(c.x - px, c.y - py);
    if (d <= c.radiusPx) {
      if (d < insideD) [inside, insideD] = [c, d];
    } else if (d - c.radiusPx <= slopPx && d - c.radiusPx < nearGap) [near, nearGap] = [c, d - c.radiusPx];
  }
  return inside ?? near;
}
