// How a changed line parks the buses the change leaves spare (rules/transition.ts parkSpares; I1, I6):
// synthetic lines laid as the transition tests lay the debug line, 2 to 13 km with six stops between
// its ends and the depot 1.2 km off, every 6 to 30 minutes at peak and off-peak, and no service
// overnight or every 20 to 45 minutes, each owning the buses the rules have it own (rules/cycle.ts
// busesNeeded; a headway change never sells one), changed at a random second of the day to longer
// headways, to shorter ones, or by roadworks starting or ending (a round trip 30% slower on the same
// headways and buses). For each change, its merged plan against the line's own day plan: the day
// plan's departures from the change to the handover that the merged plan does not run; handovers that
// fall back to the window's end, two days on; buses sent home after the change and free in time for a
// departure another bus then pulls out of the depot for within the idle limit (a wasted round trip);
// how long after the change the plan hands over, and how often past the next midnight; and the merged
// plan with fewer buses out than its day plan for over an hour, a round trip or more after the change.
// Seeded and deterministic. Each run's unrun departures go to .cache/bench/parking.json, and a run
// that finds the last one's there, over the same cases, counts the departures it leaves unrun that the
// last one ran, and the other way, so running it on one tree and then another compares the two.
// `npm run bench parking`.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { SECONDS_PER_DAY } from '../src/sim/config/time';
import { createRng } from '../src/sim/core/rng';
import { busesNeeded } from '../src/sim/rules/cycle';
import { checkHeadways, sameHeadways, type Headways } from '../src/sim/rules/periods';
import { idleLimitOf, tripTimes, type PlanInputs } from '../src/sim/rules/schedule';
import { busesOutAt, planInEffect, versionAt, type MergedPlan, type PlanInEffect } from '../src/sim/rules/transition';

const KMH = 26;
const drive = (m: number) => m / (KMH / 3.6);
/** A line `routeM` long on `headways` owning `buses`, its drive `slower` times as long, as roadworks make it. */
function lay(routeM: number, headways: Headways, buses: number, slower = 1): PlanInputs {
  const oneWayS = drive(routeM) * slower + 20 * 6;
  const cycle = Math.ceil(2 * oneWayS) + 2 * 120;
  return { timing: { cycle, headways, buses }, oneWayS: cycle / 2 - 120, pullOutS: drive(1_200), pullInS: drive(1_200) };
}
const owning = (p: PlanInputs, buses: number): PlanInputs => ({ ...p, timing: { ...p.timing, buses } });
const needs = (p: PlanInputs) => busesNeeded(p.timing.cycle, p.timing.headways);

const KINDS = ['longer headways', 'shorter headways', 'roadworks start', 'roadworks end'] as const;
type Kind = (typeof KINDS)[number];
interface Case {
  readonly kind: Kind;
  readonly overnight: boolean;
  readonly before: PlanInputs;
  readonly after: PlanInputs;
  readonly at: number;
}

const rng = createRng(41);
const minutes = (lo: number, hi: number) => 60 * rng.int(lo, hi);
function headways(night: boolean): Headways {
  const offpeak = minutes(6, 30);
  return { peak: minutes(6, 30), offpeak, overnight: night ? Math.max(offpeak, minutes(20, 45)) : null };
}
const CASES: Case[] = [];
for (const kind of KINDS) {
  for (let n = 0; n < 2_500; ) {
    const routeM = rng.int(2_000, 13_000);
    const overnight = rng.int(0, 1) === 1;
    const h0 = headways(overnight);
    const at = rng.int(0, SECONDS_PER_DAY - 1);
    const spare = rng.int(0, 1);
    let before: PlanInputs;
    let after: PlanInputs;
    if (kind === 'longer headways' || kind === 'shorter headways') {
      const r = headways(overnight);
      const pick = kind === 'longer headways' ? Math.max : Math.min;
      const peak = pick(h0.peak, r.peak);
      const offpeak = pick(h0.offpeak, r.offpeak);
      const h1 = { peak, offpeak, overnight: h0.overnight === null ? null : Math.max(offpeak, pick(h0.overnight, r.overnight!)) };
      if (sameHeadways(h0, h1) || !checkHeadways(h1).ok) continue;
      before = lay(routeM, h0, 0);
      before = owning(before, needs(before) + spare);
      after = lay(routeM, h1, 0);
      after = owning(after, Math.max(before.timing.buses, needs(after)));
    } else {
      const normal = lay(routeM, h0, 0);
      const buses = needs(normal) + spare;
      const works = owning(lay(routeM, h0, 0, 1.3), buses);
      [before, after] = kind === 'roadworks start' ? [owning(normal, buses), works] : [works, owning(normal, buses)];
    }
    CASES.push({ kind, overnight, before, after, at });
    n++;
  }
}

/** Buses the merged plan sends home after the change and before the handover, each free in time for a departure another bus then pulls out of the depot for within `idleLimit` of it. */
function wasted(m: MergedPlan, at: number, idleLimit: number): number {
  const home = m.stints.filter((s) => s.trips.length > 0 && s.lastArrival >= at && s.lastArrival < m.handover);
  const out = m.stints.filter((s) => s.trips.length > 0 && s.leaveDepot >= at);
  let n = 0;
  for (const s of home) {
    const last = s.trips[s.trips.length - 1]!;
    const free = last + tripTimes(m.versions[versionAt(m, last)]!, last).cycle;
    if (out.some((o) => o.leaveDepot > s.lastArrival && o.trips[0]! >= free && o.trips[0]! - free <= idleLimit)) n++;
  }
  return n;
}

