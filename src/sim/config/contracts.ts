// Contracts (the M3 spec, item 11; the M4 spec, item 1; GD-04, I11): V2's three slots and its asks
// (`Intralines_City_dep@archive/intralines-city-v1:Gaming/src/30-sim.js:50-54, 4747-4805`), each offered
// near a landmark (`cities/boston/city.json`): HEADWAY graded by the running headway at a stop within
// its reach, RIDERSHIP by the paid boardings a day at every stop within it. Harder asks pay more (V2
// first paid its easiest RIDERSHIP ask the most, fixed in its `b9b8637`).
import { MAX_WALK_M } from './demand';
import { DAYS_PER_QUARTER } from './time';

/** Contracts offered or held at once. */
export const CONTRACT_SLOTS = 3;

export const CONTRACT_KINDS = ['headway', 'ridership'] as const;
export type ContractKind = (typeof CONTRACT_KINDS)[number];

/**
 * What a contract asks and pays. HEADWAY: a bus at least every `ask` seconds at a stop near the
 * landmark. RIDERSHIP: at least `ask` paid boardings a day at the stops near it.
 */
export interface ContractAsk {
  readonly kind: ContractKind;
  readonly ask: number;
  readonly rewardCents: number;
}

/** Every ask, the deck's cards (a deck holds their indices). */
export const CONTRACT_ASKS: readonly ContractAsk[] = [
  { kind: 'headway', ask: 600, rewardCents: 24_000_000 },
  { kind: 'headway', ask: 900, rewardCents: 15_000_000 },
  { kind: 'headway', ask: 1_200, rewardCents: 6_000_000 },
  { kind: 'ridership', ask: 800, rewardCents: 24_000_000 },
  { kind: 'ridership', ask: 400, rewardCents: 15_000_000 },
  { kind: 'ridership', ask: 150, rewardCents: 6_000_000 },
];

/**
 * Days in a row a contract must be met, and the days from taking it within which they must fall: a
 * quarter in a row within two (D25; 10 within 20 while a quarter was ten days).
 */
export const CONTRACT_DAYS = DAYS_PER_QUARTER;
export const CONTRACT_WINDOW_DAYS = 2 * DAYS_PER_QUARTER;

/**
 * An offer nobody takes is withdrawn after this many days, so one the company cannot meet never
 * holds its landmark's slot for good (V2's offers ran out 20 days after they were made,
 * `Intralines_City_dep@archive/intralines-city-v1:Gaming/src/30-sim.js:4828-4862`).
 */
export const CONTRACT_OFFER_DAYS = DAYS_PER_QUARTER;

/** A stop counts for a landmark within the walk riders make to a stop. */
export const CONTRACT_REACH_M = MAX_WALK_M;
