// A line's day plan (I6, K07): every departure from its first stop, the round trip each starts, and
// every bus's stint from leaving the depot to coming home. The costs bill these movements hour by
// hour (economy/costs.ts) and the vehicle layer draws them (busPositionAt), so what a bus does is
// what it is billed for. V3 staggered buses at round trip ÷ buses and ignored the headway
// (`Intralines_City@dc63602:src/game/buses/position.ts:99-157`); here each period's own headway
// sets the departures.
//
// A round trip that leaves the first stop at t runs out to the last stop, lays over there until
// t + cycle/2, runs back and lays over until t + cycle, when the bus is free for the next departure.
// Departures leave every running headway (dayDepartures). A bus pulls out of the depot when no bus
// is free at the first stop, and goes home when it would otherwise wait there over an hour. The plan repeats daily and is laid over three days, so a
// trip that starts before midnight, and a bus still out at midnight, carry across.
import { IDLE_HOME_SECONDS } from '../config/fleet';
import { SECONDS_PER_DAY } from '../config/time';
import { periodAt } from './periods';
import { DAY_WINDOWS, runningHeadwayIn, type Timing } from './timetable';

/** What a plan reads: the line's timetable, its one-way time and the drives to and from its depot, in seconds. */
export interface PlanInputs {
  readonly timing: Timing;
  /** First stop to last: the drive plus a dwell at each stop between, seconds (fractional). */
  readonly oneWayS: number;
  /** Depot to first stop, and first stop to depot, seconds; 0 with no depot. */
  readonly pullOutS: number;
  readonly pullInS: number;
}

/** One bus's day out: it leaves the depot, runs `trips` (departures from the first stop), and comes home. */
export interface Stint {
  readonly leaveDepot: number;
  readonly trips: readonly number[];
  /** When it is back at the first stop after its last trip, and leaves for the depot. */
  readonly lastArrival: number;
  readonly arriveDepot: number;
}

/** Times are seconds from midnight of the plan's middle day; the plan holds departures from the day before to the day after. */
export interface DayPlan {
  readonly inputs: PlanInputs;
  readonly trips: readonly number[];
  readonly stints: readonly Stint[];
}

/**
 * One day's departures from the first stop, in seconds of the day. Each run of service (05:00–24:00,
 * or the whole day when overnight runs) starts on its first second; each departure comes one running
 * headway after the last, by the period the last fell in. A period with a shorter headway starts on
 * time if the spacing allows, so a peak does not wait out an off-peak gap. A run through midnight
 * keeps its spacing into the next day's 00:00.
 */
export function dayDepartures(t: Timing): number[] {
  const out: number[] = [];
  const headway = (w: (typeof DAY_WINDOWS)[number]) => runningHeadwayIn(t, w.period);
  let at: number | null = null;
  for (let k = 0; k < DAY_WINDOWS.length; k++) {
    const w = DAY_WINDOWS[k]!;
    const h = headway(w);
    if (h === null) {
      at = null;
      continue;
    }
    // A new run starts on its window's first second; a continuing one keeps its spacing, starting
    // this window on time when its shorter headway allows.
    if (at === null) at = w.from;
    else if (at > w.from) {
      const last = out[out.length - 1]!;
      at = Math.max(w.from, Math.min(at, last + h));
    }
    for (; at < w.to; at += h) out.push(at);
  }
  // A run through midnight goes on into the next day's 00:00: no departure may crowd it.
  if (at !== null && out[0] === 0) {
    while (out.length > 1 && SECONDS_PER_DAY - out[out.length - 1]! < (runningHeadwayIn(t, periodAt(out[out.length - 1]!)) ?? 0)) out.pop();
  }
  return out;
}

/** Departures over [fromDay, toDay) days of the repeating plan, in time order. */
function departures(t: Timing, fromDay: number, toDay: number): number[] {
  const day = dayDepartures(t);
  const out: number[] = [];
  for (let d = fromDay; d < toDay; d++) for (const s of day) out.push(d * SECONDS_PER_DAY + s);
  return out;
}

export function dayPlan(inputs: PlanInputs): DayPlan {
  const { timing, oneWayS, pullOutS, pullInS } = inputs;
  const cycle = timing.cycle;
  const trips = departures(timing, -1, 2);
  // A bus waits at the first stop for its next departure, unless that is over an hour off, or it
  // has no depot to go to.
  const idleLimit = pullOutS + pullInS > 0 ? Math.max(IDLE_HOME_SECONDS, pullOutS + pullInS) : 0;
  const open: { leaveDepot: number; trips: number[]; free: number }[] = [];
  const stints: Stint[] = [];
  const close = (s: (typeof open)[number]) => {
    const last = s.trips[s.trips.length - 1]!;
    const lastArrival = last + cycle / 2 + oneWayS;
    stints.push({ leaveDepot: s.leaveDepot, trips: s.trips, lastArrival, arriveDepot: lastArrival + pullInS });
  };
  for (const t of trips) {
    for (let i = open.length - 1; i >= 0; i--) {
      if (t - open[i]!.free > idleLimit) close(open.splice(i, 1)[0]!);
    }
    // The bus free longest takes the departure; none free means one more pulls out.
    let pick = -1;
    for (let i = 0; i < open.length; i++) if (open[i]!.free <= t && (pick < 0 || open[i]!.free < open[pick]!.free)) pick = i;
    if (pick >= 0) {
      open[pick]!.trips.push(t);
      open[pick]!.free = t + cycle;
    } else open.push({ leaveDepot: t - pullOutS, trips: [t], free: t + cycle });
  }
  for (const s of open) close(s);
  stints.sort((a, b) => a.leaveDepot - b.leaveDepot || a.trips[0]! - b.trips[0]!);
  return { inputs, trips, stints };
}

/** Buses out at once, at most, over the plan's middle day: what the line must own. */
export function busesOut(plan: DayPlan): number {
  const events: [number, number][] = [];
  for (const s of plan.stints) {
    if (s.arriveDepot <= 0 || s.leaveDepot >= SECONDS_PER_DAY) continue;
    events.push([s.leaveDepot, 1], [s.arriveDepot, -1]);
  }
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let now = 0;
  let most = 0;
  for (const [, d] of events) most = Math.max(most, (now += d));
  return most;
}

/** What one hour [from, to) of the middle day holds: legs begun, in-service seconds, and drives to and from the depot begun. */
export interface HourOfPlan {
  /** Legs between the ends begun in the hour: each departure's run out and its run back. */
  readonly legs: number;
  /** Seconds buses spend between leaving and coming back to the first stop. */
  readonly serviceS: number;
  readonly pullOuts: number;
  readonly pullIns: number;
}

export function hourOfPlan(plan: DayPlan, from: number, to: number): HourOfPlan {
  const half = plan.inputs.timing.cycle / 2;
  const within = (t: number) => t >= from && t < to;
  let legs = 0;
  for (const t of plan.trips) legs += Number(within(t)) + Number(within(t + half));
  let serviceS = 0;
  let pullOuts = 0;
  let pullIns = 0;
  for (const s of plan.stints) {
    const start = s.leaveDepot + plan.inputs.pullOutS;
    serviceS += Math.max(0, Math.min(to, s.lastArrival) - Math.max(from, start));
    pullOuts += Number(within(s.leaveDepot));
    pullIns += Number(within(s.lastArrival));
  }
  return { legs, serviceS, pullOuts, pullIns };
}
