// A line that changes while its buses are out (the M4 spec, item 4; I6): a route edit, a headway, a
// model swap or roadworks starting. V2 kept the old and new timelines side by side and stepped them
// in sync (its epoch, `Intralines_City_dep@archive/intralines-city-v1:Gaming/docs/design/
// route-editing.md:1-92`), and still threw buses 3,117 m on a reorder (K32, RN-11). Here there is one
// timeline: every trip that left before the change finishes on the version it began with, its route
// and its times, and the departures from the change on are the new version's, each taken by the bus
// free longest at the first stop, or by one from the depot that can reach it in time, never more
// than the line owns (a departure no bus can make is not run). A bus whose next version starts from
// another first stop, or is another model, goes home after its trip instead, and stays so through any
// change made before it is home: it carries on only if every change since its trip kept both. A change
// made with none of the line's buses out is merged the same way, and a line just drawn changes from a
// version that ran no bus, so their buses pull out of the depot for the departures they can reach, as
// each morning's do, rather than appear on the line. A bus out beyond those the day plan has out goes
// home after its trip, as the day plan would park it, so a line with spare buses pays no driver for
// them, overnight service or not. The plan hands over to the line's own day plan at the first
// departure where both have the same buses doing the same things, so nothing moves at the handover
// either; with no service overnight that is the next morning's first departure at the latest.
//
// Times are seconds from the midnight of the frame's day, as in a day plan; the frame is the day of
// the latest change, and a plan holds departures from the day before it to the day after.
import { SECONDS_PER_DAY } from '../config/time';
import { closeStint, dayPlan, freeLongest, idleLimitOf, sendHomeIdle, takeDeparture, tripTimes, type DayPlan, type OpenBus, type PlanInputs, type Stint } from './schedule';

/** An earlier version of a changed line: what it ran on, and the instant from which the next version took its departures. */
export interface Earlier {
  readonly inputs: PlanInputs;
  /** Seconds of the frame: its last departure left before this. */
  readonly until: number;
  /** Its buses are the next version's model, so one back in the depot serves the next version too. */
  readonly sameModel: boolean;
  /** And they start from the same first stop, so one finishing a trip carries straight on. */
  readonly sameStart: boolean;
}

/** A changed line's plan until it hands over to its own day plan. */
export interface MergedPlan {
  /** Every version's plan inputs, oldest first; the last is the line's own. */
  readonly versions: readonly PlanInputs[];
  /** versions[k] took the departures before breaks[k]. */
  readonly breaks: readonly number[];
  /** Whether a bus of versions[k] is the line's model now, every change since having kept it, so one home serves the line. */
  readonly sameModel: readonly boolean[];
  /** And starts from its first stop now, every change since having kept that too, so one finishing a trip of versions[k] carries on. */
  readonly carriesOn: readonly boolean[];
  /** Every departure run, in order. */
  readonly trips: readonly number[];
  /** Each bus's stint; one still out at the handover never heads home here (its lastArrival is Infinity), since the day plan carries it on. */
  readonly stints: readonly Stint[];
  /** From this second of the frame the line's own day plan holds. */
  readonly handover: number;
}

/** A line's plan in effect: its own day plan, and while it settles after a change, the merged plan before the handover. */
export interface PlanInEffect {
  readonly periodic: DayPlan;
  readonly merged: MergedPlan | null;
}

/** The version a departure (or a bus leaving its depot) at `t` ran on: an index into `versions`. */
export function versionAt(m: Pick<MergedPlan, 'breaks'>, t: number): number {
  let k = 0;
  while (k < m.breaks.length && t >= m.breaks[k]!) k++;
  return k;
}

/** The plan inputs a departure at `t` ran on. */
export const inputsAt = (m: Pick<MergedPlan, 'breaks' | 'versions'>, t: number): PlanInputs => m.versions[versionAt(m, t)]!;

