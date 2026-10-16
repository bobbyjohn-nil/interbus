// A line changed again and again through a day keeps every version it ran until the close (world.ts
// recomputeInService), and every recompute in service builds its plan in effect from all of them
// (rules/transition.ts planInEffect), as the map's Fleet does again on the page: folded afresh each
// time, a merge a version, a line changed every 10 minutes cost hundreds of milliseconds a change by
// the evening on Inner Boston (the systems audit's sixth round; `npm run bench versions`). Each merge
// reads the idle limit of the version it merges to once, so those reads count the merges. The plans
// kept from one fold to the next must be exactly the plain fold's, over chains of changes of every
// kind, a frame's day moving under them, and a handover found as the plain comparison of every bus's
// words found it.
import { describe, expect, it, vi } from 'vitest';
import { addDebugLine } from './commands/debugLine';
import { setHeadways } from './commands/setHeadways';
import { SECONDS_PER_DAY } from './config/time';
import type { LineId } from './core/ids';
import { createRng, type Rng } from './core/rng';
import type * as Schedule from './rules/schedule';
import type * as Transition from './rules/transition';
import { dayPlan, idleLimitOf, type DayPlan, type PlanInputs, type Stint } from './rules/schedule';
import { inputsAt, planInEffect, settledOnto, versionAt, type Earlier, type MergedPlan } from './rules/transition';
import { advance } from './step';
import { gameWithDepot } from './testing';

vi.mock('./rules/schedule', async (original) => {
  const actual = await original<typeof Schedule>();
  return { ...actual, idleLimitOf: vi.fn(actual.idleLimitOf) };
});

describe('a line changed every 10 minutes through a day (I14)', () => {
  // Shown failing (TS-04) on c3c2d9a: 3,600 merges for 60 changes, the 60th 119 of them, two folds of every version kept.
  it('merges a few times a change, however many versions it keeps', () => {
    const world = gameWithDepot();
    const added = addDebugLine(world);
    if (!added.ok) throw new Error(added.reason);
    const merges = vi.mocked(idleLimitOf);
    const each: number[] = [];
    for (let k = 0; k < 60; k++) {
      advance(world, 600);
      const before = merges.mock.calls.length;
      const done = setHeadways(world, added.lineId as LineId, { peak: 1_200, offpeak: k % 2 ? 1_200 : 1_500, overnight: null });
      expect(done.ok).toBe(true);
      each.push(merges.mock.calls.length - before);
    }
    expect(world.state.lines[0]!.earlier).toHaveLength(60);
    expect(each.reduce((a, b) => a + b, 0), `merges by change: ${each.join(' ')}`).toBeLessThanOrEqual(3 * 60);
    expect(Math.max(...each), `merges by change: ${each.join(' ')}`).toBeLessThanOrEqual(3);
  }, 60_000);
});

const KMH = 26;
const drive = (m: number) => m / (KMH / 3.6);
const DEBUG = [0, 1_339, 2_425, 3_535];
/** A line on stops `stops` metres along, every `headway` by day and `overnight` by night, owning `buses`, its drive `slower` times as long, its depot 1.2 km off. */
function inputs(stops: readonly number[], headway: number, overnight: number | null, buses: number, slower: number): PlanInputs {
  const routeM = stops[stops.length - 1]! - stops[0]!;
  const oneWayS = drive(routeM) * slower + 20 * (stops.length - 2);
  const cycle = Math.ceil(2 * oneWayS) + 2 * 120;
  return { timing: { cycle, headways: { peak: headway, offpeak: headway, overnight }, buses }, oneWayS: cycle / 2 - 120, pullOutS: drive(1_200 + stops[0]!), pullInS: drive(1_200 + stops[0]!) };
}

interface Change {
  readonly inputs: PlanInputs;
  /** Game seconds since the first day's midnight. */
  readonly at: number;
  readonly sameModel: boolean;
  readonly sameStart: boolean;
}

