// A line changed while its buses are out (the M4 spec, item 4; I6): at the change's instant no bus
// moves more than 5 m, buses out never exceed buses owned, and the merged plan hands over to the
// line's own day plan with nothing moving there either. On the debug line laid straight east, for a
// headway change, a slower round trip, an extension, its first stop dropped and a model swap, each at
// random instants of the service day. Changed again within a round trip, a bus finishing a trip from
// before both carries on only where neither change moved its first stop or swapped its model. Drawn
// mid-day and changed again after it has handed over, a line still runs nothing before the draw.
import { describe, expect, it } from 'vitest';
import { SECONDS_PER_DAY } from '../config/time';
import { createRng } from '../core/rng';
import type { LngLatPair } from '../types';
import { busPositionsAt, positionsInEffect, prepareGeometry, type LineGeometry, type PreparedGeometry } from './position';
import { busesOut, dayPlan, idleLimitOf, tripTimes, type PlanInputs } from './schedule';
import { inputsAt, planInEffect, versionAt, type Earlier } from './transition';

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
function inputs(stops: readonly number[], headway: number, buses: number, slower = 1, overnight: number | null = null): PlanInputs {
  const routeM = stops[stops.length - 1]! - stops[0]!;
  const oneWayS = drive(routeM) * slower + 20 * (stops.length - 2);
  const cycle = Math.ceil(2 * oneWayS) + 2 * 120;
  return { timing: { cycle, headways: { peak: headway, offpeak: headway, overnight }, buses }, oneWayS: cycle / 2 - 120, pullOutS: drive(1_200 + stops[0]!), pullInS: drive(1_200 + stops[0]!) };
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

/** `c` made at 25 random instants of the service day: every bus where it was at the change and at the handover, never more out than owned, and handed over by `latest(at)`. */
function checkChange(c: Change, latest: (at: number) => number) {
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
    // The handover, with every bus where it was.
    expect(m.handover, label).toBeLessThanOrEqual(latest(at));
    const end = read(positionsInEffect(effect, c.geos, m.handover - 0.01, buf));
    const own = read(busPositionsAt(effect.periodic, c.geos[1], m.handover % SECONDS_PER_DAY, buf));
    expect(unmoved(end, own, south(1_200)), `${label}: handover at ${m.handover}`).toMatchObject({ ok: true });
    expect(own.length, label).toBeLessThanOrEqual(busesOut(effect.periodic));
  }
}

describe('a line changed while its buses are out (I6)', () => {
  // By the next morning's first departure at the latest.
  for (const c of CHANGES) it(`${c.name}: nothing moves at the change, never more buses out than owned, and nothing moves at the handover`, () => checkChange(c, () => SECONDS_PER_DAY + 5 * 3_600));
});

// The same changes on a line that also runs every 20 minutes overnight: its buses never wait an hour at
// the first stop, so after a longer headway the bus it no longer needs went home only when the plan ran
// out of departures, near the end of the next day, and was paid until then; the plan handed over there
// to its day plan as both wound down, which a line drawn from its middle day does not. Now a spare goes
// home after its trip, as the day plan would have it, and on the debug line the plan hands over within
// two hours. Shown failing (TS-04) on 050dbdd: every 10 minutes to every 15 handed over 1,740 to 2,444
// minutes after the change (median 1,995; 300 to 1,004 with no service overnight); now 15 to 35 minutes
// on the debug line, either way. On lines 2 to 13 km long after a longer headway (bench/parking.ts),
// a median of 50 minutes and at most 387 with no service overnight, 54 and at most 337 with it.
describe('a line running overnight changed while its buses are out (I6)', () => {
  const night = (p: PlanInputs): PlanInputs => ({ ...p, timing: { ...p.timing, headways: { ...p.timing.headways, overnight: Math.max(p.timing.headways.peak, 1_200) } } });
  for (const c of CHANGES) {
    const n: Change = { ...c, name: `${c.name}, every 20 minutes overnight`, before: night(c.before), after: night(c.after) };
    it(`${n.name}: nothing moves at the change or at the handover, within two hours, never more buses out than owned`, () => checkChange(n, (at) => at + 2 * 3_600));
  }
});

