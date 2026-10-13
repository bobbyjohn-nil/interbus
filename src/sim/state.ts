// The sim's whole state, owned by the worker (PLAN §6 "Boundaries"). Everything a save holds is
// here; everything derived (demand, paths, positions) is rebuilt from it.
import type { LineId, NextIds, StopId } from './core/ids';
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

export interface Line {
  readonly id: LineId;
  name: string;
  colour: string;
  stopIds: StopId[];
  fareCents: number;
  headways: Headways;
}

export interface SimState {
  readonly city: CityRef;
  /** Whole game-seconds since founding (05:00 on day 1). */
  elapsed: number;
  rng: Rng;
  company: { name: string; colour: string };
  nextIds: NextIds;
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
    stops: [],
    lines: [],
    ledger: foundLedger(),
  };
}
