// The sim's whole state, owned by the worker (PLAN §6 "Boundaries"). Everything a save holds is
// here; everything derived (demand, paths, positions) is rebuilt from it.
import type { ContractId, DepotId, LineId, NextIds, StopId } from './core/ids';
import { FIRST_IDS } from './core/ids';
import { createRng, seedFor, type Rng } from './core/rng';
import { foundLedger, type Ledger } from './economy/ledger';
import type { Headways } from './rules/periods';
import { NO_MEDALS, type Medals } from './rules/medal';
import type { ContractKind } from './config/contracts';
import type { EventKind } from './config/events';
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
  /** Thousandths of a paid boarding carried so far (a change onto the line pays nothing, EC-04), so fares bank in whole boardings and no cent is lost between hours or across a save. */
  boardedMilli: number;
  /** Buses the line owns, all of its one model; with fewer than its headways need, it runs every cycle ÷ buses. */
  buses: number;
  model: BusModelId;
  /** Its versions from before a change made in service (or, just drawn, one that ran no bus), oldest first, until it settles onto its own day plan (rules/transition.ts), and on the day it was drawn every one since until that day's close; none or empty when it has not changed. */
  earlier?: EarlierRun[];
}

/**
 * A line as it ran before a change made in service (the M4 spec, item 4): its places, model and
 * drives, and the plan its trips under way keep to, so each finishes on the route and the times it
 * began with. A line just drawn settles from a version that ran no bus (its plan's buses 0), so its
 * buses pull out of the depot for their first departures, and keeps it until that day's close, so the
 * day's costs and fares count from the draw. Kept as numbers because nothing else holds them once the
 * line has changed.
 */
export interface EarlierRun {
  /** The game second of the change: its departures before this, the next version's from it. */
  readonly until: number;
  readonly stops: readonly { readonly lon: number; readonly lat: number }[];
  readonly depot: { readonly lon: number; readonly lat: number } | null;
  readonly model: BusModelId;
  readonly routeM: number;
  readonly pullOutM: number;
  readonly pullInM: number;
  readonly plan: {
    readonly cycle: number;
    readonly cycles: { readonly peak: number; readonly offpeak: number; readonly overnight: number };
    readonly headways: Headways;
    readonly buses: number;
    readonly oneWayS: number;
    readonly pullOutS: number;
    readonly pullInS: number;
  };
}

/**
 * A HEADWAY contract (the M3 spec, item 11): offered near a landmark, taken with a click, then graded
 * at each day's close until it is paid or can no longer be (economy/contracts.ts). Paid and lapsed
 * contracts leave the list; a paid one stays in the ledger as its Contracts row.
 */
export interface Contract {
  readonly id: ContractId;
  /** The landmark's name in the city file. */
  readonly landmark: string;
  /** HEADWAY: a bus at least every `ask` seconds; RIDERSHIP: at least `ask` paid boardings a day (config/contracts.ts). */
  readonly kind: ContractKind;
  readonly ask: number;
  readonly rewardCents: number;
  readonly offeredDay: number;
  /** The day it was taken, or null while it is an offer. */
  acceptedDay: number | null;
  /** Days in a row it has been met, counted at each close. */
  daysMet: number;
  /** Service hours today (05:00–24:00) that ended with the landmark short of the ask. */
  hoursMissedToday: number;
}

/** A city event (the M4 spec, item 2): rolled the day before `startDay`, on through `endDay` (rules/event.ts). */
export interface CityEvent {
  readonly kind: EventKind;
  readonly startDay: number;
  readonly endDay: number;
  /** Roadworks: the named street. A festival: the place it is at, a landmark or a street. Snow: ''. */
  readonly street: string;
  /** Roadworks: the stretch of the street's edges (the city graph's) driven at ROADWORKS_SPEED; none for the others. */
  readonly edges: readonly number[];
  /** A festival: the stop it gathers round, by place (it outlives the stop); null for the others. */
  readonly at: { readonly lon: number; readonly lat: number } | null;
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
  /** Offered and held contracts of either kind, at most three (config/contracts.ts). */
  contracts: Contract[];
  /** Indices into CONTRACT_ASKS still to deal before the next shuffle, so every six offers hold each ask once (I11). */
  contractDeck: number[];
  /** The events' own stream, apart from `rng`, so rolling events never shifts the contract deck (I8). */
  eventRng: Rng;
  /** The latest event, pending, on or over (kept for the gap after it); null before the first. */
  event: CityEvent | null;
  /** The day each medal was awarded, or null (the M4 spec, item 3; rules/medal.ts). */
  medals: Medals;
  /** Paid boardings banked since founding: trips, since a change onto a line boards free (EC-04). Counted on the company as they bank, so silver never depends on which lines still stand. */
  tripsCarried: number;
  /** Of those, the ones banked on the day not yet closed: gold reads the day's trips at its close. */
  tripsToday: number;
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
    contracts: [],
    contractDeck: [],
    eventRng: createRng(seedFor(seed, 'events')),
    event: null,
    medals: { ...NO_MEDALS },
    tripsCarried: 0,
    tripsToday: 0,
  };
}