// After a cut, the bus a line parks is one its day plan has no use for, not the one free in time for the
// day plan's next pull out: that one stands in for it. Shown failing (TS-04) with parkSpares keeping
// only buses free as early as the day plan's out: a 6 km line every 5 minutes at peak and 10 off-peak,
// changed to every 15 and 20 at 06:16:29, after the 06:20 departure sent home the bus free at 06:25:42
// rather than the one free at 06:45:42, and pulled another out of the depot at 06:32:14 for the 06:35.
describe('a line with buses to spare after a cut (I1, I6)', () => {
  it('sends home no bus free in time for a departure another then pulls out of the depot for, within the hour', () => {
    const stops = [0, 900, 1_700, 2_600, 3_400, 4_300, 5_100, 6_000];
    const every = (peak: number, offpeak: number): PlanInputs => {
      const p = inputs(stops, peak, 8);
      return { ...p, timing: { ...p.timing, headways: { peak, offpeak, overnight: null } } };
    };
    const at = 6 * 3_600 + 16 * 60 + 29;
    const after = every(900, 1_200);
    const m = planInEffect(after, [{ inputs: every(300, 600), until: at, sameModel: true, sameStart: true }]).merged!;
    const parked = m.stints.filter((s) => s.trips.length > 0 && s.lastArrival >= at && s.lastArrival < m.handover);
    const pulledOut = m.stints.filter((s) => s.trips.length > 0 && s.leaveDepot >= at);
    for (const s of parked) {
      const last = s.trips[s.trips.length - 1]!;
      const free = last + tripTimes(inputsAt(m, last), last).cycle;
      const instead = pulledOut.filter((o) => o.leaveDepot > s.lastArrival && o.trips[0]! >= free && o.trips[0]! - free <= idleLimitOf(after));
      expect(instead.map((o) => o.leaveDepot), `the bus home at ${s.arriveDepot}, free at ${free}: pulled out instead at`).toEqual([]);
    }
    // And it does park its spare: one of the four out goes home, and the plan hands over within the hour.
    expect(parked).toHaveLength(1);
    expect(m.handover - at).toBeLessThan(3_600);
  });
});

