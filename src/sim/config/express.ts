// Express lines (the M4 spec, below the cut's first item; PLAN cut 2): a line whose streets make it one,
// long with its stops far apart, is ridden as quicker and its fare minded less. V1's rule and weights
// (`Intralines@7af45b1:src/game/constants.ts:390-445`, `src/game/sim/demand.worker.ts:271-345`), without
// its ×1.5 subsidy (X-20: keep the predicate, taper the reward; EC-05), and only behind I3 (bench/sweep.ts).

/** A line of at least this many metres of street, first stop to last, */
export const EXPRESS_MIN_ROUTE_M = 5_000;
/** with its stops this far apart on average along it, */
export const EXPRESS_MIN_SPACING_M = 1_200;
/** and at least this many stops, is express. */
export const EXPRESS_MIN_STOPS = 3;

/** Riders feel an express ride, dwells and all, as this share of its minutes (V1's ride weight). */
export const EXPRESS_RIDE_WEIGHT = 0.85;
/** And its fare's distance from the reference fare as this share of the minutes it would be (V1's fare tolerance). */
export const EXPRESS_FARE_WEIGHT = 0.5;
