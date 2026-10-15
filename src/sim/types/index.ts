// What crosses between the sim worker and the page: the only sim module besides sim/rules that
// src/ui and src/render may import (CLAUDE.md "Architecture guardrails"). Plain data: anything here
// must survive structured cloning.
import type { ContractKind } from '../config/contracts';
import type { EventKind } from '../config/events';
import type { BusModelId } from '../config/fleet';
import type { MedalId } from '../config/medals';
import type { Medals } from '../rules/medal';

export type { BusModelId, MedalId, Medals };

export type LngLatPair = [lon: number, lat: number];

/** Paused, then five speeds from real time up (sim/rules/speed.ts SPEED_RATES). */
export type Speed = 0 | 1 | 2 | 3 | 4 | 5;

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

/** A line's round trip in each period, seconds (sim/rules/cycle.ts Cycles). */
export interface CyclesData {
  readonly peak: number;
  readonly offpeak: number;
  readonly overnight: number;
}

/** What a line's day plan is built from (sim/rules/schedule.ts PlanInputs), as plain data. */
export interface PlanInputsData {
  readonly timing: { readonly cycle: number; readonly cycles?: CyclesData; readonly headways: HeadwaysData; readonly buses: number };
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
/** A line being extended from one end (the M3 spec, item 14), or having a stop inserted (the M4 spec, item 4): the line tool's clicks go beyond that end, or its last click onto the line. */
export interface ExtendData {
  readonly lineId: number;
  readonly end: 'start' | 'end' | 'insert';
}

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
  /** Editing a route (D25): the line's stops it leaves that no other line calls at, which come down, and what they give back; null otherwise. */
  readonly edit: { readonly removed: readonly number[]; readonly refundCents: number } | null;
  /** Inserting a stop: the street metres it adds to its leg and that as a share of the leg, with a warning over 15% (sim/rules/route.ts); null otherwise. */
  readonly detour: { readonly addedM: number; readonly share: number; readonly warn: boolean } | null;
}

export interface LineView {
  readonly id: number;
  readonly name: string;
  readonly colour: string;
  readonly stops: readonly LngLatPair[];
  /** Each stop's id, in line order (Snapshot.stops). */
  readonly stopIds: readonly number[];
  /** The streets it drives, stop to stop. */
  readonly route: readonly LngLatPair[];
  readonly ridersPerDay: number;
  /** What a ride costs, $1.00–$5.00 (sim/rules/fare.ts). */
  readonly fareCents: number;
  /** Riders a day its full buses turn away (K27), and the minute of the day of the half-hour that turns away the most, or null when none are. */
  readonly turnedAwayPerDay: number;
  readonly fullAtMinute: number | null;
  readonly headways: HeadwaysData;
  /** Its round trip in seconds at the day's average traffic and in each period, for the headway card's bus count. */
  readonly cycle: number;
  readonly cycles: CyclesData;
  /** How much of the rush its route's streets take (sim/traffic/congestion.ts), for the model card's bus count. */
  readonly rush: number;
  /** Metres of its route through roadworks today (the M4 spec, item 2), which its round trips already count; 0 with none. */
  readonly worksM: number;
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
  /** While it settles after a change made in service, its earlier versions, so trips under way finish as they began; a line just drawn settles from a version that ran no bus, so its buses pull out of the depot (sim/rules/transition.ts). Null otherwise. */
  readonly settling: SettlingView | null;
}

/** A changed line's earlier versions, oldest first, in the frame of the day of its latest change: the page builds the same merged plan the costs bill. */
export interface SettlingView {
  /** The game day (Snapshot.day) whose midnight the frame counts from. */
  readonly frameDay: number;
  readonly earlier: readonly {
    readonly plan: PlanInputsData;
    /** The second of the frame from which the next version took the departures. */
    readonly until: number;
    readonly sameModel: boolean;
    readonly sameStart: boolean;
    /** Its streets, stops and depot drives, as LineView's. */
    readonly route: readonly LngLatPair[];
    readonly stopAt: readonly number[];
    readonly stopDistM: readonly number[];
    readonly pullOut: readonly LngLatPair[];
    readonly pullIn: readonly LngLatPair[];
  }[];
}

/** A stop's day over every line that calls there (sim/economy/stops.ts): QUIET under 5 boardings, LOSS under −$20. */
export interface StopView {
  readonly id: number;
  readonly at: LngLatPair;
  /** Sign 1 to Transfer Hub 5 (sim/rules/stopTier.ts). */
  readonly tier: number;
  /** The lines that call here. */
  readonly lineIds: readonly number[];
  readonly boardings: number;
  readonly alightings: number;
  /** Of the boardings, riders changing from another line, who paid there (the M3 spec, item 13). */
  readonly transfers: number;
  readonly netCents: number;
  readonly quiet: boolean;
  readonly loss: boolean;
}

