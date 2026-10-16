// The sim's host inside its worker (PLAN §6): it owns the World, runs simStep on a fixed step at
// the chosen speed, applies commands between steps, and posts snapshots about 10 times a second
// while time runs, none while paused (I14). The page never computes a game number (AR-04).
// It starts from the page's save when there is a readable one, and hands the page a fresh save after
// every command, at every change of speed and every game hour, for src/platform's store to keep
// (a worker has no localStorage). Plain logic with an injected clock, so tests drive it without a
// real Worker.
import { createLine } from '../sim/commands/createLine';
import { found } from '../sim/commands/found';
import { placeDepot } from '../sim/commands/placeDepot';
import { setHeadways } from '../sim/commands/setHeadways';
import { setFare } from '../sim/commands/setFare';
import { setModel } from '../sim/commands/setModel';
import { setStopTier } from '../sim/commands/setStopTier';
import { removeStop } from '../sim/commands/removeStop';
import { extendLine } from '../sim/commands/extendLine';
import { insertStop } from '../sim/commands/insertStop';
import { placeStop } from '../sim/commands/placeStop';
import { routeVerdict, setRoute } from '../sim/commands/setRoute';
import { takeDownStop } from '../sim/commands/takeDownStop';
import { checkExtend, checkInsert } from '../sim/rules/route';
import { checkPlaceStop } from '../sim/rules/stop';
import { BUS_MODELS, type BusModelId } from '../sim/config/fleet';
import { loadCity, type City } from '../sim/city/simfile';
import { MAX_WALK_M } from '../sim/config/demand';
import { FOUNDING_HEADWAYS } from '../sim/config/lines';
import { SECONDS_PER_DAY, START_SECOND_OF_DAY, STEP_SECONDS } from '../sim/config/time';
import { toCalendarTime } from '../sim/core/calendar';
import { toLngLat, toXY, type XY } from '../sim/core/geo';
import { FESTIVAL_RADIUS_M } from '../sim/config/events';
import { fareBand } from '../sim/economy/fareBand';
import { finance, runningCostsCents, type Finance } from '../sim/economy/finance';
import { stopDays } from '../sim/economy/stops';
import { profitableDays } from '../sim/economy/ledger';
import type { ContractId, LineId, StopId } from '../sim/core/ids';
import { jobsWithinWalk, peopleNearStops, peopleWithinWalk } from '../sim/rules/catchment';
import { COMPANY_COLOURS } from '../sim/rules/company';
import { checkDepotSite } from '../sim/rules/depot';
import { checkLineDraft, type LineDraft } from '../sim/rules/line';
import { rebase } from '../sim/save/rebase';
import { aboutSave, backupKey, decode, encode, fromSaveData, quarterKey, SAVE_SLOTS, saveKey, SET_ASIDE, slotKey, stateHash, type LoadOutcome } from '../sim/save/save';
import { belowFloor, FAILURE_CLOSES, runEnded } from '../sim/rules/credit';
import { acceptContract } from '../sim/commands/acceptContract';
import { CONTRACT_DAYS, CONTRACT_REACH_M } from '../sim/config/contracts';
import { landmarkFigures } from '../sim/economy/contracts';
import { contractDaysLeft, contractMet } from '../sim/rules/contract';
import { eventDaysLeft, eventPhase } from '../sim/rules/event';
import { newGame, type CityEvent, type CityRef, type EarlierRun } from '../sim/state';
import { simStep } from '../sim/step';
import { before, newUndo, nextUndo, remember, timeRuns, undo, type UndoLabel } from '../sim/undo';
import type { ContractView, DayCard, DepotSiteView, StopSiteView, Dots, EventView, ExtendData, SettlingView, FromWorker, HeadwaysData, LineDraftView, LineView, LngLatPair, LoadView, RefusalView, SetAsideWhy, SlotView, Snapshot, Speed, StopView, ToWorker } from '../sim/types';
import { createWorld, depotSiteContext, legBetween, lineDraftContext, nearestNode, type Settling, type World } from '../sim/world';
import { DEPOT_STREET_REACH_M } from '../sim/config/depots';
import { SPEED_RATES } from '../sim/rules/speed';

/** Game-seconds per real second at each speed: 1x is real time (sim/rules/speed.ts; D25). */
export const SPEEDS: Readonly<Record<Speed, number>> = SPEED_RATES;
/** A slice of real time longer than this (a tab in the background) runs as this long, so the game never leaps days. */
export const MAX_SLICE_MS = 250;
export const SNAPSHOT_EVERY_MS = 100;
/** While time runs, the game saves at each new game hour and at least this often by the real clock: at 1x a game hour is a real one (D25). */
export const SAVE_EVERY_MS = 30_000;

export interface Host {
  handle(message: ToWorker): void;
  /** Called on a timer with the real clock in milliseconds. */
  tick(nowMs: number): void;
  /** Steps the game to `elapsed` as ticks would, stopping early if the run ends (a session's replay). */
  advanceTo(elapsed: number): void;
  /** The game's fingerprint (save.ts stateHash), or null before a game is playing. */
  stateHash(): string | null;
}

/** Export session (the M3 spec, item 12; AR-06): a save, the speed at that moment, and every command since, each at the game second it ran. */
export interface SessionFile {
  readonly kind: 'interbus-session';
  readonly format: 1;
  readonly build: { readonly sha: string; readonly version: string };
  readonly city: CityRef;
  readonly start: string;
  readonly speed: Speed;
  readonly commands: readonly { readonly at: number; readonly message: ToWorker }[];
  /** Where the export was taken: the game second and the game's fingerprint there. */
  readonly end: { readonly elapsed: number; readonly hash: string };
}

/** Commands a session records: everything that changes the game or what undo would do. Loads and restarts begin a new session instead. */
const SESSION_COMMANDS: ReadonlySet<ToWorker['type']> = new Set([
  'speed',
  'place-depot',
  'place-stop',
  'take-down-stop',
  'create-line',
  'set-headways',
  'set-model',
  'set-fare',
  'set-stop-tier',
  'remove-stop',
  'extend-line',
  'insert-stop',
  'set-route',
  'accept-contract',
  'undo',
]);

/** Appends the streets from node `from` to node `to` to `route` as [lon, lat] points. */
function appendPath(world: World, from: number | null, to: number | null, route: LngLatPair[]): void {
  const { city } = world;
  const path = from === null || to === null ? null : world.router.route(from, to);
  path?.edges.forEach((e, i) => {
    const street = city.streets[e]!;
    // Edge i of a path leaves path.nodes[i]; the street's points run from edgeA to edgeB.
    const pts = city.graph.edgeA[e] === path.nodes[i] ? street.points : [...street.points].reverse();
    for (const p of route.length ? pts.slice(1) : pts) route.push([...toLngLat(city.frame, p as XY)] as LngLatPair);
  });
}

