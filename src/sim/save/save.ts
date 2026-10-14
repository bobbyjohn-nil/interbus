// Saves, ported from V3 (`Intralines_City@dc63602:src/game/save/`, S02) and reshaped:
// - pure: the sim encodes and decodes; src/platform's async SaveStore reads and writes, and carries
//   out the backups `decode` asks for (a worker has no localStorage);
// - strict: a missing or mistyped field, a null element, a dangling stop or an id at or above its
//   counter refuses the file as unreadable. V3 filled defaults instead, so a file without `nextIds`
//   reissued live ids (K01 class), a corrupt cash became $500,000 and a null clock became minute 0;
// - versioned by the schema hash (schema.lock.json), and an older format is set aside under a
//   backup key with a fresh start, never migrated (D12);
// - the envelope names the build (SHA and version) instead of a typed version string (PR-15).
import { CONTRACT_ASKS } from '../config/contracts';
import { STOP_TIER_IDS, type StopTier } from '../config/stops';
import { ID_KINDS, type ContractId, type DepotId, type IdKind, type LineId, type NextIds, type StopId } from '../core/ids';
import { toCalendarTime } from '../core/calendar';
import { createRng, hashString } from '../core/rng';
import { OPENING_DAY, type LedgerRow } from '../economy/ledger';
import { checkHeadways } from '../rules/periods';
import type { SaveAbout, SetAsideWhy } from '../types';
import type { CityRef, SimState } from '../state';
import { check, SAVE_SCHEMA, type SaveData } from './schema';

/** Bump with every schema change, and add the new hash to schema.lock.json (save.test.ts). */
export const SAVE_FORMAT = 16;

export interface BuildRef {
  readonly sha: string;
  readonly version: string;
}

export interface SaveEnvelope {
  readonly format: number;
  readonly build: BuildRef;
  /** When it was written, in milliseconds since 1970 by the page's clock (the M5 spec, item 4), never the sim's: none in saves written before it. */
  readonly savedAt?: number;
  readonly data: SaveData;
}

/** Keys carry no format number, so an old tab still finds a newer save and refuses it. */
export const saveKey = (cityId: string) => `interbus.save.${cityId}`;
export const backupKey = (cityId: string, why: SetAsideWhy) => `interbus.backup.${cityId}.${why}`;
/**
 * Every backup key's reason, in the order the Saves panel lists them: each older format its own, so
 * a save set aside by one format change is never written over by the next (DP-06; D25 changed the
 * format twice in a week), then the rest.
 */
export const SET_ASIDE: readonly SetAsideWhy[] = ['older', ...Array.from({ length: SAVE_FORMAT - 1 }, (_, i): SetAsideWhy => `older-${i + 1}`), 'newer', 'unreadable', 'other-city'];
/** Three slots beside the autosave, which is the live key (the M3 spec, item 8). */
export const SAVE_SLOTS = [1, 2, 3] as const;
export const slotKey = (cityId: string, slot: number) => `interbus.slot.${cityId}.${slot}`;
/** The game as each quarter began, written automatically, for Restart this quarter (the M3 spec, item 10). */
export const quarterKey = (cityId: string) => `interbus.quarter.${cityId}`;

/** A save in a line, for the Saves panel: when it is, the company, its cash, lines and buses, and when it was saved. */
export function aboutSave({ data, savedAt }: SaveEnvelope): SaveAbout {
  const t = toCalendarTime(data.clock.elapsed);
  return {
    day: t.day,
    hour: t.hour,
    minute: t.minute,
    company: data.company.name,
    cashCents: data.ledger.reduce((sum, r) => sum + r.amountCents, 0),
    lines: data.lines.length,
    buses: data.lines.reduce((sum, l) => sum + l.buses, 0),
    savedAt: savedAt ?? null,
  };
}

/** What the platform's store must do after a load: the live key is never overwritten by a refusal. */
export type StoreEffect = { readonly op: 'write'; readonly key: string; readonly value: string } | { readonly op: 'remove'; readonly key: string };