export interface DepotView {
  readonly id: number;
  readonly at: LngLatPair;
}

/** The day's net at every fare a line may charge, and the fares within 5% of the best (sim/economy/fareBand.ts). */
export interface FareBandView {
  /** In the order of sim/rules/fare.ts FARES_CENTS. */
  readonly netCents: readonly number[];
  readonly bestCents: number;
  readonly fromCents: number;
  readonly toCents: number;
}

/** The depot rule's verdict for a spot, as the cursor card reads it (sim/rules/depot.ts). */
/** Where Place stop would put a stop (D25): the street it stands on and its price, or why not, naming a stop already standing near. */
export type StopSiteView =
  | { readonly ok: true; readonly at: LngLatPair; readonly streetM: number; readonly priceCents: number }
  | { readonly ok: false; readonly reason: string; readonly limitM?: number; readonly stopId?: number; readonly shortCents?: number };

export type DepotSiteView =
  | { readonly ok: true; readonly streetM: number; readonly priceCents: number }
  | { readonly ok: false; readonly reason: string; readonly limitM?: number; readonly nearestM?: number; readonly shortCents?: number; readonly priceCents?: number };

/** Every ledger row by kind for today, yesterday and this quarter, beside a day's forecast (sim/economy/finance.ts). */
export interface FinanceView {
  readonly day: number;
  readonly quarter: number;
  readonly quarterFirstDay: number;
  /** The starting cash, posted on Day 0 (D25). */
  readonly openingCents: number;
  /** The chart's days, oldest first, up to two quarters; today the last, so far (economy/finance.ts). */
  readonly days: readonly { readonly day: number; readonly inCents: number; readonly outCents: number; readonly capitalCents: number; readonly cashCents: number }[];
  /**
   * Each line's own money yesterday, its riders' fares and subsidy in and its running costs out; and a day's costs on
   * today's timetable (on the day it was drawn, from its first drive out), positive, worked out with the forecast column
   * they add up to: what the day's rows for it will be (I6). Its fares and subsidy in that column, in whole paid boardings,
   * so about what the rows bank: on the day it was drawn, from the hour it was drawn, the whole of that clock hour.
   */
  readonly lines: readonly {
    readonly id: number;
    readonly yesterdayInCents: number;
    readonly yesterdayOutCents: number;
    readonly incomeCents: number;
    readonly forecastCents: { readonly running: number; readonly wages: number; readonly deadhead: number };
  }[];
  readonly rows: readonly {
    readonly kind: string;
    readonly todayCents: number;
    readonly yesterdayCents: number;
    readonly quarterCents: number;
    /** Null for a row no day plans: capital, a contract's reward, the report card, the opening. */
    readonly forecastCents: number | null;
  }[];
}

export interface Snapshot {
  /** Whole game-seconds since founding (05:00 on day 1). */
  readonly elapsed: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly speed: Speed;
  /** The company, unnamed until founded. */
  readonly company: { readonly name: string; readonly colour: string };
  /** Seconds since midnight of the game day, with the part-step run so far, and game seconds per real second (0 paused): the vehicle layer runs the clock on between snapshots. */
  readonly secondOfDay: number;
  readonly rate: number;
  readonly cashCents: number;
  readonly ridersPerDay: number;
  /** Closed days whose running rows came out ahead, those older than Finance's two quarters counting once at most (economy/ledger.ts foldDays): the checklist's "a day in profit", which reads only whether there is one. */
  readonly profitableDays: number;
  /** A day's running costs as Finance forecasts them, in cents (a line drawn today from its first drive out): every line's, every depot's and stop's upkeep, and the interest while owing. */
  readonly costsPerDayCents: number;
  readonly lines: readonly LineView[];
  /** Every stop standing, with its day; changes with `lines`. */
  readonly stops: readonly StopView[];
  /** Changes whenever `lines` and `stops` do, so the map redraws them only then (RN-04). */
  readonly linesVersion: number;
  readonly depots: readonly DepotView[];
  /** The Finance panel's table; changes when a row is posted or the network changes. */
  readonly finance: FinanceView;
  /** While paused, the command an undo would take back, such as create-line "Line 2" (sim/undo.ts); null otherwise. */
  readonly undo: { readonly command: string; readonly subject: string } | null;
  /** Below the credit line's −$150k, or counting closes below it: day closes left before the run ends, and whether it has (D10); null otherwise. */
  readonly floor: { readonly closesLeft: number; readonly ended: boolean } | null;
  /** Contracts on offer and held, at most three (the M3 spec, item 11; the M4 spec, item 1). */
  readonly contracts: readonly ContractView[];
  /** A contract has been taken, held now or paid: the checklist's last step. */
  readonly contractTaken: boolean;
  /** The city event pending or on (the M4 spec, item 2), or null. */
  readonly event: EventView | null;
  /** The day each medal was awarded, or null (the M4 spec, item 3; sim/rules/medal.ts). */
  readonly medals: Medals;
  /** Trips carried since founding, toward silver. */
  readonly tripsCarried: number;
}

