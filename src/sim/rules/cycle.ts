// The one cycle function (K07): how long a bus takes to run a line and come back, and so how many
// buses a headway needs. The forecast, the costs, the "needs N buses" card and the vehicle layer all
// read it, so a bus loops in exactly the cycle it is billed for (I6). From V1
// (`Intralines@7af45b1:src/game/sim/demand.worker.ts:211-229`, `src/game/constants.ts:353-361`),
// without its refuelling term: fuel is out (PLAN §2).
import { DWELL_SEC } from '../config/demand';
import { LAYOVER_SECONDS } from '../config/fleet';
import { PERIODS, runsIn, type Headways, type Period } from './periods';

/**
 * Whole seconds for one round trip: the route out and back at `kmh`, a dwell at each stop between
 * the ends in each direction, and a layover at each end.
 */
export function cycleSeconds(routeM: number, stopCount: number, kmh: number): number {
  const driveSeconds = (routeM / 1000 / kmh) * 3600;
  const dwellSeconds = Math.max(0, stopCount - 2) * DWELL_SEC;
  return Math.ceil(2 * (driveSeconds + dwellSeconds)) + 2 * LAYOVER_SECONDS;
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

/** Buses a line needs: the most any period it runs in needs (D7). */
export function busesNeeded(cycle: number, h: Headways): number {
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
