// HEADWAY contracts (the M3 spec, item 11; GD-04, I11): V2's three slots and its three asks
// (`Intralines_City_dep@archive/intralines-city-v1:Gaming/src/30-sim.js:4747-4805`), each offered near a
// landmark (`cities/boston/city.json`) and graded by the running headway at a stop within its reach.
import { MAX_WALK_M } from './demand';

/** Contracts offered or held at once. */
export const CONTRACT_SLOTS = 3;

/** What a contract asks and pays: a bus at least this often at a stop near the landmark. */
export interface ContractAsk {
  readonly askSeconds: number;
  readonly rewardCents: number;
}

export const CONTRACT_ASKS: readonly ContractAsk[] = [
  { askSeconds: 600, rewardCents: 24_000_000 },
  { askSeconds: 900, rewardCents: 15_000_000 },
  { askSeconds: 1_200, rewardCents: 6_000_000 },
];

/** Days in a row a contract must be met, and the days from taking it within which they must fall. */
export const CONTRACT_DAYS = 10;
export const CONTRACT_WINDOW_DAYS = 20;

/** A stop counts for a landmark within the walk riders make to a stop. */
export const CONTRACT_REACH_M = MAX_WALK_M;