/** The plan in effect for a line whose own inputs are `current`, changed from `earlier` versions (oldest first; none for a line that has not changed). */
export function planInEffect(current: PlanInputs, earlier: readonly Earlier[]): PlanInEffect {
  const periodic = dayPlan(current);
  if (earlier.length === 0) return { periodic, merged: null };
  let was = asMerged(dayPlan(earlier[0]!.inputs));
  earlier.forEach((e, k) => {
    was = merge(was, earlier[k + 1]?.inputs ?? current, e, k === earlier.length - 1 ? periodic : dayPlan(earlier[k + 1]!.inputs));
  });
  return { periodic, merged: was };
}

/**
 * The latest of a line's `earlier` versions it had settled onto, its plan handed over to that version's
 * own day plan before it changed again, as an index (0 with none): from that handover on the merged plan
 * is the same without the versions before it, so a close may let them go (world.ts settle()).
 */
export function settledOnto(earlier: readonly Earlier[]): number {
  let was = asMerged(dayPlan(earlier[0]!.inputs));
  let onto = 0;
  earlier.forEach((e, k) => {
    if (was.handover <= e.until) onto = k;
    if (k + 1 < earlier.length) was = merge(was, earlier[k + 1]!.inputs, e, dayPlan(earlier[k + 1]!.inputs));
  });
  return onto;
}

function asMerged(plan: DayPlan): MergedPlan {
  return { versions: [plan.inputs], breaks: [], sameModel: [true], carriesOn: [true], trips: plan.trips, stints: plan.stints, handover: Infinity };
}

/** `was` changed at `e.until` to `after`, whose own day plan is `own`. */
function merge(was: MergedPlan, after: PlanInputs, e: Earlier, own: DayPlan): MergedPlan {
  const at = e.until;
  // Past its own handover `was` does what its day plan does, and before it what ran: on the day a line
  // is drawn, nothing before the draw (world.ts recomputeInService keeps that version through the day).
  // A bus whose trip ran on a version before the last carries on only if no change since moved its first stop or swapped its model.
  const m: Pick<MergedPlan, 'versions' | 'breaks' | 'sameModel' | 'carriesOn'> = {
    versions: [...was.versions, after],
    breaks: [...was.breaks, at],
    sameModel: [...was.sameModel.map((same) => same && e.sameModel), true],
    carriesOn: [...was.carriesOn.map((on) => on && e.sameModel && e.sameStart), true],
  };
  const inputsOf = (t: number) => inputsAt(m, t);
  /** The version a bus's last trip ran on, or the one it left the depot on with none. */
  const versionOf = (trips: readonly number[], leaveDepot: number) => versionAt(m, trips[trips.length - 1] ?? leaveDepot);
  /** A bus heading home: never before the change, so one waiting at the first stop sets off from there now. */
  const homeFrom = (bus: OpenBus): Stint => {
    const done = closeStint(bus, inputsOf);
    return done.lastArrival >= at ? done : { ...done, lastArrival: at, arriveDepot: at + (done.arriveDepot - done.lastArrival) };
  };

  // Done before the change, as it was; out at the change, finishing what it began; not yet out, gone.
  const stints: Stint[] = [];
  const trips = was.trips.filter((t) => t < at);
  const open: OpenBus[] = [];
  /** When each of the line's buses is in its depot, free to pull out: kept in order. */
  const home: number[] = [];
  const toDepot = (t: number) => home.splice(sortedIndex(home, t), 0, t);
  for (const s of was.stints) {
    if (s.arriveDepot <= at) {
      stints.push(s);
      continue;
    }
    if (s.leaveDepot >= at) continue;
    if (at >= s.lastArrival) {
      // On its way home already.
      stints.push(s);
      if (m.sameModel[versionOf(s.trips, s.leaveDepot)]) toDepot(s.arriveDepot);
      continue;
    }
    const kept = s.trips.filter((t) => t < at);
    const last = kept[kept.length - 1];
    const bus: OpenBus = { leaveDepot: s.leaveDepot, trips: kept, free: last === undefined ? s.leaveDepot + inputsOf(s.leaveDepot).pullOutS : last + tripTimes(inputsOf(last), last).cycle };
    const v = versionOf(kept, s.leaveDepot);
    if (m.carriesOn[v]) {
      open.push(bus);
      continue;
    }
    const done = homeFrom(bus);
    stints.push(done);
    if (m.sameModel[v]) toDepot(done.arriveDepot);
  }
  // The rest of the fleet is in the depot now; a model swap's buses are all new ones.
  const inDepot = Math.max(0, after.timing.buses - open.length - (e.sameModel ? home.length : 0));
  for (let i = 0; i < inDepot; i++) toDepot(at);

  // The new version's departures, as the day plan builds them, on the buses there are.
  const idleLimit = idleLimitOf(after);
  const close = (bus: OpenBus) => {
    const done = homeFrom(bus);
    stints.push(done);
    toDepot(done.arriveDepot);
  };
  // The day plan's own buses as it runs each departure, for parking the spares.
  const ownOpen: OpenBus[] = [];
  for (const d of own.trips) {
    takeDeparture(ownOpen, d, after, idleLimit, () => undefined);
    if (d < at) continue;
    sendHomeIdle(open, d, idleLimit, close);
    const cycle = tripTimes(after, d).cycle;
    const pick = freeLongest(open, d);
    const leave = d - after.pullOutS;
    if (pick >= 0) {
      open[pick]!.trips.push(d);
      open[pick]!.free = d + cycle;
      trips.push(d);
    } else if (leave >= at && home.length > 0 && home[0]! <= leave) {
      home.shift();
      open.push({ leaveDepot: leave, trips: [d], free: d + cycle });
      trips.push(d);
    }
    // No bus can make it: this departure is not run.
    parkSpares(open, ownOpen, own, d, idleLimit, close);
  }
  for (const bus of open) stints.push(homeFrom(bus));
  stints.sort((a, b) => a.leaveDepot - b.leaveDepot || (a.trips[0] ?? 0) - (b.trips[0] ?? 0));
  const merged = { ...m, trips, stints };
  return { ...merged, handover: handoverOf(merged, own, at) };
}