/** The longest stretch of [from, to), before the handover, with fewer buses out on the merged plan than on the day plan read on its middle day, in seconds. */
function leanest(p: PlanInEffect, from: number, to: number): number {
  if (from >= to) return 0;
  const own: PlanInEffect = { periodic: p.periodic, merged: null };
  const marks = new Set<number>([from]);
  for (const s of p.merged!.stints) for (const x of [s.leaveDepot, s.arriveDepot]) if (x > from && x < to) marks.add(x);
  for (const s of p.periodic.stints) {
    for (const x of [s.leaveDepot, s.arriveDepot]) {
      const day = ((x % SECONDS_PER_DAY) + SECONDS_PER_DAY) % SECONDS_PER_DAY;
      for (const y of [day, day + SECONDS_PER_DAY]) if (y > from && y < to) marks.add(y);
    }
  }
  const times = [...marks].sort((a, b) => a - b);
  let run = 0;
  let longest = 0;
  times.forEach((t, i) => {
    run = busesOutAt(p, t) < busesOutAt(own, t) ? run + (times[i + 1] ?? to) - t : 0;
    longest = Math.max(longest, run);
  });
  return longest;
}

interface Result {
  readonly unrun: number[];
  readonly handover: number;
  readonly wasted: number;
  readonly lean: number;
}
const t0 = performance.now();
const results: Result[] = CASES.map((c) => {
  const p = planInEffect(c.after, [{ inputs: c.before, until: c.at, sameModel: true, sameStart: true }]);
  const m = p.merged!;
  const ran = new Set(m.trips);
  const unrun = p.periodic.trips.filter((t) => t >= c.at && t < m.handover && !ran.has(t));
  const lean = leanest(p, c.at + Math.max(c.before.timing.cycle, c.after.timing.cycle), Math.min(m.handover, 2 * SECONDS_PER_DAY));
  return { unrun, handover: m.handover, wasted: wasted(m, c.at, idleLimitOf(c.after)), lean };
});
const seconds = (performance.now() - t0) / 1_000;

const q = (xs: readonly number[], p: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(p * xs.length))] ?? NaN;
const minutesOf = (s: number) => (s / 60).toFixed(0);
/** What `f` counts over `rows`, and in how many of them. */
const tally = (rows: readonly Result[], f: (r: Result) => number) => `${rows.reduce((a, r) => a + f(r), 0)} in ${rows.filter((r) => f(r) > 0).length} changes`;
console.log(`${CASES.length} changes, ${CASES.length / KINDS.length} of each kind, about half with service overnight, in ${seconds.toFixed(1)} s`);
console.log(`handovers that fall back to the window's end: ${results.filter((r) => r.handover >= 2 * SECONDS_PER_DAY).length}`);
for (const kind of KINDS) {
  const of = CASES.flatMap((c, i) => (c.kind === kind ? [{ c, r: results[i]! }] : []));
  const rows = of.map((x) => x.r);
  console.log(`${kind}:`);
  console.log(`  the day plan's departures from the change to the handover that the merged plan leaves unrun: ${tally(rows, (r) => r.unrun.length)}`);
  console.log(`  buses sent home free in time for a departure another then pulls out of the depot for: ${tally(rows, (r) => r.wasted)}`);
  for (const overnight of [false, true]) {
    const delays = of.filter((x) => x.c.overnight === overnight).map((x) => x.r.handover - x.c.at);
    console.log(`  the handover, ${overnight ? 'service overnight' : 'no service overnight'} (${delays.length}): p50 ${minutesOf(q(delays, 0.5))}, p90 ${minutesOf(q(delays, 0.9))}, max ${minutesOf(q(delays, 1))} minutes after the change`);
  }
  const late = of.filter((x) => x.r.handover > SECONDS_PER_DAY);
  console.log(`  handed over past the next midnight: ${late.length}, ${late.filter((x) => x.c.at < 22 * 3_600).length} of them changed before 22:00`);
  const lean = rows.map((r) => r.lean);
  console.log(`  fewer buses out than the day plan for over an hour, a round trip or more after the change: ${lean.filter((s) => s > 3_600).length} changes, the longest ${minutesOf(Math.max(0, ...lean))} minutes`);
}

// Against the last run's unrun departures, over the same cases.
const file = '.cache/bench/parking.json';
const key = CASES.map((c) => `${c.kind}|${c.before.timing.cycle}|${c.after.timing.cycle}|${JSON.stringify(c.before.timing.headways)}|${JSON.stringify(c.after.timing.headways)}|${c.before.timing.buses}|${c.after.timing.buses}|${c.at}`).join('\n');
const last = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as { key: string; unrun: number[][] }) : null;
if (last && last.key === key) {
  const diff = (a: readonly number[][], b: readonly number[][]) => {
    let n = 0;
    let changes = 0;
    a.forEach((xs, i) => {
      const other = new Set(b[i]);
      const k = xs.filter((t) => !other.has(t)).length;
      n += k;
      changes += Number(k > 0);
    });
    return `${n} in ${changes} changes`;
  };
  const now = results.map((r) => r.unrun);
  console.log(`against the last run: departures it ran that this one leaves unrun ${diff(now, last.unrun)}; the other way ${diff(last.unrun, now)}`);
} else console.log(`against the last run: ${last ? 'its cases differ' : 'none'}, so not compared`);
mkdirSync('.cache/bench', { recursive: true });
writeFileSync(file, JSON.stringify({ key, unrun: results.map((r) => r.unrun) }));
