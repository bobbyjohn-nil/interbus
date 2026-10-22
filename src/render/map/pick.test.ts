// The dot under the pointer (D25). Shown failing (TS-04) with no slop, where a pointer 4 px from a 1.8 px
// dot picked nothing, and with the nearest centre taken over the circle that holds the pointer.
import { describe, expect, it } from 'vitest';
import { createExpression } from '@maplibre/maplibre-gl-style-spec';
import { dotRadiusExpression, dotRadiusPx, pickDot, PICK_SLOP_PX, RING_MAX_PX, ringExpressions, ringWidthPx, type DotCandidate } from './pick';

const dot = (i: number, x: number, y: number, radiusPx: number): DotCandidate => ({ kind: 'home', i, x, y, radiusPx });

describe('the dot under the pointer', () => {
  it('finds a small dot a few pixels away', () => {
    expect(pickDot([dot(1, 100, 100, 1.8)], [104, 100])?.i).toBe(1);
  });

  it('takes the circle that holds the pointer over a smaller dot nearer its centre', () => {
    const big = dot(1, 100, 100, 25);
    const small = dot(2, 112, 100, 1);
    // 2.5 px from the small dot's edge, inside the big one.
    expect(pickDot([small, big], [115.5, 100])?.i).toBe(1);
  });

  it('takes the nearest centre when two circles hold the pointer', () => {
    expect(pickDot([dot(1, 100, 100, 20), dot(2, 110, 100, 20)], [108, 100])?.i).toBe(2);
  });

  it('picks nothing more than the slop from every dot', () => {
    expect(pickDot([dot(1, 100, 100, 2), dot(2, 140, 100, 2)], [120, 100])).toBeNull();
    expect(pickDot([dot(1, 100, 100, 2)], [100 + 2 + PICK_SLOP_PX + 0.5, 100])).toBeNull();
    expect(pickDot([], [0, 0])).toBeNull();
  });
});

describe('a dot’s radius', () => {
  it('grows with the square root of its people, from half the scale at zoom 12 to twice it at 16', () => {
    expect(dotRadiusPx(100, 12)).toBeCloseTo(0.6, 6);
    expect(dotRadiusPx(100, 16)).toBeCloseTo(2.4, 6);
    expect(dotRadiusPx(140, 14)).toBeCloseTo(1.775, 3);
    expect(dotRadiusPx(400, 14)).toBeCloseTo(2 * dotRadiusPx(100, 14), 6);
  });

  it('holds its end sizes beyond zoom 12 and 16, as MapLibre’s interpolate does', () => {
    expect(dotRadiusPx(100, 10)).toBe(dotRadiusPx(100, 12));
    expect(dotRadiusPx(100, 18)).toBe(dotRadiusPx(100, 16));
  });

  it('is the paint expression’s own numbers', () => {
    expect(dotRadiusExpression()).toEqual(['interpolate', ['linear'], ['zoom'], 12, ['*', 0.06, ['sqrt', ['get', 'w']]], 16, ['*', 0.24, ['sqrt', ['get', 'w']]]]);
  });
});

// A job's ring is drawn inside its people radius: MapLibre strokes outward from the circle's radius, so the radius is the
// people radius less the stroke. Drawn outside it, a job of 19 drew at 2.7 px for 0.65 and looked bigger than a home of 140,
// and the pick missed a ring's outer pixel (the review of shape beside colour). Shown failing (TS-04) with the stroke outside.
describe('a job’s ring', () => {
  /** What MapLibre's own evaluator makes of a paint expression for a dot of `w` at `zoom`. */
  const paint = (expression: unknown, w: number, zoom: number): number => {
    const made = createExpression(expression, 'paint.circle-radius');
    if (made.result !== 'success') throw new Error(made.value.map((e) => e.message).join('; '));
    return made.value.evaluate({ zoom }, { type: 'Point', properties: { w } } as never) as number;
  };

  it('ends at the people radius at every zoom, the radius the pick finds', () => {
    const { radius, width } = ringExpressions();
    for (const w of [1, 19, 140, 356, 4_000, 10_000])
      for (const zoom of [11, 12, 13, 14, 15.5, 16, 17]) {
        expect(paint(radius, w, zoom) + paint(width, w, zoom)).toBeCloseTo(dotRadiusPx(w, zoom), 9);
        expect(paint(width, w, zoom)).toBeCloseTo(ringWidthPx(w, zoom), 9);
      }
    // The same radius the homes paint with.
    expect(paint(dotRadiusExpression(), 140, 14)).toBeCloseTo(dotRadiusPx(140, 14), 9);
  });

  it('is half the radius wide, at most 2 px, so a big job is a ring and the smallest a dot', () => {
    expect(ringWidthPx(19, 14)).toBeCloseTo(dotRadiusPx(19, 14) / 2, 9);
    // 10,000 jobs: capped at both zoom stops, so 2 px at every zoom between, with a 13 px hole at zoom 14.
    expect(ringWidthPx(10_000, 14)).toBe(RING_MAX_PX);
    expect(dotRadiusPx(10_000, 14) - ringWidthPx(10_000, 14)).toBeGreaterThan(10);
  });
});
