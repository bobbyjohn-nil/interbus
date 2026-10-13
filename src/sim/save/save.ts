// Saves, ported from V3 (`Intralines_City@dc63602:src/game/save/`, S02) and reshaped:
// - pure: the sim encodes and decodes; src/platform's async SaveStore reads and writes, and carries
//   out the backups `decode` asks for (a worker has no localStorage);
// - strict: a missing or mistyped field, a null element, a dangling stop or an id at or above its
//   counter refuses the file as unreadable. V3 filled defaults instead, so a file without `nextIds`
//   reissued live ids (K01 class), a corrupt cash became $500,000 and a null clock became minute 0;
// - versioned by the schema hash (schema.lock.json), and an older format is set aside under a
//   backup key with a fresh start, never migrated (D12);
// - the envelope names the build (SHA and version) instead of a typed version string (PR-15).
import { STOP_TIER_IDS, type StopTier } from '../config/stops';
import { ID_KINDS, type DepotId, type IdKind, type LineId, type NextIds, type StopId } from '../core/ids';
import { toCalendarTime } from '../core/calendar';
import { createRng } from '../core/rng';
import type { LedgerRow } from '../economy/ledger';
import { checkHeadways } from '../rules/periods';
import type { SaveAbout } from '../types';
import type { CityRef, SimState } from '../state';
import { check, SAVE_SCHEMA, type SaveData } from './schema';

/** Bump with every schema change, and add the new hash to schema.lock.json (save.test.ts). */
export const SAVE_FORMAT = 8;

export interface BuildRef {
  readonly sha: string;
  readonly version: string;
}

export interface SaveEnvelope {
  readonly format: number;
  readonly build: BuildRef;
  readonly data: SaveData;
}

/** Keys carry no format number, so an old tab still finds a newer save and refuses it. */
export const saveKey = (cityId: string) => `interbus.save.${cityId}`;
export const backupKey = (cityId: string, why: 'unreadable' | 'newer' | 'older' | 'other-city') => `interbus.backup.${cityId}.${why}`;
/** Three slots beside the autosave, which is the live key (the M3 spec, item 8). */
export const SAVE_SLOTS = [1, 2, 3] as const;
export const slotKey = (cityId: string, slot: number) => `interbus.slot.${cityId}.${slot}`;
/** The game as each quarter began, written automatically, for Restart this quarter (the M3 spec, item 10). */
export const quarterKey = (cityId: string) => `interbus.quarter.${cityId}`;

/** A save in a line, for the Saves panel: when it is, the company, its cash and its lines. */
export function aboutSave(data: SaveData): SaveAbout {
  const t = toCalendarTime(data.clock.elapsed);
  return {
    day: t.day,
    hour: t.hour,
    minute: t.minute,
    company: data.company.name,
    cashCents: data.ledger.reduce((sum, r) => sum + r.amountCents, 0),
    lines: data.lines.length,
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
    })),
    ledger: state.ledger.rows.map((r) => ({ day: r.day, kind: r.kind, amountCents: r.amountCents, lineId: r.lineId ?? null })),
    closesBelowFloor: state.closesBelowFloor,
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
    })),
    ledger: { rows, cashCents: rows.reduce((sum, r) => sum + r.amountCents, 0) },
    closesBelowFloor: data.closesBelowFloor,
  };
}

export function encode(state: SimState, build: BuildRef): string {
  const envelope: SaveEnvelope = { format: SAVE_FORMAT, build: { sha: build.sha, version: build.version }, data: toSaveData(state) };
  return JSON.stringify(envelope);
}

/** What only a whole file can show: references, duplicates, counters and the ledger's shape. */
export function integrityProblem(data: SaveData): string | null {
  if (data.clock.elapsed < 0) return 'clock before founding';
  if (data.closesBelowFloor < 0) return 'negative closes below the credit floor';
  const live: Partial<Record<IdKind, number[]>> = { stop: data.stops.map((s) => s.id), line: data.lines.map((l) => l.id), depot: data.depots.map((d) => d.id) };
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
  }
  if (data.ledger[0]?.kind !== 'founding') return 'the ledger does not start with Founding capital';
  if (data.ledger.filter((r) => r.kind === 'founding').length !== 1) return 'more than one Founding capital row';
  if (data.ledger.some((r) => r.day < 1)) return 'a ledger row before day 1';
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
  const setAside = (why: 'unreadable' | 'older' | 'other-city'): StoreEffect[] => [
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
  if ((format as number) < current) return { result: { outcome: 'older', format: format as number }, effects: setAside('older') };

  const build = (parsed as { build?: unknown }).build;
  const buildProblem = check({ object: { sha: 'string', version: 'string' } }, build, 'build');
  if (buildProblem) return unreadable(buildProblem);
  const data = (parsed as { data?: unknown }).data;
  const problem = check(SAVE_SCHEMA, data);
  if (problem) return unreadable(problem);
  const typed = data as SaveData;
  if (typed.city.id !== city.id) return { result: { outcome: 'other-city', city: typed.city }, effects: setAside('other-city') };
  const broken = integrityProblem(typed);
  if (broken) return unreadable(broken);
  const envelope: SaveEnvelope = { format: SAVE_FORMAT, build: build as BuildRef, data: typed };
  if (typed.city.revision !== city.revision || typed.city.hash !== city.hash) return { result: { outcome: 'rebaked', envelope, from: typed.city }, effects: [] };
  return { result: { outcome: 'ok', envelope }, effects: [] };
}
