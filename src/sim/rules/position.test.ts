import { describe, expect, it } from 'vitest';
import { SECONDS_PER_DAY } from '../config/time';
import type { LngLatPair } from '../types';
import { busPositionsAt, prepareGeometry, type LineGeometry } from './position';
import { busesOut, dayPlan } from './schedule';

// The debug line laid straight east along 42.35° N: stops at 0, 1,339, 2,425 and 3,535 m, a point
// every 100 m between, its depot 1.2 km south of the first stop and the way home 1.5 km.
const LAT = 42.35;
const M_LON = 111_320 * Math.cos((LAT * Math.PI) / 180);
const east = (m: number): LngLatPair => [-71.1 + m / M_LON, LAT];
const south = (m: number): LngLatPair => [-71.1, LAT - m / 111_320];
const STOPS = [0, 1_339, 2_425, 3_535];
const marks = [...new Set([...STOPS, ...Array.from({ length: 36 }, (_, i) => i * 100)])].sort((a, b) => a - b).filter((m) => m <= 3_535);
const GEOMETRY: LineGeometry = {
  route: marks.map(east),
  stopAt: STOPS.map((m) => marks.indexOf(m)),
  stopDistM: STOPS,
  pullOut: [south(1_200), south(600), east(0)],
  pullIn: [east(0), [-71.1 - 750 / M_LON, LAT], [-71.1 - 750 / M_LON, LAT - 750 / 111_320]],
};
const KMH = 26;
const plan = dayPlan({
  timing: { cycle: 1_539, headways: { peak: 1_200, offpeak: 1_200, overnight: null }, buses: 2 },
  oneWayS: 1_539 / 2 - 240,
  pullOutS: 1_200 / (KMH / 3.6),
  pullInS: 1_500 / (KMH / 3.6),
});
const geo = prepareGeometry(GEOMETRY);
const out = new Float64Array(3 * 8);
const metres = (a: LngLatPair, b: LngLatPair) => Math.hypot((b[0] - a[0]) * M_LON, (b[1] - a[1]) * 111_320);
const at = (h: number, m = 0, s = 0) => h * 3_600 + m * 60 + s;
const positions = (second: number) => {
  const n = busPositionsAt(plan, geo, second, out);
  return Array.from({ length: n }, (_, i) => ({ at: [out[3 * i]!, out[3 * i + 1]!] as LngLatPair, bearing: out[3 * i + 2]! }));
};

describe('busPositionsAt (the M2 spec, item 6)', () => {
  it('pulls a bus out of its depot before its first departure, not mid-route at 06:00 (V3)', () => {
    expect(positions(at(4, 57))).toEqual([]);
    const [bus] = positions(at(4, 58));
    expect(bus!.at[1]).toBeLessThan(LAT); // on its way up from the depot
    expect(metres(positions(at(5))[0]!.at, east(0))).toBeLessThan(0.01);
  });

  it('runs out and back in the cycle the costs bill: at the far end after the one-way time, home after the cycle less its layover', () => {
    const [bus] = positions(at(5) + plan.inputs.oneWayS + 1);
    expect(metres(bus!.at, east(3_535))).toBeLessThan(0.01);
    expect(bus!.bearing).toBeCloseTo(270, 6); // laying over, facing back west
    const home = positions(at(5) + 1_539 - 240 - 0.5).find((b) => b.at[0] < -71.1 + 10 / M_LON);
    expect(home).toBeDefined();
    expect(home!.bearing).toBeCloseTo(270, 6);
  });

  it('dwells 20 s at each stop between the ends', () => {
    // 1,339 m at 3,535 m in 489.5 s of driving: Symphony at 185.4 s, then 20 s there.
    for (const u of [186, 195, 205]) expect(metres(positions(at(5) + u)[0]!.at, east(1_339))).toBeLessThan(0.01);
    expect(metres(positions(at(5) + 210)[0]!.at, east(1_339))).toBeGreaterThan(20);
  });

  it('drives each bus home after its last trip instead of vanishing (V3)', () => {
    const last = Math.max(...plan.stints.filter((s) => s.lastArrival < SECONDS_PER_DAY).map((s) => s.lastArrival));
    const going = positions(last + 60);
    expect(going.some((b) => b.at[0] < -71.1 - 100 / M_LON)).toBe(true);
    expect(positions(last + 1_500 / (KMH / 3.6) + 1).length).toBeLessThan(going.length);
  });

  it('never teleports: no bus moves more than its speed allows in any second of the day (M16)', () => {
    let worst = 0;
    for (const stint of plan.stints) {
      const one = { ...plan, stints: [stint] };
      let prev: LngLatPair | null = null;
      for (let t = Math.ceil(stint.leaveDepot); t < stint.arriveDepot; t++) {
        busPositionsAt(one, geo, t, out);
        const now: LngLatPair = [out[0]!, out[1]!];
        if (prev) worst = Math.max(worst, metres(prev, now));
        prev = now;
      }
    }
    // 26 km/h is 7.22 m a second.
    expect(worst).toBeGreaterThan(7);
    expect(worst).toBeLessThan(7.3);
  });

  it('draws no more buses than the plan has out, all day', () => {
    let most = 0;
    for (let t = 0; t < SECONDS_PER_DAY; t += 30) most = Math.max(most, busPositionsAt(plan, geo, t, out));
    expect(most).toBe(busesOut(plan));
    expect(positions(at(12))).toHaveLength(2);
  });
});
