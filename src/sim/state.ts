// The sim's whole state, owned by the worker (PLAN §6 "Boundaries"). Everything a save holds is
// here; everything derived (demand, paths, positions) is rebuilt from it.
import type { DepotId, LineId, NextIds, StopId } from './core/ids';
import { FIRST_IDS } from './core/ids';
import { createRng, seedFor, type Rng } from './core/rng';
import { foundLedger, type Ledger } from './economy/ledger';
import type { Headways } from './rules/periods';

/** Which city file the game runs on; a save names it so a different city or revision is refused, never substituted. */
export interface CityRef {
  readonly id: string;
  readonly revision: string;
  readonly hash: string;
}

export interface Stop {
  readonly id: StopId;
  readonly lon: number;
  readonly lat: number;
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
  /** Buses the line owns (Sparrows until week 5's models); with fewer than its headways need, it runs every cycle ÷ buses. */
  buses: number;
}

export interface SimState {
  readonly city: CityRef;
  /** Whole game-seconds since founding (05:00 on day 1). */
  elapsed: number;
  rng: Rng;
  company: { name: string; colour: string };
  nextIds: NextIds;
  depots: Depot[];
  stops: Stop[];
  lines: Line[];
  ledger: Ledger;
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
  };
}