/** A city event for its marker on the map and the line card (sim/rules/event.ts). */
export interface EventView {
  readonly kind: EventKind;
  /** Pending the day it is rolled, hatched on the map; on from its first day to its last, solid. */
  readonly phase: 'pending' | 'on';
  readonly street: string;
  readonly startDay: number;
  readonly endDay: number;
  /** Days still on, today included; all of them while pending. */
  readonly daysLeft: number;
  /** The stretch of street, one line of [lon, lat] per street piece. */
  readonly path: readonly (readonly LngLatPair[])[];
  /** Where its words sit: the middle of the stretch's longest piece. */
  readonly at: LngLatPair;
}

/** A contract for its card and its ring on the map (sim/economy/contracts.ts, sim/rules/contract.ts). */
export interface ContractView {
  readonly id: number;
  readonly landmark: string;
  /** The landmark, as longitude and latitude. */
  readonly at: readonly [number, number];
  /** The walk a stop must be within to count, in metres. */
  readonly reachM: number;
  /** HEADWAY: a bus at least every `ask` seconds; RIDERSHIP: at least `ask` paid boardings a day (sim/config/contracts.ts). */
  readonly kind: ContractKind;
  readonly ask: number;
  readonly rewardCents: number;
  readonly held: boolean;
  /** Days in a row met so far, of `daysNeeded`. */
  readonly daysMet: number;
  readonly daysNeeded: number;
  /** Days left to hold it, today included; null while it is an offer. */
  readonly daysLeft: number | null;
  /** Today's figure: HEADWAY's headway at the landmark's best stop, the slower of peak and off-peak, or RIDERSHIP's paid boardings a day at its stops; null if no stop in reach counts. */
  readonly figure: number | null;
  /** The rule's verdict on that figure: met now. */
  readonly met: boolean;
  /** No service hour today has missed it yet. */
  readonly onTrack: boolean;
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
  /** On a quarter's last day, its report card (sim/economy/reportCard.ts): four grades 0–100, the overall, and what it pays or fines. */
  readonly report: {
    readonly quarter: number;
    readonly coverage: number;
    readonly reliability: number;
    readonly comfort: number;
    readonly money: number;
    readonly overall: number;
    readonly payoutCents: number;
  } | null;
  /** Contracts paid or lapsed at this close. */
  readonly contracts: readonly { readonly landmark: string; readonly kind: ContractKind; readonly ask: number; readonly rewardCents: number; readonly outcome: 'paid' | 'lapsed' }[];
  /** The notices of city events (the M4 spec, item 2): one rolled at this close, which starts tomorrow, and one whose last day this was. */
  readonly events: readonly { readonly kind: EventKind; readonly street: string; readonly days: number; readonly news: 'tomorrow' | 'over' }[];
  /** Medals awarded at this close, bronze first (the M4 spec, item 3). */
  readonly medals: readonly MedalId[];
}

/** A write or removal in the page's save store, in order (the sim names its keys; the page only carries them out). */
export type StoreEffect = { readonly op: 'write'; readonly key: string; readonly value: string } | { readonly op: 'remove'; readonly key: string };

/** A save in a line (sim/save/save.ts aboutSave). */
export interface SaveAbout {
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly company: string;
  readonly cashCents: number;
  readonly lines: number;
  readonly buses: number;
  /** When it was saved, in milliseconds since 1970 by the page's clock; null for a save written before the time was kept. */
  readonly savedAt: number | null;
}

/** A save slot: empty, a save the game can read, or one it cannot. */
export interface SlotView {
  readonly slot: number;
  readonly about: SaveAbout | null;
  readonly readable: boolean;
  /** Why the game cannot load the slot, named as a set-aside save is (a save from an older build, say); only on such a slot. */
  readonly why?: SetAsideWhy;
}