export type LoadOutcome =
  | { readonly outcome: 'none' }
  | { readonly outcome: 'ok'; readonly envelope: SaveEnvelope }
  | { readonly outcome: 'newer'; readonly format: number }
  | { readonly outcome: 'older'; readonly format: number }
  | { readonly outcome: 'unreadable'; readonly problem: string }
  | { readonly outcome: 'other-city'; readonly city: CityRef }
  /** This city from another bake: the save is read, and its stops go onto this bake's streets (save/rebase.ts). */
  | { readonly outcome: 'rebaked'; readonly envelope: SaveEnvelope; readonly from: CityRef };

export function toSaveData(state: SimState): SaveData {
  return {
    city: { id: state.city.id, revision: state.city.revision, hash: state.city.hash },
    clock: { elapsed: state.elapsed },
    rng: { state: state.rng.state },
    company: { name: state.company.name, colour: state.company.colour },
    nextIds: { stop: state.nextIds.stop, line: state.nextIds.line, bus: state.nextIds.bus, depot: state.nextIds.depot, contract: state.nextIds.contract },
    depots: state.depots.map((d) => ({ id: d.id, lon: d.lon, lat: d.lat })),
    stops: state.stops.map((s) => ({ id: s.id, lon: s.lon, lat: s.lat, tier: s.tier })),
    lines: state.lines.map((l) => ({
      id: l.id,
      name: l.name,
      colour: l.colour,
      stopIds: [...l.stopIds],
      fareCents: l.fareCents,
      headways: { peak: l.headways.peak, offpeak: l.headways.offpeak, overnight: l.headways.overnight },
      boardedMilli: l.boardedMilli,
      buses: l.buses,
      model: l.model,
      earlier: (l.earlier ?? []).map((e) => ({ ...e, stops: e.stops.map((p) => ({ lon: p.lon, lat: p.lat })), depot: e.depot && { lon: e.depot.lon, lat: e.depot.lat }, plan: { ...e.plan, cycles: { ...e.plan.cycles }, headways: { ...e.plan.headways } } })),
    })),
    ledger: state.ledger.rows.map((r) => ({ day: r.day, kind: r.kind, amountCents: r.amountCents, lineId: r.lineId ?? null })),
    closesBelowFloor: state.closesBelowFloor,
    contracts: state.contracts.map((c) => ({ ...c })),
    contractDeck: [...state.contractDeck],
    eventRng: { state: state.eventRng.state },
    event: state.event && { ...state.event, edges: [...state.event.edges], at: state.event.at && { lon: state.event.at.lon, lat: state.event.at.lat } },
    medals: { bronze: state.medals.bronze, silver: state.medals.silver, gold: state.medals.gold },
    tripsCarried: state.tripsCarried,
    tripsToday: state.tripsToday,
  };
}

export function fromSaveData(data: SaveData): SimState {
  const rows: LedgerRow[] = data.ledger.map((r) => ({
    day: r.day,
    kind: r.kind,
    amountCents: r.amountCents,
    ...(r.lineId === null ? {} : { lineId: r.lineId as LineId }),
  }));
  return {
    city: { ...data.city },
    elapsed: data.clock.elapsed,
    rng: createRng(data.rng.state),
    company: { ...data.company },
    nextIds: { ...data.nextIds },
    depots: data.depots.map((d) => ({ id: d.id as DepotId, lon: d.lon, lat: d.lat })),
    stops: data.stops.map((s) => ({ id: s.id as StopId, lon: s.lon, lat: s.lat, tier: s.tier as StopTier })),
    lines: data.lines.map((l) => ({
      id: l.id as LineId,
      name: l.name,
      colour: l.colour,
      stopIds: l.stopIds.map((id) => id as StopId),
      fareCents: l.fareCents,
      headways: { ...l.headways },
      boardedMilli: l.boardedMilli,
      buses: l.buses,
      model: l.model,
      earlier: l.earlier.map((e) => ({ ...e, stops: e.stops.map((p) => ({ ...p })), depot: e.depot && { ...e.depot }, plan: { ...e.plan, cycles: { ...e.plan.cycles }, headways: { ...e.plan.headways } } })),
    })),
    ledger: { rows, cashCents: rows.reduce((sum, r) => sum + r.amountCents, 0) },
    closesBelowFloor: data.closesBelowFloor,
    contracts: data.contracts.map((c) => ({ ...c, id: c.id as ContractId })),
    contractDeck: [...data.contractDeck],
    eventRng: createRng(data.eventRng.state),
    event: data.event && { ...data.event, edges: [...data.event.edges], at: data.event.at && { ...data.event.at } },
    medals: { ...data.medals },
    tripsCarried: data.tripsCarried,
    tripsToday: data.tripsToday,
  };
}