/** The streets a bus drives through `stops` (frame metres), as [lon, lat] points, and where each stop falls in them. */
function routeOf(world: World, stops: readonly XY[]): { route: LngLatPair[]; stopAt: number[] } {
  const route: LngLatPair[] = [];
  const stopAt = [0];
  for (let k = 1; k < stops.length; k++) {
    appendPath(world, nearestNode(world, stops[k - 1]!), nearestNode(world, stops[k]!), route);
    stopAt.push(Math.max(0, route.length - 1));
  }
  return { route, stopAt };
}

/** The drive between a depot's node and a stop, as [lon, lat] points; empty when there is none. */
function driveOf(world: World, from: number | null, to: number | null): LngLatPair[] {
  const out: LngLatPair[] = [];
  appendPath(world, from, to, out);
  return out.length > 1 ? out : [];
}

function lineViews(world: World): LineView[] {
  const { city, state } = world;
  const kept = routedRuns.get(world);
  const routed = new Map<string, RoutedRun>();
  const views = state.lines.map((line): LineView => {
    const stops = line.stopIds.map((id) => state.stops.find((s) => s.id === id)!).map((s) => [s.lon, s.lat] as [number, number]);
    const service = world.services.get(line.id);
    const xy = stops.map((p) => toXY(city.frame, p));
    const { route, stopAt } = routeOf(world, xy);
    const first = xy.length ? nearestNode(world, xy[0]!) : null;
    const depotNode = service?.depotNode ?? null;
    const demand = world.assignment.lines.get(line.id);
    return {
      id: line.id,
      name: line.name,
      colour: line.colour,
      stops,
      stopIds: [...line.stopIds],
      route,
      stopAt,
      stopDistM: service?.plan.stopDistM ?? [],
      pullOut: driveOf(world, depotNode, first),
      pullIn: driveOf(world, first, depotNode),
      plan: service ? service.day.inputs : { timing: { cycle: 0, headways: line.headways, buses: 0 }, oneWayS: 0, pullOutS: 0, pullInS: 0 },
      settling: service?.settling ? settlingView(world, service.settling, line.earlier ?? [], kept, routed) : null,
      ridersPerDay: demand?.perDay ?? 0,
      fareCents: line.fareCents,
      turnedAwayPerDay: demand?.shedPerDay ?? 0,
      // Each slot is a half-hour.
      fullAtMinute: demand && demand.fullSlot !== null ? demand.fullSlot * 30 : null,
      headways: line.headways,
      cycle: service?.timing.cycle ?? 0,
      cycles: service?.timing.cycles ?? { peak: 0, offpeak: 0, overnight: 0 },
      rush: service?.plan.rush ?? 0,
      worksM: service?.plan.worksM ?? 0,
      buses: line.buses,
      model: line.model,
    };
  });
  routedRuns.set(world, routed);
  return views;
}

/** A version's streets, stops and depot drives, as settlingView routes them. */
type RoutedRun = Pick<SettlingView['earlier'][number], 'route' | 'stopAt' | 'stopDistM' | 'pullOut' | 'pullIn'>;

/**
 * Each kept version's streets by its stops and depot, carried from one refresh of the line views to
 * the next only while a line still keeps a version on them. A line changed through a day keeps every
 * version it ran that day (world.ts recomputeInService), most on the same streets; routing
 * each afresh at every refresh made each change on Inner Boston about 5 ms slower than the last, past
 * I14's 150 ms by the 24th (`npm run bench jumps`).
 */
const routedRuns = new WeakMap<World, Map<string, RoutedRun>>();

/** A settling line's earlier versions with their streets and depot drives, for the vehicle layer (the M4 spec, item 4). */
function settlingView(world: World, settling: Settling, runs: readonly EarlierRun[], kept: ReadonlyMap<string, RoutedRun> | undefined, routed: Map<string, RoutedRun>): SettlingView {
  return {
    frameDay: settling.frameDay,
    earlier: settling.earlier.map((e, k) => {
      const run = runs[k]!;
      const key = JSON.stringify([run.stops.map((p) => [p.lon, p.lat]), run.depot && [run.depot.lon, run.depot.lat]]);
      const streets = routed.get(key) ?? kept?.get(key) ?? routeRun(world, run);
      routed.set(key, streets);
      return { plan: e.inputs, until: e.until, sameModel: e.sameModel, sameStart: e.sameStart, ...streets };
    }),
  };
}

function routeRun(world: World, run: EarlierRun): RoutedRun {
  const xy = run.stops.map((p) => toXY(world.city.frame, [p.lon, p.lat]));
  const { route, stopAt } = routeOf(world, xy);
  const stopDistM = [0];
  for (let i = 1; i < xy.length; i++) stopDistM.push(stopDistM[i - 1]! + (legBetween(world, xy[i - 1]!, xy[i]!)?.m ?? 0));
  const first = xy.length ? nearestNode(world, xy[0]!) : null;
  const at = run.depot ? toXY(world.city.frame, [run.depot.lon, run.depot.lat]) : null;
  const depot = at ? (world.nodes.nearest(at, DEPOT_STREET_REACH_M)?.item ?? nearestNode(world, at)) : null;
  return { route, stopAt, stopDistM, pullOut: driveOf(world, depot, first), pullIn: driveOf(world, first, depot) };
}

/** The city event pending or on (the M4 spec, item 2) for its marker, or null. */
function eventView(world: World, event: CityEvent | null, day: number): EventView | null {
  if (!event) return null;
  const phase = eventPhase(event, day);
  if (phase === 'over') return null;
  const { city } = world;
  const lngLat = (p: XY) => [...toLngLat(city.frame, p)] as LngLatPair;
  const base = { kind: event.kind, phase, street: event.street, startDay: event.startDay, endDay: event.endDay, daysLeft: eventDaysLeft(event, day) };
  if (event.kind === 'festival' && event.at) {
    // The reach it draws riders from, as a ring round its stop, its words at the stop.
    const c = toXY(city.frame, [event.at.lon, event.at.lat]);
    const ring = Array.from({ length: 49 }, (_, k) => lngLat([c[0] + FESTIVAL_RADIUS_M * Math.cos((2 * Math.PI * (k % 48)) / 48), c[1] + FESTIVAL_RADIUS_M * Math.sin((2 * Math.PI * (k % 48)) / 48)]));
    return { ...base, path: [ring], at: [event.at.lon, event.at.lat] };
  }
  if (event.kind === 'snow') {
    // Over the whole city: no shape, its words amid the company's stops.
    const stops = world.state.stops.map((s) => toXY(city.frame, [s.lon, s.lat]));
    const mid: XY = stops.length ? [stops.reduce((x, p) => x + p[0], 0) / stops.length, stops.reduce((y, p) => y + p[1], 0) / stops.length] : [0, 0];
    return { ...base, path: [], at: lngLat(mid) };
  }
  const pieces = event.edges.map((e) => city.streets[e]?.points ?? []).filter((pts) => pts.length > 1);
  const path = pieces.map((pts) => pts.map((p) => lngLat(p as XY)));
  // Its words sit at the middle point of its longest piece.
  const longest = path.reduce<readonly LngLatPair[]>((best, p) => (p.length > best.length ? p : best), []);
  return { ...base, path, at: longest[Math.floor(longest.length / 2)] ?? [0, 0] };
}

