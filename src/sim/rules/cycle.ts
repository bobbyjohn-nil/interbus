// The one cycle function (K07): how long a bus takes to run a line and come back, and so how many
// buses a headway needs. The forecast, the costs, the "needs N buses" card and the vehicle layer all
// read it, so a bus loops in exactly the cycle it is billed for (I6). From V1
// (`Intralines@7af45b1:src/game/sim/demand.worker.ts:211-229`, `src/game/constants.ts:353-361`),
// without its refuelling term: fuel is out (PLAN §2).
//
// Since item 15 a round trip is as long as its period's traffic makes it: the drive at the period's
// congestion (traffic/congestion.ts) for the streets the line takes, the dwells and layovers as they were.
// Since the M4 spec's item 2, roadworks on its streets make it longer still (slowedM).
import { DWELL_SEC } from '../config/demand';
import { ROADWORKS_SPEED, SNOW_SPEED } from '../config/events';
import { LAYOVER_SECONDS } from '../config/fleet';
import { periodCongestion } from '../traffic/congestion';
import { PERIODS, runsIn, type Headways, type Period } from './periods';

/**
 * Whole seconds for one round trip: the route out and back at `kmh`, a dwell at each stop between
 * the ends in each direction, and a layover at each end.
 */
export function cycleSeconds(routeM: number, stopCount: number, kmh: number, congestion = 1): number {
  const driveSeconds = (routeM / 1000 / kmh) * 3600 * congestion;
  const dwellSeconds = Math.max(0, stopCount - 2) * DWELL_SEC;
  return Math.ceil(2 * (driveSeconds + dwellSeconds)) + 2 * LAYOVER_SECONDS;
}

/** The metres a route takes as long to drive at full speed as it does with `worksM` of it through roadworks, at ROADWORKS_SPEED, and all of it at SNOW_SPEED in snow. */
export function slowedM(routeM: number, worksM: number, snow = false): number {
  return (routeM + worksM * (1 / ROADWORKS_SPEED - 1)) / (snow ? SNOW_SPEED : 1);
}

/** A line's round trip in each period, whole seconds. */
export type Cycles = Readonly<Record<Period, number>>;

/** The round trip in each period on a route taking `rush` of the rush (its streets' metres-weighted class weight). */
export function cyclesOf(routeM: number, stopCount: number, kmh: number, rush: number): Cycles {
  const factor = periodCongestion(rush);
  return { peak: cycleSeconds(routeM, stopCount, kmh, factor.peak), offpeak: cycleSeconds(routeM, stopCount, kmh, factor.offpeak), overnight: cycleSeconds(routeM, stopCount, kmh, factor.overnight) };
}

/** The longest round trip of the periods a line runs in (0 if it runs in none). */
export function longestCycle(cycles: Cycles, h: Headways): number {
  let most = 0;
  for (const period of PERIODS) if (headwayIn(h, period) !== null) most = Math.max(most, cycles[period]);
  return most;
}

/** The shortest headway a line runs at, or null if it runs in no period. */
function shortestHeadway(h: Headways): number | null {
  let least: number | null = null;
  for (const period of PERIODS) {
    const headway = headwayIn(h, period);
    if (headway !== null && (least === null || headway < least)) least = headway;
  }
  return least;
}

/** Buses that keep one headway on a cycle: at least one. */
export function busesForHeadway(cycle: number, headwaySeconds: number): number {
  return Math.max(1, Math.ceil(cycle / headwaySeconds));
}

/** A line's headway in a period, or null where it does not run then. */
export function headwayIn(h: Headways, period: Period): number | null {
  if (!runsIn(h, period)) return null;
  return period === 'overnight' ? h.overnight : h[period];
}

/**
 * Buses a line needs: the most any period it runs in needs (D7). With a round trip per period, its
 * longest over its shortest headway: no trip outlasts the longest, and no two departures come closer
 * than the shortest headway, even where a slow period's trips run on into a busier one, so the day
 * plan never has more buses out (I6). Where one period is both the slowest and the busiest, as the
 * peak usually is, that is its own count; otherwise it may be one bus more.
 */
export function busesNeeded(cycle: number | Cycles, h: Headways): number {
  if (typeof cycle !== 'number') {
    const headway = shortestHeadway(h);
    return headway === null ? 0 : busesForHeadway(longestCycle(cycle, h), headway);
  }
  let most = 0;
  for (const period of PERIODS) {
    const headway = headwayIn(h, period);
    if (headway !== null) most = Math.max(most, busesForHeadway(cycle, headway));
  }
  return most;
}

/** The headway a line actually runs with `buses`: as planned, or every cycle ÷ buses when short (V1). */
export function runningHeadway(cycle: number, headwaySeconds: number, buses: number): number | null {
  if (buses <= 0) return null;
  return Math.max(headwaySeconds, Math.ceil(cycle / buses));
}
