// Depot rows (C01): V1's ladder and V3's siting (`Intralines@7af45b1:src/game/constants.ts:31-41`,
// `Intralines_City@dc63602:src/game/depots/siting.ts:75-92`), on the land the bake marks as depot
// land (sim.json depotLand: OSM industrial land).

/** The first depot's price; each later one costs 1.5× the last, rounded to $5k: $150k, $225k, $340k, $505k, $760k. */
export const DEPOT_FIRST_PRICE_CENTS = 15_000_000;
export const DEPOT_PRICE_GROWTH = 1.5;
export const DEPOT_PRICE_STEP_CENTS = 500_000;
export const MAX_DEPOTS = 5;
/** Buses a depot parks (V1's level-1 depot). */
export const DEPOT_CAPACITY = 6;
/** Upkeep a day (V1's level-1 depot). */
export const DEPOT_UPKEEP_CENTS = 30_000;
/** A depot needs a street node this close: its buses leave from there. */
export const DEPOT_STREET_REACH_M = 400;
/** And no other depot this close. */
export const DEPOT_SPACING_M = 120;