/** Why a save was set aside under its backup key (D12, DP-06): it is kept until the player exports or deletes it. */
/** Why a save was set aside. A save from an older build keeps its format in its key (`older-14`), so a later format change never writes over it; plain `older` is a backup made before that. `off-street` is this city's save from another bake whose stops found no street on this one. */
export type SetAsideWhy = 'older' | `older-${number}` | 'newer' | 'unreadable' | 'other-city' | 'off-street';

/**
 * What became of the save a game started from: none, read, read onto another bake of the map with
 * its stops on the new streets, or set aside for a fresh start (D12), including one whose stops
 * found no street on the new bake.
 */
export type LoadView = 'none' | 'ok' | 'rebaked' | 'newer' | 'older' | 'unreadable' | 'other-city' | 'off-street';

export type ToWorker =
  | { readonly type: 'init'; readonly simText: string; readonly city: CityRefData; readonly seed: number; readonly build: { readonly sha: string; readonly version: string } }
  /** The page's answer to read-save: the text under that key, or null. */
  | { readonly type: 'save-text'; readonly text: string | null }
  | { readonly type: 'speed'; readonly speed: Speed }
  /** How many live (a home dot) or work (a job dot) within a walk of `at`. */
  | { readonly type: 'probe'; readonly id: number; readonly at: LngLatPair; readonly kind: 'home' | 'job' }
  | { readonly type: 'depot-site'; readonly id: number; readonly at: LngLatPair }
  | { readonly type: 'place-depot'; readonly at: LngLatPair }
  /** Place stop (D25): where a stop would stand, and placing it; taking down a stop no line calls at. */
  | { readonly type: 'stop-site'; readonly id: number; readonly at: LngLatPair }
  | { readonly type: 'place-stop'; readonly at: LngLatPair }
  | { readonly type: 'take-down-stop'; readonly stopId: number }
  | { readonly type: 'found'; readonly name: string; readonly colour: string }
  /** A draft's card: a new line's clicks, an extension's, or with `route`, a line's whole route as the editor has it (D25). */
  | { readonly type: 'line-draft'; readonly id: number; readonly clicks: readonly LngLatPair[]; readonly headways?: HeadwaysData; readonly model?: BusModelId; readonly extend?: ExtendData; readonly route?: number }
  /** Sets a line's whole route: each point a stop standing, which it joins, or a click for a new one (D25). */
  | { readonly type: 'set-route'; readonly lineId: number; readonly points: readonly LngLatPair[] }
  | { readonly type: 'extend-line'; readonly lineId: number; readonly end: 'start' | 'end'; readonly clicks: readonly LngLatPair[] }
  /** Inserts a stop where the click is, into the leg of the line nearest it (the M4 spec, item 4). */
  | { readonly type: 'insert-stop'; readonly lineId: number; readonly at: LngLatPair }
  | { readonly type: 'create-line'; readonly clicks: readonly LngLatPair[]; readonly headways?: HeadwaysData; readonly model?: BusModelId }
  | { readonly type: 'set-headways'; readonly lineId: number; readonly headways: HeadwaysData }
  | { readonly type: 'set-model'; readonly lineId: number; readonly model: BusModelId }
  | { readonly type: 'set-fare'; readonly lineId: number; readonly fareCents: number }
  | { readonly type: 'set-stop-tier'; readonly stopId: number; readonly tier: number }
  | { readonly type: 'remove-stop'; readonly lineId: number; readonly stopId: number }
  /** Takes back the newest command taken while paused (I9). */
  | { readonly type: 'undo' }
  /** The page's answer to read-keys: each key's text, in order, or null. */
  | { readonly type: 'key-texts'; readonly id: number; readonly texts: readonly (string | null)[] }
  /** The page's store refused the game's own saves it was given (`owed`; a full disk, blocked site data), under these keys: the sim owes the autosave if its key is one, and the quarter's start it holds if that key is, and writes them after the next delete in Saves. */
  | { readonly type: 'store-refused'; readonly keys: readonly string[] }
  /** Saves (the M3 spec, item 8): list the slots, save into one, load one, load a file's text, or hand over this game as a file. */
  | { readonly type: 'slots' }
  | { readonly type: 'save-slot'; readonly slot: number }
  | { readonly type: 'load-slot'; readonly slot: number }
  | { readonly type: 'import'; readonly text: string }
  | { readonly type: 'export' }
  /** Empties a slot (the M5 spec, item 4); the page asks first. */
  | { readonly type: 'delete-slot'; readonly slot: number }
  /** Hands over a set-aside save as a file, or deletes it (the page asks first). */
  | { readonly type: 'export-set-aside'; readonly why: SetAsideWhy }
  /** Hands over what a slot holds as a file, even a save this game cannot load (D12: never lost unseen). */
  | { readonly type: 'export-slot'; readonly slot: number }
  | { readonly type: 'delete-set-aside'; readonly why: SetAsideWhy }
  /** The save the start could not set aside, still under the live key: hand it over as a file, or let the game save over it (the page asks first). */
  | { readonly type: 'export-unbacked' }
  | { readonly type: 'delete-unbacked' }
  /** Home's New game (the M5 spec, item 3): a new, unnamed company in place of this game, its autosave replaced; slots stay. */
  | { readonly type: 'new-game' }
  /** Reopens the save written as this quarter began (the failure floor's Restart this quarter). */
  | { readonly type: 'restart-quarter' }
  /** Takes a contract on offer. */
  | { readonly type: 'accept-contract'; readonly contractId: number }
  /** This session as a file: the save it began from and every command since (Export session). */
  | { readonly type: 'export-session' }
  /** Asks for a line's fare band, for its open card. */
  | { readonly type: 'fare-band'; readonly id: number; readonly lineId: number };

