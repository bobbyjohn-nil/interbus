// What crosses between the sim worker and the page: the only sim module besides sim/rules that
// src/ui and src/render may import (CLAUDE.md "Architecture guardrails"). Plain data: anything here
// must survive structured cloning.
import type { BusModelId } from '../config/fleet';

export type { BusModelId };

export type LngLatPair = [lon: number, lat: number];

/** Paused, then three speeds (worker/host.ts SPEEDS). */
export type Speed = 0 | 1 | 2 | 3;

export interface CityRefData {
  readonly id: string;
  readonly revision: string;
  readonly hash: string;
}

/** A line's headways in whole seconds; overnight null is no overnight service (sim/rules/periods.ts). */
export interface HeadwaysData {
  readonly peak: number;
  readonly offpeak: number;
  readonly overnight: number | null;
}

/** What a line's day plan is built from (sim/rules/schedule.ts PlanInputs), as plain data. */
export interface PlanInputsData {
  readonly timing: { readonly cycle: number; readonly headways: HeadwaysData; readonly buses: number };
  readonly oneWayS: number;
  readonly pullOutS: number;
  readonly pullInS: number;
}

/** Why a command or a card said no, with the numbers its copy needs (src/ui turns the code into words). */
export interface RefusalView {
  readonly reason: string;
  /** Which click of a draft the refusal is about. */
  readonly at?: number;
  /** A count the refusal names, such as a name's longest length. */
  readonly limit?: number;
  readonly limitM?: number;
  /** How far the nearest thing in the way is, in metres. */
  readonly nearestM?: number;
  readonly limitSeconds?: number;
  readonly room?: number;
  readonly shortCents?: number;
}

/** The line tool's draft card (sim/rules/line.ts): what the clicks make, and whether Create may buy it. */
export interface LineDraftView {
  readonly stops: readonly { readonly at: LngLatPair; readonly joins: number | null }[];
  readonly route: readonly LngLatPair[];
  readonly routeM: number;
  readonly people: number;
  /** The walk the people count reads, in metres, for each stop's ring. */
  readonly walkM: number;
  readonly buses: number;
  readonly newStops: number;
  readonly stopsCents: number;
  readonly busesCents: number;
  readonly priceCents: number;
  readonly refusal: RefusalView | null;
}

export interface LineView {
  readonly id: number;
  readonly name: string;
  readonly colour: string;
  readonly stops: readonly LngLatPair[];
  /** The streets it drives, stop to stop. */
  readonly route: readonly LngLatPair[];
  readonly ridersPerDay: number;
  readonly headways: HeadwaysData;
  /** Its round trip in seconds, for the headway card's bus count. */
  readonly cycle: number;
  readonly buses: number;
  /** The one model the line runs (the M3 spec, item 2). */
  readonly model: BusModelId;
  /** Index in `route` of each stop. */
  readonly stopAt: readonly number[];
  /** Street metres from the first stop to each stop. */
  readonly stopDistM: readonly number[];
  /** The drives from the depot to the first stop and back; empty with no depot. */
  readonly pullOut: readonly LngLatPair[];
  readonly pullIn: readonly LngLatPair[];
  /** The day plan's inputs (sim/rules/schedule.ts): the page builds the same plan the costs bill, for the vehicle layer. */
  readonly plan: PlanInputsData;
  /** A day's fares and subsidy at the modelled riders, in cents: whole boardings, so about what the rows bank. */
  readonly incomeCents: number;
  /** A whole day's costs on today's timetable, in cents: what the day's rows for this line will be (I6). */
  readonly forecastCents: { readonly running: number; readonly wages: number; readonly deadhead: number };
}

export interface DepotView {
  readonly id: number;
  readonly at: LngLatPair;
}

/** The depot rule's verdict for a spot, as the cursor card reads it (sim/rules/depot.ts). */
export type DepotSiteView =
  | { readonly ok: true; readonly streetM: number; readonly priceCents: number }
  | { readonly ok: false; readonly reason: string; readonly limitM?: number; readonly nearestM?: number };