/**
 * Sends home, after the trip it is on, each bus out at departure `d` that stands in for none of the
 * day plan `own`'s buses, so a line parks its spare buses as its day plan would and comes to run as it
 * does; with no more out than the day plan has (`ownOpen`, as it has run its departures to `d`), none
 * is spare. Each of the day plan's buses that takes a departure after `d`, out already or yet to pull
 * out, needs a stand-in: one of the merged plan's free as early as it is (its trip under way done, or
 * that first departure), and not so early that it would wait at the first stop past the idle limit for
 * the departure. Of the buses that can stand in, those free latest are kept. The kept buses then take
 * each departure the day plan's take, so none goes unrun for the parking, and none waits out the hour
 * to be sent home while another pulls out of the depot for the departure. Where one of the day plan's
 * buses has no stand-in, the merged plan is not yet ahead of it, and none goes home. With no service
 * overnight the spares went home after the evening's last departure anyway, but a line running round
 * the clock kept them out, paid, until the plan ran out of departures (the systems audit's fifth round).
 */
function parkSpares(open: OpenBus[], ownOpen: readonly OpenBus[], own: DayPlan, d: number, idleLimit: number, home: (bus: OpenBus) => void): void {
  if (open.length <= ownOpen.length) return;
  // A departure after this is past the idle limit of every bus out: none of them could stand in for it.
  let reach = -Infinity;
  for (const bus of open) reach = Math.max(reach, bus.free + idleLimit);
  // The day plan's buses to stand in for, by their next departures: one for every bus out, and none is spare.
  const wanted: [Stint, number][] = [];
  for (const s of own.stints) {
    if (s.leaveDepot > reach) break;
    if (s.lastArrival <= d) continue;
    const k = sortedIndex(s.trips, d);
    if (k === s.trips.length || s.trips[k]! > reach) continue;
    if (wanted.push([s, k]) >= open.length) return;
  }
  const wants = wanted.map(([s, k]) => {
    const [last, next] = [s.trips[k - 1], s.trips[k]!];
    return { ready: last === undefined ? next : last + tripTimes(own.inputs, last).cycle, next };
  });
  // Latest departure first, each takes the bus free latest that can stand in: free by its ready, within the idle limit of it.
  wants.sort((a, b) => b.next - a.next);
  const latest = [...open].sort((a, b) => b.free - a.free);
  const kept = new Set<OpenBus>();
  for (const w of wants) {
    const bus = latest.find((b) => !kept.has(b) && b.free <= w.ready && w.next - b.free <= idleLimit);
    if (bus === undefined) return;
    kept.add(bus);
  }
  for (let i = open.length - 1; i >= 0; i--) if (!kept.has(open[i]!)) home(open.splice(i, 1)[0]!);
}