describe('a line changed again within a round trip (I6)', () => {
  const KEEPS = [
    { sameModel: true, sameStart: true },
    { sameModel: true, sameStart: false },
    { sameModel: false, sameStart: true },
    { sameModel: false, sameStart: false },
  ] as const;
  const v0 = inputs(DEBUG, 600, 3);
  const v1 = inputs(DEBUG, 900, 3);
  const v2 = inputs(DEBUG, 720, 3);
  const v3 = inputs(DEBUG, 600, 4, 0.9);

  // A bus out at both changes heads home after its trip if either moved its first stop, and is back
  // in the depot for the line if neither swapped its model, so the two plan as one change. Shown
  // failing (TS-04) on 5f4bce3: a first stop moved and then the headways changed at 14:53:57, and the
  // buses the first change sent home took the second's departures from the other end.
  it('plans two changes at one instant as one change straight to the second, its first stop and model kept only if both kept them', () => {
    const rng = createRng(17);
    for (const a of KEEPS) {
      for (const b of KEEPS) {
        for (let run = 0; run < 5; run++) {
          const at = rng.int(6 * 3_600, 22 * 3_600);
          const label = `${JSON.stringify(a)} then ${JSON.stringify(b)} at ${at}`;
          const two = planInEffect(v2, [
            { inputs: v0, until: at, ...a },
            { inputs: v1, until: at, ...b },
          ]).merged!;
          const one = planInEffect(v2, [{ inputs: v0, until: at, sameModel: a.sameModel && b.sameModel, sameStart: a.sameStart && b.sameStart }]).merged!;
          expect({ trips: two.trips, stints: two.stints, handover: two.handover }, label).toEqual({ trips: one.trips, stints: one.stints, handover: one.handover });
        }
      }
    }
  });

  // A bus of the old model on its way home at the second change, or waiting at the first stop at the
  // swap and so sent home from there, was sold: the second change keeps the model it is not, and
  // finds every one of the new model's buses in the depot, as one change straight to it would. With
  // the old buses' drive home long and the new timetable needing every bus at once, a sold bus
  // counted as the line's leaves a departure no bus can make. Shown failing (TS-04) on 5f4bce3, and
  // with only the branch for a bus on its way home put back as it was there (the latest change's
  // sameModel): at 16:45:22 the 17:10 departure went unrun, a sold bus due home 30 minutes on counted
  // as the one to run it.
  it('counts no sold bus on its way home as the line’s at a second change made at the same instant', () => {
    const far = { ...v0, pullInS: 1_800 };
    const tight = inputs(DEBUG, 300, 5);
    const rng = createRng(31);
    for (let run = 0; run < 25; run++) {
      const at = rng.int(6 * 3_600, 22 * 3_600);
      const swap: Earlier = { inputs: far, until: at, sameModel: false, sameStart: true };
      const two = planInEffect(tight, [swap, { inputs: v1, until: at, sameModel: true, sameStart: true }]).merged!;
      const one = planInEffect(tight, [swap]).merged!;
      expect({ trips: two.trips, stints: two.stints, handover: two.handover }, `at ${at}`).toEqual({ trips: one.trips, stints: one.stints, handover: one.handover });
    }
  });

  // Shown failing (TS-04) on 5f4bce3: a model swap at 11:48:33 between two changes that kept it, and a
  // bus of the first version took a departure of the last.
  it('never hands a bus a departure across a change that moved its first stop or swapped its model, over three changes within a round trip', () => {
    const rng = createRng(29);
    for (let run = 0; run < 60; run++) {
      const t1 = rng.int(6 * 3_600, 22 * 3_600);
      const t2 = t1 + rng.int(0, 900);
      const t3 = t2 + rng.int(0, 900);
      const earlier: Earlier[] = [v0, v1, v2].map((inputs, k) => ({ inputs, until: [t1, t2, t3][k]!, ...KEEPS[rng.int(0, 3)]! }));
      const m = planInEffect(v3, earlier).merged!;
      for (const s of m.stints) {
        for (let i = 1; i < s.trips.length; i++) {
          const [from, to] = [versionAt(m, s.trips[i - 1]!), versionAt(m, s.trips[i]!)];
          const crossed = earlier.slice(from, to);
          expect(
            crossed.every((e) => e.sameModel && e.sameStart),
            `${JSON.stringify(earlier.map((e) => [e.until, e.sameModel, e.sameStart]))}: a bus from version ${from} takes a departure of ${to}`,
          ).toBe(true);
        }
      }
    }
  });
});

// A line drawn mid-day changes from a version that ran no bus, and keeps it through that day (world.ts),
// so a second change after it has handed over to its own day plan still finds nothing run before the
// draw: the merged plan keeps what ran past a handover, rather than starting again from the day plan.
// Shown failing (TS-04) with merge() starting again from the latest version's day plan past a handover:
// drawn at 13:13:42 and changed at 15:39:40, the plan ran the 164 departures before the draw, the day
// before's included.
describe('a line drawn, then changed again after it has handed over (I6, I1)', () => {
  it('runs nothing before the draw, and every bus out at the second change as the first left it', () => {
    const rng = createRng(37);
    const drawn = inputs(DEBUG, 600, 3);
    const none = { ...drawn, timing: { ...drawn.timing, buses: 0 } };
    for (let run = 0; run < 10; run++) {
      const t0 = rng.int(6 * 3_600, 20 * 3_600);
      const first = planInEffect(drawn, [{ inputs: none, until: t0, sameModel: true, sameStart: true }]).merged!;
      expect(first.trips.filter((t) => t < t0)).toEqual([]);
      const t1 = first.handover + rng.int(0, 2 * 3_600);
      const m = planInEffect(inputs(DEBUG, 900, 3), [
        { inputs: none, until: t0, sameModel: true, sameStart: true },
        { inputs: drawn, until: t1, sameModel: true, sameStart: true },
      ]).merged!;
      expect(m.trips.filter((t) => t < t0), `drawn at ${t0}, changed at ${t1}`).toEqual([]);
      expect(m.versions, `drawn at ${t0}, changed at ${t1}`).toHaveLength(3);
      expect(m.trips.filter((t) => t < t1)).toEqual(first.trips.filter((t) => t < t1));
      expect(m.stints.filter((st) => st.leaveDepot < t0)).toEqual([]);
    }
  });
});
