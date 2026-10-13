// A line changed while its buses are out (the M4 spec, item 4; I6): at the change's instant no bus
// moves more than 5 m, buses out never exceed buses owned, and the merged plan hands over to the
// line's own day plan with nothing moving there either. On the debug line laid straight east, for a
// headway change, a slower round trip, an extension, its first stop dropped and a model swap, each at
// random instants of the service day.
import { describe, expect, it } from 'vitest';
import { SECONDS_PER_DAY } from '../config/time';
import { createRng } from '../core/rng';
import type { LngLatPair } from '../types';
import { busPositionsAt, positionsInEffect, prepareGeometry, type LineGeometry, type PreparedGeometry } from './position';
import { busesOut, dayPlan, type PlanInputs } from './schedule';
import { planInEffect, type Earlier } from './transition';

const LAT = 42.35;
const M_LON = 111_320 * Math.cos((LAT * Math.PI) / 180);
const east = (m: number): LngLatPair => [-71.1 + m / M_LON, LAT];
const south = (m: number): LngLatPair => [-71.1, LAT - m / 111_320];
const metres = (a: LngLatPair, b: LngLatPair) => Math.hypot((b[0] - a[0]) * M_LON, (b[1] - a[1]) * 111_320);

/** The line from `from` to `to` metres east with stops at `stops`, its depot 1.2 km south of the origin. */
function geometry(stops: readonly number[]): PreparedGeometry {
  const [from, to] = [stops[0]!, stops[stops.length - 1]!];
  const marks = [...new Set([...stops, ...Array.from({ length: 80 }, (_, i) => i * 100)])].sort((a, b) => a - b).filter((m) => m >= from && m <= to);
  const g: LineGeometry = {
    route: marks.map(east),
    stopAt: stops.map((m) => marks.indexOf(m)),
    stopDistM: stops.map((m) => m - from),
    pullOut: [south(1_200), east(0), ...(from > 0 ? [east(from)] : [])],
    pullIn: [...(from > 0 ? [east(from)] : []), east(0), south(1_200)],
  };
  return prepareGeometry(g);
}

const KMH = 26;
const drive = (m: number) => m / (KMH / 3.6);
function inputs(stops: readonly number[], headway: number, buses: number, slower = 1): PlanInputs {
  const routeM = stops[stops.length - 1]! - stops[0]!;
  const oneWayS = drive(routeM) * slower + 20 * (stops.length - 2);
  const cycle = Math.ceil(2 * oneWayS) + 2 * 120;
  return { timing: { cycle, headways: { peak: headway, offpeak: headway, overnight: null }, buses }, oneWayS: cycle / 2 - 120, pullOutS: drive(1_200 + stops[0]!), pullInS: drive(1_200 + stops[0]!) };
}

const DEBUG = [0, 1_339, 2_425, 3_535];
interface Change {
  readonly name: string;
  readonly before: PlanInputs;
  readonly after: PlanInputs;
  readonly geos: readonly [PreparedGeometry, PreparedGeometry];
  readonly sameModel: boolean;
  readonly sameStart: boolean;
}
const CHANGES: Change[] = [
  { name: 'every 10 min to every 15', before: inputs(DEBUG, 600, 3), after: inputs(DEBUG, 900, 3), geos: [geometry(DEBUG), geometry(DEBUG)], sameModel: true, sameStart: true },
  { name: 'every 10 min to every 5', before: inputs(DEBUG, 600, 3), after: inputs(DEBUG, 300, 6), geos: [geometry(DEBUG), geometry(DEBUG)], sameModel: true, sameStart: true },
  { name: 'roadworks: a slower round trip', before: inputs(DEBUG, 600, 3), after: inputs(DEBUG, 600, 3, 1.04), geos: [geometry(DEBUG), geometry(DEBUG)], sameModel: true, sameStart: true },
  { name: 'extended beyond the last stop', before: inputs(DEBUG, 600, 3), after: inputs([...DEBUG, 4_800], 600, 4), geos: [geometry(DEBUG), geometry([...DEBUG, 4_800])], sameModel: true, sameStart: true },
  { name: 'its first stop taken off', before: inputs(DEBUG, 600, 3), after: inputs(DEBUG.slice(1), 600, 3), geos: [geometry(DEBUG), geometry(DEBUG.slice(1))], sameModel: true, sameStart: false },
  { name: 'swapped to a faster model', before: inputs(DEBUG, 600, 3), after: inputs(DEBUG, 600, 2, 0.8), geos: [geometry(DEBUG), geometry(DEBUG)], sameModel: false, sameStart: true },
];

const buf = new Float64Array(3 * 64);
const read = (n: number): LngLatPair[] => Array.from({ length: n }, (_, i) => [buf[3 * i]!, buf[3 * i + 1]!]);

/** Each of `from` within 5 m of a different one of `to`; whatever of `to` is left over is a bus just leaving its depot. */
function unmoved(from: readonly LngLatPair[], to: readonly LngLatPair[], depot: LngLatPair): { worst: number; ok: boolean } {
  const left = [...to];
  let worst = 0;
  for (const p of from) {
    let k = -1;
    for (let i = 0; i < left.length; i++) if (k < 0 || metres(p, left[i]!) < metres(p, left[k]!)) k = i;
    if (k < 0) return { worst: Infinity, ok: false };
    worst = Math.max(worst, metres(p, left[k]!));
    left.splice(k, 1);
  }
  return { worst, ok: worst <= 5 && left.every((q) => metres(q, depot) <= 5) };
}

describe('a line changed while its buses are out (I6)', () => {
  for (const c of CHANGES) {
    it(`${c.name}: nothing moves at the change, never more buses out than owned, and nothing moves at the handover`, () => {
      const rng = createRng(17);
      const was = dayPlan(c.before);
      for (let run = 0; run < 25; run++) {
        const at = rng.int(6 * 3_600, 22 * 3_600);
        const earlier: Earlier[] = [{ inputs: c.before, until: at, sameModel: c.sameModel, sameStart: c.sameStart }];
        const effect = planInEffect(c.after, earlier);
        const m = effect.merged!;
        const label = `${c.name} at ${at}`;
        // The instant: every bus where it was.
        const before = read(busPositionsAt(was, c.geos[0], at, buf));
        const after = read(positionsInEffect(effect, c.geos, at, buf));
        expect(unmoved(before, after, south(1_200)), label).toMatchObject({ ok: true });
        // Never more buses out than owned: the new model's own, with a swap's old ones finishing their trips beside them.
        for (let t = at; t < Math.min(m.handover, at + 4 * 3_600); t += 20) {
          const out = m.stints.filter((s) => t >= s.leaveDepot && t < s.arriveDepot);
          const mine = c.sameModel ? out : out.filter((s) => s.leaveDepot >= at);
          expect(mine.length, `${label}, ${t}`).toBeLessThanOrEqual(c.after.timing.buses);
        }
        // The handover: by the next morning's first departure at the latest, with every bus where it was.
        expect(m.handover, label).toBeLessThanOrEqual(SECONDS_PER_DAY + 5 * 3_600);
        const end = read(positionsInEffect(effect, c.geos, m.handover - 0.01, buf));
        const own = read(busPositionsAt(effect.periodic, c.geos[1], m.handover % SECONDS_PER_DAY, buf));
        expect(unmoved(end, own, south(1_200)), `${label}: handover at ${m.handover}`).toMatchObject({ ok: true });
        expect(own.length, label).toBeLessThanOrEqual(busesOut(effect.periodic));
      }
    });
  }
});