/**
 * The first moment from which every bus of the merged plan does what one of the day plan's does: the
 * same drive out under way, the same trip under way (on the new version) and the same departures
 * after, home at the same moments. From then on the two plans place every bus alike. The day plan's
 * window ends two days on; with no such moment before, that is the handover. After a cut, a line
 * running overnight reaches one only by parking its spares (parkSpares): keeping them out, it matched
 * only where both plans wound down at the window's end, which its day plan read on its middle day does
 * not, so a bus driving home jumped 456 m back to its first stop (the systems audit's fifth round).
 */
function handoverOf(m: Omit<MergedPlan, 'handover'>, own: DayPlan, at: number): number {
  const last = m.breaks.length;
  const sign = (s: Stint, x: number, merged: boolean): string | null => {
    if (s.arriveDepot <= x) return null;
    if (s.leaveDepot >= x) return `${s.leaveDepot}|${s.trips.join(',')}|${s.lastArrival}|${s.arriveDepot}`;
    // Out at x: where it is depends on its drive out, its trip under way, and what comes after.
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
  // Each on a whole second, so the costs split an hour there exactly (costs.ts): at a drive out's own fractional
  // second, the day plan's middle day put it a float's width before the split, and neither part billed it.
  const candidates = [...new Set([at, ...own.trips.filter((t) => t > at), ...own.stints.map((s) => Math.floor(s.leaveDepot)).filter((t) => t > at)])].sort((a, b) => a - b);
  for (const x of candidates) {
    const a = signs(m.stints, x, true);
    if (a.some((v) => v.startsWith('earlier') || v.endsWith('earlier'))) continue;
    const b = signs(own.stints, x, false);
    if (a.length === b.length && a.every((v, i) => v === b[i])) return x;
  }
  return 2 * SECONDS_PER_DAY;
}

/** The index of the first of `list`, in order, after `t`. */
function sortedIndex(list: readonly number[], t: number): number {
  let [lo, hi] = [0, list.length];
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (list[mid]! <= t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Buses out at `second` of the frame on a plan in effect: on the road, at the first stop or driving to or from the depot. */
export function busesOutAt(p: PlanInEffect, second: number): number {
  const m = p.merged;
  const [stints, t] = m && second < m.handover ? [m.stints, second] : [p.periodic.stints, ((second % SECONDS_PER_DAY) + SECONDS_PER_DAY) % SECONDS_PER_DAY];
  return stints.filter((s) => t >= s.leaveDepot && t < s.arriveDepot).length;
}

/** What [from, to) of the merged plan holds for the costs (schedule.ts hourOfPlan), each count by the version it ran on. */
export function hourOfMerged(m: MergedPlan, from: number, to: number): { readonly legs: number[]; readonly serviceS: number; readonly pullOuts: number[]; readonly pullIns: number[] } {
  const within = (t: number) => t >= from && t < to;
  const legs = m.versions.map(() => 0);
  const pullOuts = m.versions.map(() => 0);
  const pullIns = m.versions.map(() => 0);
  for (const t of m.trips) {
    const v = versionAt(m, t);
    legs[v]! += Number(within(t)) + Number(within(t + tripTimes(m.versions[v]!, t).cycle / 2));
  }
  let serviceS = 0;
  for (const s of m.stints) {
    const out = versionAt(m, s.leaveDepot);
    const start = s.leaveDepot + m.versions[out]!.pullOutS;
    serviceS += Math.max(0, Math.min(to, s.lastArrival) - Math.max(from, start));
    pullOuts[out]! += Number(within(s.leaveDepot));
    pullIns[versionAt(m, s.trips[s.trips.length - 1] ?? s.leaveDepot)]! += Number(within(s.lastArrival));
  }
  return { legs, serviceS, pullOuts, pullIns };
}