/**
 * A line drawn at a random second of the first day (its version before that ran no bus) and changed
 * `count` times, 0 seconds to 40 minutes apart, so it runs on into the next day: its headways, a stop
 * taken off its far end or put back, its first stop taken off or put back, roadworks starting or
 * ending, its model swapped (a faster or slower bus), by turns as `rng` has them. Each version and the
 * game second it gave way to the next.
 */
function chain(rng: Rng, count: number): { readonly versions: PlanInputs[]; readonly changes: Change[] } {
  let [stops, headway, overnight, slower, works] = [DEBUG, 600, rng.pick([null, 1_800]), 1, 1];
  const lay = (buses: number) => {
    const plan = inputs(stops, headway, overnight, buses, slower * works);
    return inputs(stops, headway, overnight, Math.max(buses, Math.ceil(plan.timing.cycle / Math.min(headway, overnight ?? headway))), slower * works);
  };
  const first = lay(1);
  const versions = [{ ...first, timing: { ...first.timing, buses: 0 } }, first];
  const changes: Change[] = [];
  let at = rng.int(6 * 3_600, 20 * 3_600);
  changes.push({ inputs: versions[0]!, at, sameModel: true, sameStart: true });
  for (let k = 1; k < count; k++) {
    at += rng.pick([0, rng.int(1, 600), rng.int(600, 2_400)]);
    const was = versions[versions.length - 1]!;
    let [sameModel, sameStart] = [true, true];
    const kind = rng.pick(['headways', 'headways', 'far end', 'first stop', 'roadworks', 'model'] as const);
    if (kind === 'headways') [headway, overnight] = [rng.pick([300, 420, 600, 900, 1_200]), rng.pick([null, 1_800, 2_700])];
    else if (kind === 'far end') stops = stops[stops.length - 1] === 4_800 ? stops.slice(0, -1) : [...stops, 4_800];
    else if (kind === 'first stop') [stops, sameStart] = [stops[0] === 0 ? stops.slice(1) : [0, ...stops], false];
    else if (kind === 'roadworks') works = works === 1 ? 1.04 : 1;
    else [slower, sameModel] = [rng.pick([0.8, 1, 1.15].filter((s) => s !== slower)), false];
    changes.push({ inputs: was, at, sameModel, sameStart });
    versions.push(lay(sameModel ? was.timing.buses : 1));
  }
  return { versions, changes };
}

/** The line after its first `k` changes: its own inputs, and its earlier versions in the frame of the day of the latest (world.ts settlingOf). */
function after(c: ReturnType<typeof chain>, k: number): { readonly current: PlanInputs; readonly earlier: Earlier[] } {
  const frameDay = Math.floor(c.changes[k - 1]!.at / SECONDS_PER_DAY);
  return { current: c.versions[k]!, earlier: c.changes.slice(0, k).map((e) => ({ inputs: e.inputs, until: e.at - frameDay * SECONDS_PER_DAY, sameModel: e.sameModel, sameStart: e.sameStart })) };
}