/** The save's text; `savedAt` is the page's clock, passed in, since the sim has none. */
export function encode(state: SimState, build: BuildRef, savedAt?: number): string {
  const envelope: SaveEnvelope = { format: SAVE_FORMAT, build: { sha: build.sha, version: build.version }, ...(savedAt === undefined ? {} : { savedAt }), data: toSaveData(state) };
  return JSON.stringify(envelope);
}

/** A short fingerprint of the whole game, build aside: two games with the same hash are the same game (Export session, AR-06). */
export function stateHash(state: SimState): string {
  const text = JSON.stringify(toSaveData(state));
  const hex = (n: number) => n.toString(16).padStart(8, '0');
  return hex(hashString(`a${text}`)) + hex(hashString(`b${text}`));
}

/** What only a whole file can show: references, duplicates, counters and the ledger's shape. */
export function integrityProblem(data: SaveData): string | null {
  if (data.clock.elapsed < 0) return 'clock before founding';
  if (data.closesBelowFloor < 0) return 'negative closes below the credit floor';
  if (data.tripsToday < 0 || data.tripsCarried < data.tripsToday) return 'more trips today than since founding';
  const today = toCalendarTime(data.clock.elapsed).day;
  if (Object.values(data.medals).some((d) => d !== null && (d < 1 || d > today))) return 'a medal awarded on a day not yet played';
  for (const c of data.contracts) {
    if (c.daysMet < 0 || c.hoursMissedToday < 0 || c.ask <= 0 || c.rewardCents < 0) return `contract ${c.id}: a negative count or amount`;
    if (c.acceptedDay !== null && c.acceptedDay < c.offeredDay) return `contract ${c.id}: taken before it was offered`;
  }
  if (data.contractDeck.some((k) => CONTRACT_ASKS[k] === undefined)) return 'a contract deck card that is no ask';
  const e = data.event;
  if (e && (e.startDay < 1 || e.endDay < e.startDay || e.edges.some((k) => k < 0) || new Set(e.edges).size !== e.edges.length)) return 'an event with impossible days or streets';
  if (e && ((e.kind === 'roadworks') !== (e.edges.length > 0) || (e.kind === 'festival') !== (e.at !== null))) return 'an event whose kind does not match its streets or place';
  const live: Partial<Record<IdKind, number[]>> = {
    stop: data.stops.map((s) => s.id),
    line: data.lines.map((l) => l.id),
    depot: data.depots.map((d) => d.id),
    contract: data.contracts.map((c) => c.id),
  };
  for (const kind of ID_KINDS) {
    const next: number = (data.nextIds as NextIds)[kind];
    if (next < 1) return `nextIds.${kind} below 1`;
    const ids = live[kind] ?? [];
    if (new Set(ids).size !== ids.length) return `duplicate ${kind} id`;
    if (ids.some((id) => id < 1 || id >= next)) return `${kind} id at or above its counter`;
  }
  if (data.stops.some((s) => !STOP_TIER_IDS.includes(s.tier as StopTier))) return 'a stop of no tier';
  const stops = new Set(data.stops.map((s) => s.id));
  for (const line of data.lines) {
    if (line.stopIds.some((id) => !stops.has(id))) return `line ${line.id} names a missing stop`;
    if (line.fareCents < 0) return `line ${line.id} has a negative fare`;
    if (line.boardedMilli < 0) return `line ${line.id} has negative boardings`;
    if (line.buses < 0) return `line ${line.id} has negative buses`;
    if (!checkHeadways(line.headways).ok) return `line ${line.id} breaks the headway rules`;
    if (line.earlier.some((e, k) => e.until < 0 || e.until > data.clock.elapsed || (k > 0 && e.until < line.earlier[k - 1]!.until) || e.stops.length < 2 || e.plan.buses < 0)) return `line ${line.id} has an impossible earlier version`;
  }
  if (data.ledger[0]?.kind !== 'founding') return 'the ledger does not start with the starting cash';
  if (data.ledger.filter((r) => r.kind === 'founding').length !== 1) return 'more than one starting cash row';
  // The starting cash sits on Day 0 (D25), every other row on a day played.
  if (data.ledger.some((r) => (r.kind === 'founding' ? r.day !== OPENING_DAY : r.day < 1))) return 'a ledger row before day 1';
  // A day's close merges its rows and refuses any other day's after them (economy/ledger.ts closeDay),
  // so a file with rows out of day order, or from a day not yet played, would stop the game there.
  if (data.ledger.some((r, i) => r.day > today || (i > 0 && r.day < data.ledger[i - 1]!.day))) return 'a ledger out of day order';
  // A row may name a line since deleted, never one not yet made.
  if (data.ledger.some((r) => r.lineId !== null && (r.lineId < 1 || r.lineId >= data.nextIds.line))) return 'a ledger row names a line never made';
  return null;
}

