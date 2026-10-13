// Medals (the M4 spec, item 3): which ones a day's close earns, what is left to silver, and the bus
// models a medal unlocks. One predicate for the award at the close, the top bar's chip and the bus
// pickers on the draft and line cards (GD-05).
import type { BusModel } from '../config/fleet';
import { BRONZE_OVERALL, GOLD_GRADE_MIN, GOLD_OVERALL, GOLD_TRIPS_PER_DAY, MEDAL_IDS, SILVER_TRIPS, type MedalId } from '../config/medals';

/** The bars the cards name, read from the config rows the close uses. */
export { BRONZE_OVERALL, GOLD_GRADE_MIN, GOLD_OVERALL, GOLD_TRIPS_PER_DAY, MEDAL_IDS, SILVER_TRIPS, type MedalId };

/** The day each medal was awarded, or null while it is not held. */
export type Medals = { readonly [M in MedalId]: number | null };

export const NO_MEDALS: Medals = { bronze: null, silver: null, gold: null };

/** What a close is judged on: the quarter's report card on its last day (else null), and the trips carried since founding and on the day closed. */
export interface MedalClose {
  readonly card: { readonly coverage: number; readonly reliability: number; readonly comfort: number; readonly money: number; readonly overall: number } | null;
  readonly tripsCarried: number;
  readonly tripsToday: number;
}

/** The medals this close earns that are not held yet, bronze first. The card's bars compare its unrounded overall, as the grant does. */
export function medalsEarned(held: Medals, close: MedalClose): MedalId[] {
  const c = close.card;
  const meets: Record<MedalId, boolean> = {
    bronze: c !== null && c.overall >= BRONZE_OVERALL,
    silver: close.tripsCarried >= SILVER_TRIPS,
    gold: c !== null && c.overall >= GOLD_OVERALL && Math.min(c.coverage, c.reliability, c.comfort, c.money) >= GOLD_GRADE_MIN && close.tripsToday >= GOLD_TRIPS_PER_DAY,
  };
  return MEDAL_IDS.filter((m) => held[m] === null && meets[m]);
}

/** Trips still to carry for silver; 0 once it is held. */
export function tripsToSilver(held: Medals, tripsCarried: number): number {
  return held.silver !== null ? 0 : Math.max(0, SILVER_TRIPS - tripsCarried);
}

/** A bus model behind a medal not yet held: the Goliath until silver. */
export function modelLocked(model: Pick<BusModel, 'unlockedBy'>, held: Medals): boolean {
  return model.unlockedBy !== null && held[model.unlockedBy] === null;
}