export type FromWorker =
  | {
      readonly type: 'ready';
      readonly dots: Dots;
      /** Where depots may stand, for the green tint: rings of [lon, lat]. */
      readonly depotLand: readonly (readonly LngLatPair[])[];
      readonly snapshot: Snapshot;
      readonly load: LoadView;
      /** The save `load` names is being set aside: its backup has yet to read back, and 'unbacked' says whether it did. */
      readonly checking?: true;
    }
  /** The sim asks for the save under its key before it starts. */
  | { readonly type: 'read-save'; readonly key: string }
  /**
   * Saves and set-asides for the page to carry out, in order. A failure of the start's set-aside (`setAside`) is said by
   * 'unbacked', not as a browser keeping no saves. `owed` marks the game's own saves, the autosave and the quarter's start:
   * one refused, the sim owes it ('store-refused') and Saves says the browser isn't keeping saves until it is kept. A Save
   * here refused is said once, its slot's row showing it did not land.
   */
  | { readonly type: 'store'; readonly effects: readonly StoreEffect[]; readonly setAside?: true; readonly owed?: true }
  /** The sim asks for these keys' texts, after every store effect posted before it. */
  | { readonly type: 'read-keys'; readonly id: number; readonly keys: readonly string[] }
  /** The slots, the set-aside saves, and the autosave as kept (null when none is). */
  | { readonly type: 'slots'; readonly slots: readonly SlotView[]; readonly setAside: readonly SetAsideWhy[]; readonly autosave: SaveAbout | null }
  /** This game as a save file, for the page to hand to the player. */
  | { readonly type: 'export'; readonly name: string; readonly text: string }
  /**
   * Whether the start's set-aside save was kept, once its backup reads back: null when it was; why
   * it was refused when it was not, when it stays under the live key and the game saves nothing over
   * it; null again once the player deletes it, after the slots listed with the save owed meanwhile.
   */
  | { readonly type: 'unbacked'; readonly why: SetAsideWhy | null }
  /** A slot or a file became the game; refusals come as 'refused' and leave the game as it was. */
  | { readonly type: 'loaded'; readonly from: 'slot' | 'file' | 'quarter' | 'new'; readonly load: LoadView }
  | { readonly type: 'snapshot'; readonly snapshot: Snapshot }
  | { readonly type: 'day-card'; readonly card: DayCard }
  /** People (a home probe) or jobs (a job probe) within a walk. */
  | { readonly type: 'probe'; readonly id: number; readonly within: number }
  | { readonly type: 'depot-site'; readonly id: number; readonly site: DepotSiteView }
  | { readonly type: 'stop-site'; readonly id: number; readonly site: StopSiteView }
  | { readonly type: 'line-draft'; readonly id: number; readonly draft: LineDraftView }
  /** Null for a line that runs no buses. */
  | { readonly type: 'fare-band'; readonly id: number; readonly lineId: number; readonly band: FareBandView | null }
  | ({ readonly type: 'refused'; readonly command: string } & RefusalView)
  /** An undo took a command back (its snapshot follows): with an undo's refusal, every undo has its answer, so the page knows which were done. */
  | { readonly type: 'undone' }
  | { readonly type: 'failed'; readonly problem: string };
