// The starter line D7 derives founding capital from: a depot, four sign stops and the Sparrows its
// founding headway needs. The cycle function counts the buses, so the recipe follows prices, speeds
// and dwells as they are tuned; at V1's it is $356,000 (two Sparrows; D7 first assumed one).
import { DEPOT_COST_CENTS, STARTER_HEADWAY_SECONDS, STARTER_ROUTE_M, STARTER_STOPS, STOP_COST_CENTS } from '../config/economy';
import { SPARROW } from '../config/fleet';
import { STARTER_RUSH } from '../config/traffic';
import { busesNeeded, cyclesOf } from '../rules/cycle';

/** Buses the starter line needs at its founding headway all day, on main streets at their rush (the M3 spec, item 15). */
export function starterBuses(): number {
  const h = STARTER_HEADWAY_SECONDS;
  return busesNeeded(cyclesOf(STARTER_ROUTE_M, STARTER_STOPS, SPARROW.kmh, STARTER_RUSH), { peak: h, offpeak: h, overnight: null });
}

/** The starter line's cost in whole cents. */
export function starterLineCents(): number {
  return DEPOT_COST_CENTS + STARTER_STOPS * STOP_COST_CENTS + starterBuses() * SPARROW.priceCents;
}