/**
 * Reads a raw save for `city`, first failure wins (V3's order): nothing → none; not JSON or the
 * wrong shape → unreadable; a newer format → refused, the live key untouched; an older one → set
 * aside (D12); another city → set aside too, never read into this one; then field and integrity
 * checks; another bake of this city → read, for its stops to be put on this bake's streets (the M3
 * spec, item 8, which replaces M2's setting it aside). The game saves under the live key as it plays, so anything it refuses is kept
 * under a backup key first, never overwritten (D12).
 */
export function decode(raw: string | null, city: CityRef, current = SAVE_FORMAT): { result: LoadOutcome; effects: StoreEffect[] } {
  if (raw === null) return { result: { outcome: 'none' }, effects: [] };
  const setAside = (why: SetAsideWhy): StoreEffect[] => [
    { op: 'write', key: backupKey(city.id, why), value: raw },
    { op: 'remove', key: saveKey(city.id) },
  ];
  const unreadable = (problem: string) => ({ result: { outcome: 'unreadable', problem } as const, effects: setAside('unreadable') });

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return unreadable('not JSON');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return unreadable('not an object');
  const format = (parsed as { format?: unknown }).format;
  if (!Number.isSafeInteger(format) || (format as number) < 1) return unreadable('no format');
  if ((format as number) > current) {
    return { result: { outcome: 'newer', format: format as number }, effects: [{ op: 'write', key: backupKey(city.id, 'newer'), value: raw }] };
  }
  if ((format as number) < current) return { result: { outcome: 'older', format: format as number }, effects: setAside(`older-${format as number}`) };

  const build = (parsed as { build?: unknown }).build;
  const buildProblem = check({ object: { sha: 'string', version: 'string' } }, build, 'build');
  if (buildProblem) return unreadable(buildProblem);
  const savedAt = (parsed as { savedAt?: unknown }).savedAt;
  if (savedAt !== undefined && !(typeof savedAt === 'number' && Number.isFinite(savedAt) && savedAt >= 0)) return unreadable('savedAt is not a time');
  const data = (parsed as { data?: unknown }).data;
  const problem = check(SAVE_SCHEMA, data);
  if (problem) return unreadable(problem);
  const typed = data as SaveData;
  if (typed.city.id !== city.id) return { result: { outcome: 'other-city', city: typed.city }, effects: setAside('other-city') };
  const broken = integrityProblem(typed);
  if (broken) return unreadable(broken);
  const envelope: SaveEnvelope = { format: SAVE_FORMAT, build: build as BuildRef, ...(savedAt === undefined ? {} : { savedAt: savedAt as number }), data: typed };
  if (typed.city.revision !== city.revision || typed.city.hash !== city.hash) return { result: { outcome: 'rebaked', envelope, from: typed.city }, effects: [] };
  return { result: { outcome: 'ok', envelope }, effects: [] };
}
