import { describe, expect, it } from 'vitest';
import { createRng } from './rng';
import { cumulativeDist, distM, distToRing, frameFor, haversineM, pointInRing, SpatialGrid, toLngLat, toXY, type LngLat, type XY } from './geo';

// Inner Boston (D11) and its centre.
const SW: LngLat = [-71.16, 42.315];
const frame = frameFor(SW, 42.36);

describe('the city frame', () => {
  it("matches the WGS 84 ellipsoid's metres per degree at Boston to within a metre", () => {
    // Radii of curvature on WGS 84 (a = 6,378,137 m, f = 1/298.257223563): meridian M, prime vertical N.
    const a = 6_378_137;
    const e2 = (1 / 298.257223563) * (2 - 1 / 298.257223563);
    const phi = (42.36 * Math.PI) / 180;
    const w = 1 - e2 * Math.sin(phi) ** 2;
    const perDegLat = ((a * (1 - e2)) / w ** 1.5) * (Math.PI / 180);
    const perDegLon = (a / Math.sqrt(w)) * Math.cos(phi) * (Math.PI / 180);
    // V1 used 110,540 m per degree of latitude, the equator's: 0.49% short here.
    expect(Math.abs(frame.metresPerDegLat - perDegLat)).toBeLessThan(1);
    expect(Math.abs(frame.metresPerDegLon - perDegLon)).toBeLessThan(1);
  });

  it('measures Inner Boston within 0.3% of the great circle, every direction', () => {
    // A sanity check only: at 42°N a 6,371 km sphere is itself 0.1% long north–south and 0.27%
    // short east–west against the ellipsoid, which the test above holds the frame to.
    const cases: [LngLat, LngLat][] = [
      [[-71.07, 42.315], [-71.07, 42.405]], // 10 km north–south
      [[-71.16, 42.36], [-70.98, 42.36]], // 14.8 km east–west
      [[-71.11, 42.335], [-71.07, 42.36]], // the fixture's diagonal
      [[-71.16, 42.315], [-70.98, 42.405]], // corner to corner
    ];
    for (const [a, b] of cases) {
      const err = distM(frame, a, b) / haversineM(a, b) - 1;
      expect(Math.abs(err), `${a} → ${b}: ${(err * 100).toFixed(3)}%`).toBeLessThan(0.003);
    }
  });

  it('round-trips between degrees and metres', () => {
    const p: LngLat = [-71.0857, 42.3424];
    const back = toLngLat(frame, toXY(frame, p));
    expect(back[0]).toBeCloseTo(p[0], 12);
    expect(back[1]).toBeCloseTo(p[1], 12);
    expect(toXY(frame, SW)).toEqual([0, 0]);
  });
});

describe('spatial grid (V1, in metres)', () => {
  it('finds exactly what a brute-force scan finds, nearest first', () => {
    const rng = createRng(5);
    const grid = new SpatialGrid<number>(350);
    const points: XY[] = Array.from({ length: 2000 }, () => [rng.range(0, 5000), rng.range(0, 4000)] as XY);
    points.forEach((p, i) => grid.add(p, i));
    for (let q = 0; q < 50; q++) {
      const at: XY = [rng.range(-200, 5200), rng.range(-200, 4200)];
      const radius = rng.range(50, 900);
      const brute = points
        .map((p, i) => ({ i, d: Math.sqrt((p[0] - at[0]) ** 2 + (p[1] - at[1]) ** 2) }))
        .filter((e) => e.d <= radius)
        .sort((a, b) => a.d - b.d || a.i - b.i)
        .map((e) => e.i);
      expect(grid.within(at, radius).map((e) => e.item)).toEqual(brute);
    }
    expect(grid.nearest([0, 0], 0.001)).toBeNull();
  });
});

describe('rings and polylines', () => {
  const concave: XY[] = [[0, 0], [100, 0], [100, 100], [50, 40], [0, 100]];
  it('tells inside from outside on a concave ring', () => {
    expect(pointInRing(concave, [20, 20])).toBe(true);
    expect(pointInRing(concave, [50, 80])).toBe(false); // in the notch
    expect(pointInRing(concave, [150, 50])).toBe(false);
  });

  it('measures to the nearest edge, clamped to its ends', () => {
    const square: XY[] = [[0, 0], [10, 0], [10, 10], [0, 10]];
    expect(distToRing(square, [5, -3])).toBeCloseTo(3, 12);
    expect(distToRing(square, [13, 14])).toBeCloseTo(5, 12); // past a corner: to the corner
  });

  it('accumulates length along a polyline', () => {
    expect(cumulativeDist([[0, 0], [3, 4], [3, 10]])).toEqual([0, 5, 11]);
  });
});