/** The handover as c3c2d9a found it, every stint's words written out at each moment and sorted, to hold the counted words to it. */
function handoverAsWritten(m: MergedPlan, own: DayPlan, at: number): number {
  const last = m.breaks.length;
  const sign = (s: Stint, x: number, merged: boolean): string | null => {
    if (s.arriveDepot <= x) return null;
    if (s.leaveDepot >= x) return `${s.leaveDepot}|${s.trips.join(',')}|${s.lastArrival}|${s.arriveDepot}`;
    const pulling = s.leaveDepot + (merged ? inputsAt(m, s.leaveDepot) : own.inputs).pullOutS > x ? String(s.leaveDepot) : '-';
    let under = '-';
    for (const t of s.trips) if (t <= x) under = String(t);
    if (merged && under !== '-' && versionAt(m, Number(under)) < last) return 'earlier';
    if (merged && pulling !== '-' && versionAt(m, s.leaveDepot) < last) return 'earlier';
    const home = s.lastArrival <= x && merged && versionAt(m, s.trips[s.trips.length - 1] ?? s.leaveDepot) < last ? 'earlier' : '';
    return `${pulling}|${under}|${s.trips.filter((t) => t > x).join(',')}|${s.lastArrival}|${s.arriveDepot}${home}`;
  };
  const signs = (stints: readonly Stint[], x: number, merged: boolean) =>
    stints
      .map((s) => sign(s, x, merged))
      .filter((v): v is string => v !== null)
      .sort();
  const candidates = [...new Set([at, ...own.trips.filter((t) => t > at), ...own.stints.map((s) => Math.floor(s.leaveDepot)).filter((t) => t > at)])].sort((a, b) => a - b);
  for (const x of candidates) {
    const a = signs(m.stints, x, true);
    if (a.some((v) => v.startsWith('earlier') || v.endsWith('earlier'))) continue;
    const b = signs(own.stints, x, false);
    if (a.length === b.length && a.every((v, i) => v === b[i])) return x;
  }
  return 2 * SECONDS_PER_DAY;
}

/** The rules as a fresh module, nothing folded before: the plain fold. */
async function plain(): Promise<typeof Transition> {
  vi.resetModules();
  return import('./rules/transition');
}

describe('the plans kept from one fold to the next', () => {
  // Each change as the worker makes it (world.ts recomputeInService): the line's old versions with its new
  // inputs, then with the version it ran on added; now and then the close's settledOnto, an undo putting
  // the line back before the change and the change made again, or another change made in its place.
  it('are exactly the plain fold’s, over chains of 1 to 150 changes of every kind, across a change of the frame’s day', async () => {
    const SAMPLE = new Set([1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 150]);
    let crossed = 0;
    for (const seed of [3, 11, 19, 27]) {
      const rng = createRng(seed);
      const c = chain(rng, 150);
      for (let k = 1; k <= 150; k++) {
        const now = after(c, k);
        const label = `seed ${seed}, change ${k}`;
        if (k > 1) {
          const was = after(c, k - 1);
          planInEffect(now.current, was.earlier);
          if (rng.int(0, 9) === 0) expect(JSON.stringify(planInEffect(was.current, was.earlier)), `${label}: undone`).toBe(JSON.stringify((await plain()).planInEffect(was.current, was.earlier)));
        }
        // Or undone and another change made in its place, unlike it in one thing.
        if (rng.int(0, 9) === 0) {
          const e = now.earlier[k - 1]!;
          const other = [
            { ...e, sameStart: !e.sameStart },
            { ...e, sameModel: !e.sameModel },
            { ...e, until: e.until + 1 },
            { ...e, inputs: { ...e.inputs, pullInS: e.inputs.pullInS + 1 } },
          ][rng.int(0, 3)]!;
          const earlier = [...now.earlier.slice(0, -1), other];
          expect(JSON.stringify(planInEffect(now.current, earlier)), `${label}: another change`).toBe(JSON.stringify((await plain()).planInEffect(now.current, earlier)));
        }
        const got = planInEffect(now.current, now.earlier);
        const onto = rng.int(0, 4) === 0 ? settledOnto(now.earlier) : null;
        const m = got.merged!;
        expect(m.handover, label).toBe(handoverAsWritten(m, dayPlan(now.current), m.breaks[m.breaks.length - 1]!));
        const shifted = k > 1 && Math.floor(c.changes[k - 1]!.at / SECONDS_PER_DAY) !== Math.floor(c.changes[k - 2]!.at / SECONDS_PER_DAY);
        if (shifted) crossed++;
        if (!SAMPLE.has(k) && !shifted) continue;
        expect(JSON.stringify(got), label).toBe(JSON.stringify((await plain()).planInEffect(now.current, now.earlier)));
        expect(onto ?? settledOnto(now.earlier), label).toBe((await plain()).settledOnto(now.earlier));
      }
    }
    expect(crossed).toBeGreaterThan(0);
  }, 120_000);
});