/** The day card's event notices: the event rolled at this close and the one whose last day it was. */
function eventNews(rolled: CityEvent | null, ended: CityEvent | null): DayCard['events'] {
  const one = (e: CityEvent, news: 'tomorrow' | 'over') => ({ kind: e.kind, street: e.street, days: e.endDay - e.startDay + 1, news });
  return [...(ended ? [one(ended, 'over')] : []), ...(rolled ? [one(rolled, 'tomorrow')] : [])];
}

/** Every stop standing and its day (the M3 spec, item 5). */
function stopViews(world: World): StopView[] {
  const days = new Map(stopDays(world).map((d) => [d.id, d]));
  return world.state.stops.map((s) => {
    const day = days.get(s.id)!;
    return {
      id: s.id,
      at: [s.lon, s.lat],
      tier: s.tier,
      lineIds: world.state.lines.filter((l) => l.stopIds.includes(s.id)).map((l) => l.id),
      boardings: day.boardings,
      alightings: day.alightings,
      transfers: day.transfers,
      netCents: day.netCents,
      quiet: day.quiet,
      loss: day.loss,
    };
  });
}

/** The draft card for a list of clicks: the line rule's verdict and what it resolved. */
function draftView(world: World, clicks: readonly LngLatPair[], headways: HeadwaysData, model: BusModelId): LineDraftView {
  const verdict = checkLineDraft(lineDraftContext(world), clicks.map((c) => toXY(world.city.frame, c)), headways, BUS_MODELS[model]);
  return viewOfDraft(world, verdict.draft, verdict.draft.buses, verdict.ok ? null : refusalView(verdict));
}

/** The draft card for a line extended by these clicks (the M3 spec, item 14): the whole line as it would run, priced at what the extension adds. */
function extendDraftView(world: World, extend: ExtendData, clicks: readonly LngLatPair[]): LineDraftView {
  const line = world.state.lines.find((l) => l.id === extend.lineId);
  const stops = (line?.stopIds ?? []).map((id) => {
    const stop = world.state.stops.find((s) => s.id === id)!;
    return toXY(world.city.frame, [stop.lon, stop.lat]);
  });
  const model = BUS_MODELS[line?.model ?? 'sparrow'];
  const shape = { stops, buses: line?.buses ?? 0, headways: line?.headways ?? FOUNDING_HEADWAYS, model };
  const last = clicks[clicks.length - 1];
  // Inserting (the M4 spec, item 4): the last click goes into the leg of the line nearest it.
  if (extend.end === 'insert' && last) {
    const verdict = checkInsert(lineDraftContext(world), shape, toXY(world.city.frame, last));
    const refusal = !line ? { reason: 'no_such_line' } : verdict.ok ? null : refusalView(verdict);
    return viewOfDraft(world, verdict.draft, verdict.extraBuses, refusal, { addedM: Math.round(verdict.detourM), share: verdict.detourShare, warn: verdict.warn });
  }
  const verdict = checkExtend(lineDraftContext(world), shape, extend.end === 'insert' ? 'end' : extend.end, extend.end === 'insert' ? [] : clicks.map((c) => toXY(world.city.frame, c)));
  const refusal = !line ? { reason: 'no_such_line' } : verdict.ok ? null : refusalView(verdict);
  return viewOfDraft(world, verdict.draft, verdict.extraBuses, refusal);
}

/** The editor's card for a line's whole route (D25): the line as it would run, priced at what the edit adds, with the stops it takes down. */
function routeDraftView(world: World, lineId: number, points: readonly LngLatPair[]): LineDraftView {
  const verdict = routeVerdict(world, lineId as LineId, points);
  if (!verdict) return { ...draftView(world, points, FOUNDING_HEADWAYS, 'sparrow'), refusal: { reason: 'no_such_line' } };
  const refusal = verdict.ok ? null : refusalView(verdict);
  return viewOfDraft(world, verdict.draft, verdict.extraBuses, refusal, null, { removed: verdict.removed.map((r) => r.stopId), refundCents: verdict.refundCents });
}

function viewOfDraft(world: World, draft: LineDraft, buses: number, refusal: RefusalView | null, detour: LineDraftView['detour'] = null, edit: LineDraftView['edit'] = null): LineDraftView {
  const stops = draft.stops.map((s) => s.at);
  return {
    stops: draft.stops.map((s) => ({ at: [...toLngLat(world.city.frame, s.at)] as LngLatPair, joins: s.kind === 'join' ? s.stopId : null })),
    route: routeOf(world, stops).route,
    routeM: Math.round(draft.routeM),
    people: peopleNearStops(world.city, stops),
    walkM: MAX_WALK_M,
    buses,
    newStops: draft.newStops,
    stopsCents: draft.stopsCents,
    busesCents: draft.busesCents,
    priceCents: draft.priceCents,
    refusal,
    edit,
    detour,
  };
}

/** A refusal's code and numbers, without anything else the verdict carried. */
function refusalView(r: { reason: string; at?: number; limit?: number; limitM?: number; nearestM?: number; limitSeconds?: number; room?: number; shortCents?: number }): RefusalView {
  const view: { -readonly [K in keyof RefusalView]: RefusalView[K] } = { reason: r.reason };
  for (const key of ['at', 'limit', 'limitM', 'nearestM', 'limitSeconds', 'room', 'shortCents'] as const) if (r[key] !== undefined) view[key] = Math.round(r[key]);
  return view;
}

function dotsOf(city: City): Dots {
  const at = (x: number, y: number) => toLngLat(city.frame, [x, y]);
  return {
    homes: city.cells.flatMap((c) => c.homes.map((p) => [...at(p.x, p.y), p.w] as [number, number, number])),
    jobs: city.cells.flatMap((c) => c.work.map((p) => [...at(p.x, p.y), p.w] as [number, number, number])),
  };
}

function depotLandOf(city: City): LngLatPair[][] {
  return city.depotLand.map((ring) => ring.map((p) => [...toLngLat(city.frame, p)] as LngLatPair));
}