export interface Snapshot {
  /** Whole game-seconds since founding (05:00 on day 1). */
  readonly elapsed: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly speed: Speed;
  /** The company, unnamed until founded. */
  readonly company: { readonly name: string; readonly colour: string };
  /** Seconds since midnight of the game day, and game seconds per real second (0 paused): the vehicle layer runs the clock on between snapshots. */
  readonly secondOfDay: number;
  readonly rate: number;
  readonly cashCents: number;
  readonly ridersPerDay: number;
  /** Closed days whose running rows came out ahead (the checklist's "a day in profit"). */
  readonly profitableDays: number;
  /** Every line's forecast and every depot's upkeep for a whole day, in cents. */
  readonly costsPerDayCents: number;
  readonly lines: readonly LineView[];
  /** Changes whenever `lines` does, so the map redraws them only then (RN-04). */
  readonly linesVersion: number;
  readonly depots: readonly DepotView[];
}

/** Where people live and work: each cell's sub-points, weighted. */
export interface Dots {
  readonly homes: readonly [lon: number, lat: number, people: number][];
  readonly jobs: readonly [lon: number, lat: number, jobs: number][];
}

export interface DayCard {
  readonly day: number;
  readonly rows: readonly { readonly kind: string; readonly amountCents: number; readonly lineId: number | null }[];
  readonly cashBeforeCents: number;
  readonly cashAfterCents: number;
}

/** A write or removal in the page's save store, in order (the sim names its keys; the page only carries them out). */
export type StoreEffect = { readonly op: 'write'; readonly key: string; readonly value: string } | { readonly op: 'remove'; readonly key: string };

/** What became of the save a game started from: none, read, or set aside for a fresh start (D12). */
export type LoadView = 'none' | 'ok' | 'newer' | 'older' | 'unreadable' | 'other-city';

export type ToWorker =
  | { readonly type: 'init'; readonly simText: string; readonly city: CityRefData; readonly seed: number; readonly build: { readonly sha: string; readonly version: string } }
  /** The page's answer to read-save: the text under that key, or null. */
  | { readonly type: 'save-text'; readonly text: string | null }
  | { readonly type: 'speed'; readonly speed: Speed }
  | { readonly type: 'probe'; readonly id: number; readonly at: LngLatPair }
  | { readonly type: 'depot-site'; readonly id: number; readonly at: LngLatPair }
  | { readonly type: 'place-depot'; readonly at: LngLatPair }
  | { readonly type: 'found'; readonly name: string; readonly colour: string }
  | { readonly type: 'line-draft'; readonly id: number; readonly clicks: readonly LngLatPair[]; readonly headways?: HeadwaysData; readonly model?: BusModelId }
  | { readonly type: 'create-line'; readonly clicks: readonly LngLatPair[]; readonly headways?: HeadwaysData; readonly model?: BusModelId }
  | { readonly type: 'set-headways'; readonly lineId: number; readonly headways: HeadwaysData }
  | { readonly type: 'set-model'; readonly lineId: number; readonly model: BusModelId };

export type FromWorker =
  | {
      readonly type: 'ready';
      readonly dots: Dots;
      /** Where depots may stand, for the green tint: rings of [lon, lat]. */
      readonly depotLand: readonly (readonly LngLatPair[])[];
      readonly snapshot: Snapshot;
      readonly load: LoadView;
    }
  /** The sim asks for the save under its key before it starts. */
  | { readonly type: 'read-save'; readonly key: string }
  /** Saves and set-asides for the page to carry out, in order. */
  | { readonly type: 'store'; readonly effects: readonly StoreEffect[] }
  | { readonly type: 'snapshot'; readonly snapshot: Snapshot }
  | { readonly type: 'day-card'; readonly card: DayCard }
  | { readonly type: 'probe'; readonly id: number; readonly people: number }
  | { readonly type: 'depot-site'; readonly id: number; readonly site: DepotSiteView }
  | { readonly type: 'line-draft'; readonly id: number; readonly draft: LineDraftView }
  | ({ readonly type: 'refused'; readonly command: string } & RefusalView)
  | { readonly type: 'failed'; readonly problem: string };
