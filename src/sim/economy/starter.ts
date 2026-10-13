// The starter line D7 derives founding capital from: a depot, four sign stops and the Sparrows its
// founding headway needs. The cycle function counts the buses, so the recipe follows prices, speeds
// and dwells as they are tuned; at V1's it is $356,000 (two Sparrows; D7 first assumed one).
import { DEPOT_COST_CENTS, STARTER_HEADWAY_SECONDS, STARTER_ROUTE_M, STARTER_STOPS, STOP_COST_CENTS } from '../config/economy';
import { SPARROW } from '../config/fleet';
import { busesForHeadway, cycleSeconds } from '../rules/cycle';

/** Buses the starter line needs at its founding headway. */
export function starterBuses(): number {
  return busesForHeadway(cycleSeconds(STARTER_ROUTE_M, STARTER_STOPS, SPARROW.kmh), STARTER_HEADWAY_SECONDS);
}

/** The starter line's cost in whole cents. */
export function starterLineCents(): number {
  return DEPOT_COST_CENTS + STARTER_STOPS * STOP_COST_CENTS + starterBuses() * SPARROW.priceCents;
}
