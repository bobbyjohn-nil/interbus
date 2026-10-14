// The dot under the pointer (D25). Shown failing (TS-04) with no slop, where a pointer 4 px from a 1.8 px
// dot picked nothing, and with the nearest centre taken over the circle that holds the pointer.
import { describe, expect, it } from 'vitest';
import { dotRadiusExpression, dotRadiusPx, pickDot, PICK_SLOP_PX, type DotCandidate } from './pick';

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