/** Why a save this game cannot play is refused, as its backup key and Saves name it (D12): another bake's only when its stops miss this one's streets. */
function refusedAs(result: LoadOutcome): SetAsideWhy {
  if (result.outcome === 'older') return `older-${result.format}`;
  if (result.outcome === 'rebaked') return 'off-street';
  return result.outcome === 'newer' || result.outcome === 'other-city' ? result.outcome : 'unreadable';
}

/**
 * `now` is the page's clock in milliseconds since 1970, which stamps each save's time for the Saves
 * panel (the M5 spec, item 4); without it saves carry no time. It never reaches the sim.
 */
export function createHost(post: (message: FromWorker) => void, now?: () => number): Host {
  let world: World | null = null;
  // The city loaded, waiting for the page's save.
  let pending: { city: City; ref: CityRef; seed: number } | null = null;
  // The city and bake the running game plays on, for saves loaded from a slot or a file.
  let playing: { city: City; ref: CityRef } | null = null;
  // The seed a new game in this city starts from: the page's, at init.
  let gameSeed = 1;
  // Keys the sim asked the page to read, by request id.
  const reads = new Map<number, (texts: readonly (string | null)[]) => void>();
  let nextRead = 1;
  const readKeys = (keys: readonly string[], then: (texts: readonly (string | null)[]) => void) => {
    const id = nextRead++;
    reads.set(id, then);
    post({ type: 'read-keys', id, keys });
  };
  let build = { sha: '', version: '' };
  let key = '';
  let savedHour = 0;
  // Export session: the save this session began from (the quarter's start, or where the game was
  // loaded since), the speed then, and every command since. It lives in the worker, so a reload begins
  // a new one from the autosave.
  let session: { start: string; speed: Speed; commands: { at: number; message: ToWorker }[] } | null = null;
  const beginSession = (start: string) => void (session = { start, speed, commands: [] });
  const stamp = () => now?.();
  // The quarter's save as this page last wrote it, so Restart this quarter reopens it for the life of
  // the page though the browser keeps nothing (storage refused, or too full for it); the store's copy
  // is read only after a reload.
  let quarter: string | null = null;
  // Owed once the page's store refuses its write (a full disk, which may refuse it alone: over the last quarter's start it
  // needs a quarter's growth of room, the autosave over its last save an hour's): written again from memory after a delete in
  // Saves, so after a reload Restart this quarter goes back to this quarter's start, not an older one's.
  let quarterOwed = false;
  const writeQuarter = () => {
    quarterOwed = false;
    post({ type: 'store', effects: [{ op: 'write', key: quarterKey(world!.state.city.id), value: quarter! }], owed: 'quarter' });
  };
  const saveQuarter = () => {
    quarter = encode(world!.state, build, stamp());
    writeQuarter();
    beginSession(quarter);
  };
  // A save set aside at the start whose backup did not read back (a full disk refused it): the live
  // key holds its only copy, so the game writes nothing over it (D12, DP-06), and a save due meanwhile
  // waits, owed. Nothing tries the backup again after the start's one read-back: only the player's
  // Delete in Saves, or a later page load that sets it aside afresh, ends the hold.
  let unbacked: { why: SetAsideWhy; text: string } | null = null;
  // A save is owed too once the page's store refuses the live key's write (a full disk): any delete in Saves
  // makes room, so the game writes it at once after the delete rather than at its next command, pause or hour.
  let saveOwed = false;
  const save = () => {
    savedHour = Math.floor(world!.state.elapsed / 3_600);
    saveOwed = unbacked !== null;
    if (!saveOwed) post({ type: 'store', effects: [{ op: 'write', key, value: encode(world!.state, build, stamp()) }], owed: 'autosave' });
  };
  /** After a delete in Saves, into the room it made and before the list reads it: what is owed, the autosave first. */
  const writeOwed = () => {
    if (saveOwed) save();
    if (quarterOwed) writeQuarter();
  };
  const release = () => {
    unbacked = null;
    writeOwed();
  };
  let speed: Speed = 0;
  let lastMs: number | null = null;
  let carrySeconds = 0;
  let lastSnapshotMs = -Infinity;
  let savedAtMs = -Infinity;
  // Routes change only when the network does, not ten times a second.
  let lines: LineView[] = [];
  let stops: StopView[] = [];
  let linesVersion = 0;
  const refreshLines = () => {
    lines = lineViews(world!);
    stops = stopViews(world!);
    linesVersion++;
  };

  /** A world from a decoded save: as it was, or with its stops on this bake's streets; or why it cannot be played here. */
  const worldFrom = (city: City, ref: CityRef, result: LoadOutcome): { ok: true; world: World } | { ok: false; reason: LoadView } => {
    if (result.outcome !== 'ok' && result.outcome !== 'rebaked') return { ok: false, reason: result.outcome };
    const read = createWorld(city, fromSaveData(result.envelope.data));
    if (result.outcome === 'rebaked' && !rebase(read, ref).ok) return { ok: false, reason: 'off-street' };
    return { ok: true, world: read };
  };
  /** Makes `next` the game: paused, nothing to undo, its lines drawn afresh. */
  const play = (next: World, city: City, ref: CityRef) => {
    world = next;
    playing = { city, ref };
    speed = 0;
    lastMs = null;
    carrySeconds = 0;
    undoStack = newUndo();
    savedHour = Math.floor(next.state.elapsed / 3_600);
    refreshLines();
  };
  // Whether a slot's save from another bake finds this bake's streets, as loading it must (worldFrom),
  // by its text: each answer builds a world, and Saves lists the slots every 2 s while the game saves.
  const rebases = new Map<string, boolean>();
  const playsHere = (text: string, result: LoadOutcome): boolean => {
    let ok = rebases.get(text);
    if (ok === undefined) {
      ok = worldFrom(playing!.city, playing!.ref, result).ok;
      if (rebases.size >= SAVE_SLOTS.length) rebases.clear();
      rebases.set(text, ok);
    }
    return ok;
  };
  /** Reads the slots, the set-aside saves and the autosave, and posts what each slot and the autosave hold and which set-asides there are; then `then`. */
  const listSlots = (then?: () => void) =>
    readKeys(
      [...SAVE_SLOTS.map((n) => slotKey(playing!.ref.id, n)), ...SET_ASIDE.map((why) => backupKey(playing!.ref.id, why)), saveKey(playing!.ref.id)],
      (texts) => {
        const slots: SlotView[] = SAVE_SLOTS.map((slot, k) => {
          const text = texts[k] ?? null;
          if (text === null) return { slot, about: null, readable: true };
          const { result } = decode(text, playing!.ref);
          if (result.outcome === 'ok' || (result.outcome === 'rebaked' && playsHere(text, result))) return { slot, about: aboutSave(result.envelope), readable: true };
          // Named as a set-aside save would be, so a slot from an older build, or one whose stops are off the new map, says so (D12).
          return { slot, about: null, readable: false, why: refusedAs(result) };
        });
        const setAside = SET_ASIDE.filter((_, k) => texts[SAVE_SLOTS.length + k] != null);
        const { result: kept } = decode(texts[SAVE_SLOTS.length + SET_ASIDE.length] ?? null, playing!.ref);
        // The live key holds no autosave while it keeps a save not set aside.
        const autosave = !unbacked && (kept.outcome === 'ok' || kept.outcome === 'rebaked') ? aboutSave(kept.envelope) : null;
        post({ type: 'slots', slots, setAside, autosave });
        then?.();
      },
    );
  /**
   * A slot's or a file's save becomes the game only if it can be played here; anything else is
   * refused in words and the game, and the save under the live key, stay as they were (V1 wrote over
   * the live save first, `Intralines@7af45b1:src/game/store.ts:1883-1901`).
   */
  const loadText = (text: string | null, from: 'slot' | 'file' | 'quarter') => {
    const command = from === 'slot' ? 'load-slot' : from === 'file' ? 'import' : 'restart-quarter';
    if (!playing || text === null) return post({ type: 'refused', command, reason: from === 'quarter' ? 'no_quarter_save' : 'empty_slot' });
    const { result } = decode(text, playing.ref);
    // The quarter's save is whichever game wrote it last, and loading an ended game writes none, so it
    // may be another company's: Restart reopens it only for the company that wrote it, by name and colour.
    if (from === 'quarter' && (result.outcome === 'ok' || result.outcome === 'rebaked')) {
      const [theirs, ours] = [result.envelope.data.company, world!.state.company];
      if (theirs.name !== ours.name || theirs.colour !== ours.colour) return post({ type: 'refused', command, reason: 'no_quarter_save' });
    }
    const read = worldFrom(playing.city, playing.ref, result);
    if (!read.ok) return post({ type: 'refused', command, reason: `save_${read.reason.replace('-', '_')}` });
    play(read.world, playing.city, playing.ref);
    save();
    // A slot or a file brings no save of its quarter's start, so Restart this quarter goes back to
    // the moment it was loaded; a restart keeps the quarter's own, and so does a game already ended.
    if (from !== 'quarter' && !runEnded(read.world.state.closesBelowFloor)) saveQuarter();
    else beginSession(encode(read.world.state, build));
    post({ type: 'loaded', from, load: result.outcome === 'rebaked' ? 'rebaked' : 'ok' });
    post({ type: 'snapshot', snapshot: snapshot() });
  };

  // Every command taken since the last unpause, newest last (sim/undo.ts, I9).
  let undoStack = newUndo();
  /** Runs a command; while paused, keeps the game from before it so an undo can put it back. */
  const command = <R extends { readonly ok: boolean }>(label: UndoLabel, run: () => R): R => {
    const kept = speed === 0 ? before(world!) : null;
    const result = run();
    if (result.ok && kept) remember(undoStack, label, kept);
    return result;
  };

  // Worked out again only when a row is posted, the day turns or the network changes.
  let financeKey = '';
  let financeView: Finance | null = null;
  const financeNow = (w: World): Finance => {
    const key = `${w.state.ledger.rows.length}|${w.state.ledger.cashCents}|${toCalendarTime(w.state.elapsed).day}|${linesVersion}`;
    if (key !== financeKey || !financeView) {
      financeKey = key;
      financeView = finance(w);
    }
    return financeView;
  };

  // Worked out again only when the network, the contracts or the hour change.
  let contractsKey = '';
  let contractsView: ContractView[] = [];
  const contractsNow = (w: World, day: number): ContractView[] => {
    const key = `${linesVersion}|${JSON.stringify(w.state.contracts)}|${day}`;
    if (key === contractsKey) return contractsView;
    contractsKey = key;
    const figures = landmarkFigures(w);
    contractsView = w.state.contracts.map((c) => {
      const landmark = w.city.landmarks.find((l) => l.name === c.landmark);
      const figure = figures.get(c.landmark)?.[c.kind] ?? null;
      return {
        id: c.id,
        landmark: c.landmark,
        at: landmark ? toLngLat(w.city.frame, landmark.at) : [0, 0],
        reachM: CONTRACT_REACH_M,
        kind: c.kind,
        ask: c.ask,
        rewardCents: c.rewardCents,
        held: c.acceptedDay !== null,
        daysMet: c.daysMet,
        daysNeeded: CONTRACT_DAYS,
        daysLeft: c.acceptedDay === null ? null : contractDaysLeft(c.acceptedDay, day),
        figure,
        met: contractMet(c.kind, figure, c.ask),
        onTrack: c.hoursMissedToday === 0,
      };
    });
    return contractsView;
  };

  // Worked out again only when the event, the day or the network changes: snow's words sit amid the
  // stops, which a stop built or a game loaded on the same snowy day moves.
  let eventKey = '';
  let eventShown: EventView | null = null;
  const eventNow = (w: World, day: number): EventView | null => {
    const key = `${linesVersion}|${JSON.stringify(w.state.event)}|${day}`;
    if (key !== eventKey) {
      eventKey = key;
      eventShown = eventView(w, w.state.event, day);
    }
    return eventShown;
  };

  const snapshot = (): Snapshot => {
    const w = world!;
    const t = toCalendarTime(w.state.elapsed);
    const money = financeNow(w);
    return {
      elapsed: w.state.elapsed,
      day: t.day,
      hour: t.hour,
      minute: t.minute,
      speed,
      company: { ...w.state.company },
      // The part-step of game time run so far counts on the clock the buses are drawn by, so at 1x they
      // glide rather than wait for the next whole step (display only: the sim's clock is whole steps).
      secondOfDay: ((START_SECOND_OF_DAY + w.state.elapsed) % SECONDS_PER_DAY) + carrySeconds,
      rate: SPEEDS[speed],
      cashCents: w.state.ledger.cashCents,
      ridersPerDay: w.assignment.tripsPerDay,
      profitableDays: profitableDays(w.state.ledger, t.day),
      costsPerDayCents: runningCostsCents(money),
      lines,
      stops,
      linesVersion,
      depots: w.state.depots.map((d) => ({ id: d.id, at: [d.lon, d.lat] })),
      finance: money,
      undo: speed === 0 ? nextUndo(undoStack) : null,
      floor:
        belowFloor(w.state.ledger.cashCents) || w.state.closesBelowFloor > 0
          ? { closesLeft: Math.max(0, FAILURE_CLOSES - w.state.closesBelowFloor), ended: runEnded(w.state.closesBelowFloor) }
          : null,
      contracts: contractsNow(w, t.day),
      contractTaken: w.state.contracts.some((c) => c.acceptedDay !== null) || w.state.ledger.rows.some((r) => r.kind === 'contract'),
      event: eventNow(w, t.day),
      medals: { ...w.state.medals },
      tripsCarried: w.state.tripsCarried,
    };
  };

  /** One fixed step and what follows from it: day cards, the quarter's save, the run's end. False once the run has ended (time stops there, D10). */
  const stepOnce = (): boolean => {
    const w = world!;
    for (const event of simStep(w)) {
      // A new quarter begins at the close that graded the last: keep the game as it stands,
      // unless that close ended the run, when Restart this quarter reopens the quarter just graded.
      if (event.card && !runEnded(w.state.closesBelowFloor)) saveQuarter();
      post({
        type: 'day-card',
        card: {
          day: event.day,
          rows: event.rows.map((r) => ({ kind: r.kind, amountCents: r.amountCents, lineId: r.lineId ?? null })),
          cashBeforeCents: event.cashBeforeCents,
          cashAfterCents: event.cashAfterCents,
          report: event.card,
          contracts: event.contracts.map((o) => ({ landmark: o.contract.landmark, kind: o.contract.kind, ask: o.contract.ask, rewardCents: o.contract.rewardCents, outcome: o.outcome })),
          events: eventNews(event.rolled, event.ended),
          medals: event.medals,
        },
      });
      // Roadworks started or ended: every line's round trip, buses and forecast were timed again.
      if (event.retimed) refreshLines();
    }
    // The fifth close below the floor ends the run: time stops where it is (D10).
    if (runEnded(w.state.closesBelowFloor)) {
      speed = 0;
      carrySeconds = 0;
      save();
      post({ type: 'snapshot', snapshot: snapshot() });
      return false;
    }
    return true;
  };

  return {
    handle(message) {
      if (message.type === 'init') {
        const loaded = loadCity(message.simText);
        if (!loaded.ok) return post({ type: 'failed', problem: loaded.problem });
        world = null;
        pending = { city: loaded.city, ref: message.city, seed: message.seed };
        build = { sha: message.build.sha, version: message.build.version };
        key = saveKey(message.city.id);
        post({ type: 'read-save', key });
        return;
      }
      if (message.type === 'save-text') {
        if (!pending) return;
        const { city, ref, seed } = pending;
        pending = null;
        gameSeed = seed;
        // A readable save carries on; one from another bake of this city carries on with its stops on
        // this bake's streets; anything else is set aside first and a new game starts, unnamed until
        // the founding card names it (D12).
        const { result, effects } = decode(message.text, ref);
        const read = worldFrom(city, ref, result);
        let load: LoadView = result.outcome;
        if (read.ok) {
          play(read.world, city, ref);
          beginSession(encode(read.world.state, build));
        } else {
          if (read.reason === 'off-street') {
            effects.push({ op: 'write', key: backupKey(ref.id, 'off-street'), value: message.text! }, { op: 'remove', key: saveKey(ref.id) });
            load = 'off-street';
          }
          play(createWorld(city, newGame(ref, { name: '', colour: COMPANY_COLOURS[0]! }, seed)), city, ref);
        }
        if (effects.length) post({ type: 'store', effects, setAside: true });
        // A save set aside is written over only once its backup reads back. Either way the page is told,
        // so it says the save was set aside only once it was, and otherwise Saves offers it to export or delete.
        const backup = effects.find((e): e is Extract<typeof e, { op: 'write' }> => e.op === 'write');
        if (backup) {
          const held = { why: refusedAs(result), text: backup.value };
          unbacked = held;
          readKeys([backup.key], ([kept]) => {
            if (unbacked !== held) return;
            post({ type: 'unbacked', why: kept === held.text ? null : held.why });
            if (kept === held.text) release();
          });
        }
        // The rebased game is saved at once, under this bake's name.
        if (load === 'rebaked') save();
        post({ type: 'ready', dots: dotsOf(city), depotLand: depotLandOf(city), snapshot: snapshot(), load, ...(backup ? { checking: true as const } : {}) });
        return;
      }
      if (message.type === 'key-texts') {
        const then = reads.get(message.id);
        reads.delete(message.id);
        then?.(message.texts);
        return;
      }
      if (message.type === 'store-refused') {
        // Only the saves under the keys refused are owed; before a game is playing there is none to owe.
        if (world && message.keys.includes(key)) saveOwed = true;
        if (world && quarter !== null && message.keys.includes(quarterKey(world.state.city.id))) quarterOwed = true;
        return;
      }
      if (!world) return post({ type: 'refused', command: message.type, reason: 'not_started' });
      if (SESSION_COMMANDS.has(message.type)) session?.commands.push({ at: world.state.elapsed, message });
      if (message.type === 'speed') {
        // Once the run has ended, only Restart this quarter goes on (D10).
        if (message.speed > 0 && runEnded(world.state.closesBelowFloor)) return post({ type: 'refused', command: message.type, reason: 'run_ended' });
        if (message.speed > 0) timeRuns(undoStack);
        speed = message.speed;
        lastMs = null;
        // A part-step of game time is dropped, as a save drops it, so a reload carries on in step.
        carrySeconds = 0;
        save(); // a pause keeps the game exactly where it stopped
        post({ type: 'snapshot', snapshot: snapshot() });
      } else if (message.type === 'probe') {
        const at = toXY(world.city.frame, message.at);
        post({ type: 'probe', id: message.id, within: message.kind === 'job' ? jobsWithinWalk(world.city, at) : peopleWithinWalk(world.city, at) });
      } else if (message.type === 'depot-site') {
        const verdict = checkDepotSite(depotSiteContext(world), toXY(world.city.frame, message.at));
        const site: DepotSiteView = verdict.ok
          ? { ok: true, streetM: Math.round(verdict.streetM), priceCents: verdict.priceCents }
          : { ok: false, reason: verdict.reason, ...(verdict.limitM === undefined ? {} : { limitM: verdict.limitM }), ...(verdict.nearestM === undefined ? {} : { nearestM: Math.round(verdict.nearestM) }), ...(verdict.shortCents === undefined ? {} : { shortCents: verdict.shortCents }), ...(verdict.priceCents === undefined ? {} : { priceCents: verdict.priceCents }) };
        post({ type: 'depot-site', id: message.id, site });
      } else if (message.type === 'stop-site') {
        const verdict = checkPlaceStop(lineDraftContext(world), toXY(world.city.frame, message.at));
        const site: StopSiteView = verdict.ok
          ? { ok: true, at: [...toLngLat(world.city.frame, verdict.at)] as LngLatPair, streetM: Math.round(verdict.distM), priceCents: verdict.priceCents }
          : { ok: false, reason: verdict.reason, ...(verdict.limitM === undefined ? {} : { limitM: verdict.limitM }), ...(verdict.stopId === undefined ? {} : { stopId: verdict.stopId }), ...(verdict.shortCents === undefined ? {} : { shortCents: verdict.shortCents }) };
        post({ type: 'stop-site', id: message.id, site });
      } else if (message.type === 'place-stop') {
        const result = command({ command: 'place-stop', subject: `Stop ${world.state.nextIds.stop}` }, () => placeStop(world!, message.at));
        if (!result.ok) post({ type: 'refused', command: message.type, ...refusalView(result) });
        else {
          refreshLines(); // the stops' views
          save();
        }
        post({ type: 'snapshot', snapshot: snapshot() });
      } else if (message.type === 'take-down-stop') {
        const result = command({ command: 'take-down-stop', subject: `Stop ${message.stopId}` }, () => takeDownStop(world!, message.stopId as StopId));
        if (!result.ok) post({ type: 'refused', command: message.type, ...refusalView(result) });
        else {
          refreshLines(); // the stops' views
          save();
        }
        post({ type: 'snapshot', snapshot: snapshot() });
      } else if (message.type === 'set-route') {
        const result = command({ command: 'set-route', subject: world.state.lines.find((l) => l.id === message.lineId)?.name ?? '' }, () => setRoute(world!, message.lineId as LineId, message.points));
        if (!result.ok) post({ type: 'refused', command: message.type, ...refusalView(result) });
        else {
          refreshLines();
          save();
        }
        post({ type: 'snapshot', snapshot: snapshot() });
      } else if (message.type === 'place-depot') {
        const result = command({ command: 'place-depot', subject: `Depot ${world.state.nextIds.depot}` }, () => placeDepot(world!, message.at));
        if (!result.ok) post({ type: 'refused', command: message.type, ...refusalView(result) });
        else {
          refreshLines(); // a line's deadhead now runs from the depot
          save();
        }
        post({ type: 'snapshot', snapshot: snapshot() });
      } else if (message.type === 'found') {
        const result = found(world, message.name, message.colour);
        if (!result.ok) post({ type: 'refused', command: message.type, ...refusalView(result) });
        else {
          save();
          saveQuarter(); // quarter 1 begins at founding
        }
        post({ type: 'snapshot', snapshot: snapshot() });
      } else if (message.type === 'line-draft') {
        const draft =
          message.route !== undefined
            ? routeDraftView(world, message.route, message.clicks)
            : message.extend
              ? extendDraftView(world, message.extend, message.clicks)
              : draftView(world, message.clicks, message.headways ?? FOUNDING_HEADWAYS, message.model ?? 'sparrow');
        post({ type: 'line-draft', id: message.id, draft });
      } else if (message.type === 'create-line') {
        const result = command({ command: 'create-line', subject: `Line ${world.state.nextIds.line}` }, () =>
          createLine(world!, message.clicks, message.headways ?? FOUNDING_HEADWAYS, message.model ?? 'sparrow'),
        );
        if (!result.ok) post({ type: 'refused', command: message.type, ...refusalView(result) });
        else {
          refreshLines();
          save();
        }
        post({ type: 'snapshot', snapshot: snapshot() });
      } else if (message.type === 'extend-line') {
        const result = command({ command: 'extend-line', subject: world.state.lines.find((l) => l.id === message.lineId)?.name ?? '' }, () =>
          extendLine(world!, message.lineId as LineId, message.end, message.clicks),
        );
        if (!result.ok) post({ type: 'refused', command: message.type, ...refusalView(result) });
        else {
          refreshLines();
          save();
        }
        post({ type: 'snapshot', snapshot: snapshot() });
      } else if (message.type === 'insert-stop') {
        const result = command({ command: 'insert-stop', subject: world.state.lines.find((l) => l.id === message.lineId)?.name ?? '' }, () =>
          insertStop(world!, message.lineId as LineId, message.at),
        );
        if (!result.ok) post({ type: 'refused', command: message.type, ...refusalView(result) });
        else {
          refreshLines();
          save();
        }
        post({ type: 'snapshot', snapshot: snapshot() });
      } else if (message.type === 'set-model') {
        const result = command({ command: 'set-model', subject: world.state.lines.find((l) => l.id === message.lineId)?.name ?? '' }, () => setModel(world!, message.lineId as LineId, message.model));
        if (!result.ok) post({ type: 'refused', command: message.type, ...refusalView(result) });
        else {
          refreshLines();
          save();
        }
        post({ type: 'snapshot', snapshot: snapshot() });
      } else if (message.type === 'set-fare') {
        const result = command({ command: 'set-fare', subject: world.state.lines.find((l) => l.id === message.lineId)?.name ?? '' }, () => setFare(world!, message.lineId as LineId, message.fareCents));
        if (!result.ok) post({ type: 'refused', command: message.type, ...refusalView(result) });
        else {
          refreshLines();
          save();
        }
        post({ type: 'snapshot', snapshot: snapshot() });
      } else if (message.type === 'accept-contract') {
        const landmark = world.state.contracts.find((c) => c.id === message.contractId)?.landmark ?? '';
        const result = command({ command: 'accept-contract', subject: landmark }, () => acceptContract(world!, message.contractId as ContractId));
        if (!result.ok) post({ type: 'refused', command: message.type, ...refusalView(result) });
        else save();
        post({ type: 'snapshot', snapshot: snapshot() });
      } else if (message.type === 'set-stop-tier') {
        const result = command({ command: 'set-stop-tier', subject: `Stop ${message.stopId}` }, () => setStopTier(world!, message.stopId as StopId, message.tier));
        if (!result.ok) post({ type: 'refused', command: message.type, ...refusalView(result) });
        else {
          refreshLines();
          save();
        }
        post({ type: 'snapshot', snapshot: snapshot() });
      } else if (message.type === 'remove-stop') {
        const subject = `Stop ${message.stopId} off ${world.state.lines.find((l) => l.id === message.lineId)?.name ?? 'its line'}`;
        const result = command({ command: 'remove-stop', subject }, () => removeStop(world!, message.lineId as LineId, message.stopId as StopId));
        if (!result.ok) post({ type: 'refused', command: message.type, ...refusalView(result) });
        else {
          refreshLines();
          save();
        }
        post({ type: 'snapshot', snapshot: snapshot() });
      } else if (message.type === 'undo') {
        const result = undo(world, undoStack);
        if (!result.ok) post({ type: 'refused', command: message.type, reason: result.reason });
        else {
          refreshLines();
          save();
          post({ type: 'undone' });
        }
        post({ type: 'snapshot', snapshot: snapshot() });
      } else if (message.type === 'slots') {
        listSlots();
      } else if (message.type === 'save-slot') {
        if (!SAVE_SLOTS.includes(message.slot as 1)) return post({ type: 'refused', command: message.type, reason: 'no_such_slot' });
        post({ type: 'store', effects: [{ op: 'write', key: slotKey(playing!.ref.id, message.slot), value: encode(world.state, build, stamp()) }], slot: message.slot });
        listSlots();
      } else if (message.type === 'delete-slot') {
        if (!SAVE_SLOTS.includes(message.slot as 1)) return post({ type: 'refused', command: message.type, reason: 'no_such_slot' });
        post({ type: 'store', effects: [{ op: 'remove', key: slotKey(playing!.ref.id, message.slot) }], slot: message.slot });
        writeOwed();
        listSlots();
      } else if (message.type === 'export-set-aside') {
        if (!SET_ASIDE.includes(message.why)) return post({ type: 'refused', command: message.type, reason: 'no_such_slot' });
        const why = message.why;
        readKeys([backupKey(playing!.ref.id, why)], ([text]) => {
          if (text === null || text === undefined) post({ type: 'refused', command: 'export-set-aside', reason: 'no_such_slot' });
          else post({ type: 'export', name: `interbus-${playing!.ref.id}-set-aside-${why}.json`, text });
        });
      } else if (message.type === 'export-slot') {
        if (!SAVE_SLOTS.includes(message.slot as 1)) return post({ type: 'refused', command: message.type, reason: 'no_such_slot' });
        const slot = message.slot;
        readKeys([slotKey(playing!.ref.id, slot)], ([text]) => {
          if (text === null || text === undefined) post({ type: 'refused', command: 'export-slot', reason: 'empty_slot' });
          else post({ type: 'export', name: `interbus-${playing!.ref.id}-slot-${slot}.json`, text });
        });
      } else if (message.type === 'export-unbacked') {
        // Nothing held any more (a press after Delete it, before the row goes): nothing to hand over, and
        // no slot to name in a refusal.
        if (!unbacked) return;
        post({ type: 'export', name: `interbus-${playing!.ref.id}-not-set-aside-${unbacked.why}.json`, text: unbacked.text });
      } else if (message.type === 'delete-unbacked') {
        if (!unbacked) return; // as for Export: already let go
        // The player lets it go (the page asks first): it leaves the live key, and the game saves there
        // again. The page hears so once the list names the save owed meanwhile, so the autosave's row
        // never reads Empty between the two.
        post({ type: 'store', effects: [{ op: 'remove', key }] });
        release();
        listSlots(() => post({ type: 'unbacked', why: null }));
      } else if (message.type === 'delete-set-aside') {
        if (!SET_ASIDE.includes(message.why)) return post({ type: 'refused', command: message.type, reason: 'no_such_slot' });
        post({ type: 'store', effects: [{ op: 'remove', key: backupKey(playing!.ref.id, message.why) }] });
        writeOwed();
        listSlots();
      } else if (message.type === 'load-slot') {
        if (!SAVE_SLOTS.includes(message.slot as 1)) return post({ type: 'refused', command: message.type, reason: 'no_such_slot' });
        readKeys([slotKey(playing!.ref.id, message.slot)], ([text]) => loadText(text ?? null, 'slot'));
      } else if (message.type === 'new-game') {
        // Home's New game, asked first on the page: an unnamed company in place of this one, saved at
        // once so the autosave is the new game; the slots and set-aside saves stay.
        const { city, ref } = playing!;
        play(createWorld(city, newGame(ref, { name: '', colour: COMPANY_COLOURS[0]! }, gameSeed)), city, ref);
        save();
        beginSession(encode(world!.state, build));
        post({ type: 'loaded', from: 'new', load: 'none' });
        post({ type: 'snapshot', snapshot: snapshot() });
      } else if (message.type === 'restart-quarter') {
        if (quarter !== null) loadText(quarter, 'quarter');
        else readKeys([quarterKey(playing!.ref.id)], ([text]) => loadText(text ?? null, 'quarter'));
      } else if (message.type === 'import') {
        loadText(message.text, 'file');
      } else if (message.type === 'export-session') {
        if (!session) return post({ type: 'refused', command: message.type, reason: 'no_session' });
        const t = toCalendarTime(world.state.elapsed);
        const file: SessionFile = { kind: 'interbus-session', format: 1, build, city: playing!.ref, ...session, end: { elapsed: world.state.elapsed, hash: stateHash(world.state) } };
        post({ type: 'export', name: `interbus-${playing!.ref.id}-session-day-${t.day}.json`, text: JSON.stringify(file) });
      } else if (message.type === 'export') {
        const t = toCalendarTime(world.state.elapsed);
        post({ type: 'export', name: `interbus-${playing!.ref.id}-day-${t.day}.json`, text: encode(world.state, build, stamp()) });
      } else if (message.type === 'fare-band') {
        post({ type: 'fare-band', id: message.id, lineId: message.lineId, band: fareBand(world, message.lineId as LineId) });
      } else if (message.type === 'set-headways') {
        const result = command({ command: 'set-headways', subject: world.state.lines.find((l) => l.id === message.lineId)?.name ?? '' }, () => setHeadways(world!, message.lineId as LineId, message.headways));
        if (!result.ok) post({ type: 'refused', command: message.type, ...refusalView(result) });
        else {
          refreshLines();
          save();
        }
        post({ type: 'snapshot', snapshot: snapshot() });
      }
    },
    tick(nowMs) {
      if (!world || speed === 0) {
        lastMs = null;
        return;
      }
      if (lastMs === null) savedAtMs = nowMs;
      const sliceMs = lastMs === null ? 0 : Math.min(Math.max(nowMs - lastMs, 0), MAX_SLICE_MS);
      lastMs = nowMs;
      carrySeconds += (sliceMs / 1000) * SPEEDS[speed];
      while (carrySeconds >= STEP_SECONDS) {
        carrySeconds -= STEP_SECONDS;
        if (!stepOnce()) return;
      }
      if (Math.floor(world.state.elapsed / 3_600) !== savedHour || nowMs - savedAtMs >= SAVE_EVERY_MS) {
        save();
        savedAtMs = nowMs;
      }
      if (nowMs - lastSnapshotMs >= SNAPSHOT_EVERY_MS) {
        lastSnapshotMs = nowMs;
        post({ type: 'snapshot', snapshot: snapshot() });
      }
    },
    advanceTo(elapsed) {
      if (!world) return;
      while (world.state.elapsed < elapsed && stepOnce()) {
        if (Math.floor(world.state.elapsed / 3_600) !== savedHour) save();
      }
    },
    stateHash: () => (world ? stateHash(world.state) : null),
  };
}
