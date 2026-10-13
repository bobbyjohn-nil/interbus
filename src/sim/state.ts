// The sim's whole state, owned by the worker (PLAN §6 "Boundaries"). Everything a save holds is
// here; everything derived (demand, paths, positions) is rebuilt from it.
import type { DepotId, LineId, NextIds, StopId } from './core/ids';
import { FIRST_IDS } from './core/ids';
import { createRng, seedFor, type Rng } from './core/rng';
import { foundLedger, type Ledger } from './economy/ledger';
import type { Headways } from './rules/periods';
import type { BusModelId } from './config/fleet';
import type { StopTier } from './config/stops';

/** Which city file the game runs on; a save names it, so another city is refused, never substituted, and another bake of this one is rebased (save/rebase.ts). */
export interface CityRef {
  readonly id: string;
  readonly revision: string;
  readonly hash: string;
}

export interface Stop {
  readonly id: StopId;
  readonly lon: number;
  readonly lat: number;
  /** Sign to Transfer Hub (config/stops.ts); every stop starts a Sign. */
  tier: StopTier;
}

/** A depot, anchored by place; its street node is found again from the city on load. */
export interface Depot {
  readonly id: DepotId;
  readonly lon: number;
  readonly lat: number;
}

export interface Line {
  readonly id: LineId;
  name: string;
  colour: string;
  stopIds: StopId[];
  fareCents: number;
  headways: Headways;
  /** Thousandths of a boarding carried so far, so fares bank in whole boardings and no cent is lost between hours or across a save. */
  boardedMilli: number;
  /** Buses the line owns, all of its one model; with fewer than its headways need, it runs every cycle ÷ buses. */
  buses: number;
  model: BusModelId;
}

export interface SimState {
  city: CityRef;
  /** Whole game-seconds since founding (05:00 on day 1). */
  elapsed: number;
  rng: Rng;
  company: { name: string; colour: string };
  nextIds: NextIds;
  depots: Depot[];
  stops: Stop[];
  lines: Line[];
  ledger: Ledger;
  /** Day closes in a row with cash below the credit line's floor; five end the run (rules/credit.ts, D10). */
  closesBelowFloor: number;
}

/** A new company at founding: 05:00 on day 1, Founding capital its only ledger row. */
export function newGame(city: CityRef, company: { name: string; colour: string }, seed: number): SimState {
  return {
    city,
    elapsed: 0,
    rng: createRng(seedFor(seed, 'game')),
    company: { ...company },
    nextIds: FIRST_IDS,
    depots: [],
    stops: [],
    lines: [],
    ledger: foundLedger(),
    closesBelowFloor: 0,
  };
}
