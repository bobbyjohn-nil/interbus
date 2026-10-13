// Whether a line is express (the M4 spec, below the cut's first item): from its streets alone, one
// predicate for the riders (demand/assign.ts), the line card, the draft card and I3's sweep (GD-05).
import { EXPRESS_MIN_ROUTE_M, EXPRESS_MIN_SPACING_M, EXPRESS_MIN_STOPS } from '../config/express';

export { EXPRESS_MIN_ROUTE_M, EXPRESS_MIN_SPACING_M, EXPRESS_MIN_STOPS };

/** A line of `stops` stops over `routeM` metres of street is express when it is long and its stops far apart. */
export function isExpress(routeM: number, stops: number): boolean {
  return stops >= EXPRESS_MIN_STOPS && routeM >= EXPRESS_MIN_ROUTE_M && routeM / (stops - 1) >= EXPRESS_MIN_SPACING_M;
}

/** The same for a line's plan or draft: its stops, and the street metres to each. */
export function planIsExpress(plan: { readonly stops: readonly unknown[]; readonly stopDistM: readonly number[] }): boolean {
  return isExpress(plan.stopDistM[plan.stopDistM.length - 1] ?? 0, plan.stops.length);
}
