import { describe, expect, it } from 'vitest';
import { mint, type LineId, type StopId } from '../core/ids';
import { post } from '../economy/ledger';
import { newGame, type CityRef, type SimState } from '../state';
import { aboutSave, backupKey, decode, encode, fromSaveData, SAVE_FORMAT, saveKey, SET_ASIDE, stateHash, toSaveData } from './save';
import type { SetAsideWhy } from '../types';
import { CALENDAR, schemaHash, SAVE_SCHEMA, type Field } from './schema';
import lock from './schema.lock.json';

const CITY: CityRef = { id: 'boston', revision: 'fixture-mini-boston', hash: 'abc123' };
const BUILD = { sha: '0123456789abcdef0123456789abcdef01234567', version: '0.0.0' };
const TWENTY_MIN = 1200;

function addStop(state: SimState, lon: number, lat: number): StopId {
  const [id, next] = mint(state.nextIds, 'stop');
  state.nextIds = next;
  state.stops.push({ id, lon, lat, tier: 1 });
  return id;
}

function addLine(state: SimState, stopIds: StopId[]): LineId {
  const [id, next] = mint(state.nextIds, 'line');
  state.nextIds = next;
  state.lines.push({ id, name: `Line ${id}`, colour: '#c0392b', stopIds, fareCents: 225, headways: { peak: TWENTY_MIN, offpeak: TWENTY_MIN, overnight: null }, boardedMilli: 1_234_567, buses: 2, model: 'sparrow' });
  return id;
}

/** A game a few days in: stops, a line, income rows and a used RNG. */
function playedGame(): SimState {
  const state = newGame(CITY, { name: 'Back Bay Transit', colour: '#c0392b' }, 2026);
  const stops = [addStop(state, -71.077, 42.3499), addStop(state, -71.0857, 42.3424), addStop(state, -71.095, 42.3375)];
  const line = addLine(state, stops);
  state.stops[1]!.tier = 3; // a Station, so the round trip carries a tier
  for (let day = 1; day <= 3; day++) post(state.ledger, { day, kind: 'fares', amountCents: 1_234 * day, lineId: line });
  for (let i = 0; i < 17; i++) state.rng.next();
  for (const acceptedDay of [2, null]) {
    const [id, next] = mint(state.nextIds, 'contract');
    state.nextIds = next;
    state.contracts.push({ id, landmark: 'Longwood', kind: 'headway', ask: 900, rewardCents: 15_000_000, offeredDay: 1, acceptedDay, daysMet: acceptedDay ? 1 : 0, hoursMissedToday: 3 });
  }
  for (let i = 0; i < 5; i++) state.eventRng.next();
  state.event = { kind: 'roadworks', startDay: 3, endDay: 7, street: 'Huntington Avenue', edges: [12, 13, 40], at: null };
  state.medals = { bronze: 3, silver: null, gold: null };
  state.tripsCarried = 1_234;
  state.tripsToday = 56;
  state.elapsed = 3 * 86_400 + 4_321;
  return state;
}

const raw = (state: SimState, mutate?: (envelope: Record<string, unknown>) => void) => {
  const envelope = JSON.parse(encode(state, BUILD)) as Record<string, unknown>;
  mutate?.(envelope);
  return JSON.stringify(envelope);
};
const dataOf = (envelope: Record<string, unknown>) => envelope.data as Record<string, unknown>;

describe('saves', () => {
  it('round-trips a played game, and save-load-save is identical (I8)', () => {
    const state = playedGame();
    const first = encode(state, BUILD);
    const { result, effects } = decode(first, CITY);
    expect(effects).toEqual([]);
    if (result.outcome !== 'ok') throw new Error(result.outcome);
    const loaded = fromSaveData(result.envelope.data);
    expect(encode(loaded, BUILD)).toBe(first);
    expect(loaded.ledger.cashCents).toBe(state.ledger.cashCents);
    expect(loaded.rng.next()).toBe(state.rng.next());
    expect(loaded.eventRng.next()).toBe(state.eventRng.next());
    expect(loaded.event).toEqual(state.event);
    expect([loaded.medals, loaded.tripsCarried, loaded.tripsToday]).toEqual([{ bronze: 3, silver: null, gold: null }, 1_234, 56]);
    expect(result.envelope.build).toEqual(BUILD);
  });

  it('keeps when it was saved, by the page’s clock, outside the game it holds (the M5 spec, item 4)', () => {
    const state = playedGame();
    const at = 1_791_924_060_000; // 2026-10-13 20:41 UTC
    const { result } = decode(encode(state, BUILD, at), CITY);
    if (result.outcome !== 'ok') throw new Error(result.outcome);
    expect(aboutSave(result.envelope)).toMatchObject({ savedAt: at, lines: state.lines.length, buses: state.lines.reduce((n, l) => n + l.buses, 0) });
    expect(stateHash(fromSaveData(result.envelope.data))).toBe(stateHash(state)); // the time is not the game
    const before = decode(encode(state, BUILD), CITY).result; // a save from before the time was kept
    if (before.outcome !== 'ok') throw new Error(before.outcome);
    expect(aboutSave(before.envelope).savedAt).toBeNull();
  });

  it('keeps a festival’s place, by longitude and latitude (the M4 spec, item 2)', () => {
    const state = playedGame();
    state.event = { kind: 'festival', startDay: 4, endDay: 5, street: 'Copley Square', edges: [], at: { lon: -71.077, lat: 42.3499 } };
    const { result } = decode(encode(state, BUILD), CITY);
    if (result.outcome !== 'ok') throw new Error(result.outcome);
    expect(fromSaveData(result.envelope.data).event).toEqual(state.event);
  });

  it('keeps cash as saved even if k is retuned before the load (I1)', () => {
    const state = playedGame();
    const text = raw(state, (e) => {
      const ledger = dataOf(e).ledger as { amountCents: number }[];
      ledger[0]!.amountCents = 31_000_000; // founded under an older k
    });
    const { result } = decode(text, CITY);
    if (result.outcome !== 'ok') throw new Error(result.outcome);
    expect(fromSaveData(result.envelope.data).ledger.cashCents).toBe(31_000_000 + 1_234 * 6);
  });

  it('holds intent only: no demand, geometry, camera or theme (K12)', () => {
    expect(Object.keys((SAVE_SCHEMA as { object: object }).object).sort()).toEqual(
      ['city', 'clock', 'closesBelowFloor', 'company', 'contractDeck', 'contracts', 'depots', 'event', 'eventRng', 'ledger', 'lines', 'medals', 'nextIds', 'rng', 'stops', 'tripsCarried', 'tripsToday'].sort(),
    );
  });
});

describe('the schema hash (SC-10)', () => {
  it('matches the lock for this format, so an unversioned schema change fails CI', () => {
    expect((lock.formats as Record<string, string>)[String(SAVE_FORMAT)], 'bump SAVE_FORMAT and add the new hash to schema.lock.json').toBe(schemaHash());
  });

  it('lists every format once, each with its own hash', () => {
    const formats = Object.keys(lock.formats).map(Number);
    expect(formats).toEqual(Array.from({ length: SAVE_FORMAT }, (_, i) => i + 1));
    const hashes = Object.values(lock.formats);
    expect(new Set(hashes).size).toBe(hashes.length);
  });

  it('notices any change: a field, a type, a nullable', () => {
    const base = schemaHash();
    const object = (SAVE_SCHEMA as { object: Record<string, Field> }).object;
    expect(schemaHash({ object: { ...object, camera: 'number' } })).not.toBe(base);
    expect(schemaHash({ object: { ...object, clock: { object: { elapsed: 'number' } } } })).not.toBe(base);
    expect(schemaHash({ object: { ...object, clock: { object: { elapsed: { nullable: 'int' } } } } })).not.toBe(base);
  });

  it('notices a calendar change: the same clock falls in another quarter (D25)', () => {
    expect(CALENDAR).toBe('calendar:8/4/1/18000');
    expect(schemaHash(SAVE_SCHEMA, 'calendar:10/4/30/18000')).not.toBe(schemaHash());
  });
});

describe('I7: create, delete, save and load never reuse an id', () => {
  it('holds over a long random session with reloads', () => {
    let state = playedGame();
    const issued = { stop: new Set<number>(state.stops.map((s) => s.id)), line: new Set<number>(state.lines.map((l) => l.id)), depot: new Set<number>() };
    for (let i = 0; i < 600; i++) {
      const roll = state.rng.next();
      if (roll < 0.3) {
        const id = addStop(state, -71.1 + state.rng.next() * 0.03, 42.34 + state.rng.next() * 0.02);
        expect(issued.stop.has(id), `stop ${id} reissued`).toBe(false);
        issued.stop.add(id);
      } else if (roll < 0.42 && state.stops.length >= 2) {
        const id = addLine(state, state.stops.slice(0, 2).map((s) => s.id));
        expect(issued.line.has(id), `line ${id} reissued`).toBe(false);
        issued.line.add(id);
      } else if (roll < 0.5) {
        const [id, next] = mint(state.nextIds, 'depot');
        state.nextIds = next;
        state.depots.push({ id, lon: -71.1 + state.rng.next() * 0.03, lat: 42.34 });
        expect(issued.depot.has(id), `depot ${id} reissued`).toBe(false);
        issued.depot.add(id);
      } else if (roll < 0.62 && state.stops.length > 0) {
        const gone = state.rng.pick(state.stops).id;
        state.stops = state.stops.filter((s) => s.id !== gone);
        for (const line of state.lines) line.stopIds = line.stopIds.filter((id) => id !== gone);
      } else if (roll < 0.7 && state.lines.length > 0) {
        const gone = state.rng.pick(state.lines).id;
        state.lines = state.lines.filter((l) => l.id !== gone);
      } else if (roll < 0.76 && state.depots.length > 0) {
        const gone = state.rng.pick(state.depots).id;
        state.depots = state.depots.filter((d) => d.id !== gone);
      } else {
        const { result } = decode(encode(state, BUILD), CITY);
        if (result.outcome !== 'ok') throw new Error(`${result.outcome}: ${'problem' in result ? result.problem : ''}`);
        state = fromSaveData(result.envelope.data);
      }
    }
    expect(issued.stop.size).toBeGreaterThan(100);
    expect(issued.depot.size).toBeGreaterThan(20);
  });
});

describe('refusals (first failure wins; the live key is never overwritten by one)', () => {
  const state = playedGame();
  const setAside = (why: SetAsideWhy, text: string) => [
    { op: 'write', key: backupKey('boston', why), value: text },
    { op: 'remove', key: saveKey('boston') },
  ];

  it('reports no save as none', () => {
    expect(decode(null, CITY)).toEqual({ result: { outcome: 'none' }, effects: [] });
  });

  it('sets aside a file that is not JSON', () => {
    expect(decode('{not json', CITY)).toEqual({ result: { outcome: 'unreadable', problem: 'not JSON' }, effects: setAside('unreadable', '{not json') });
  });

  it('refuses a newer format and leaves the live key alone', () => {
    const text = raw(state, (e) => void (e.format = SAVE_FORMAT + 5));
    expect(decode(text, CITY)).toEqual({
      result: { outcome: 'newer', format: SAVE_FORMAT + 5 },
      effects: [{ op: 'write', key: backupKey('boston', 'newer'), value: text }],
    });
  });

  it('sets an older format aside with a fresh start, never migrating it (D12)', () => {
    const text = encode(state, BUILD);
    expect(decode(text, CITY, SAVE_FORMAT + 1)).toEqual({ result: { outcome: 'older', format: SAVE_FORMAT }, effects: setAside(`older-${SAVE_FORMAT}`, text) });
  });

  it('keeps each older format under its own key, so a second format change never writes over the first one’s save (DP-06)', () => {
    const text = encode(state, BUILD);
    const [first] = decode(text, CITY, SAVE_FORMAT + 1).effects;
    const [second] = decode(raw(state, (e) => void (e.format = SAVE_FORMAT + 1)), CITY, SAVE_FORMAT + 2).effects;
    expect(first).toMatchObject({ op: 'write', key: `interbus.backup.boston.older-${SAVE_FORMAT}` });
    expect(second).toMatchObject({ op: 'write', key: `interbus.backup.boston.older-${SAVE_FORMAT + 1}` });
    expect(SET_ASIDE).toContain(`older-${SAVE_FORMAT - 1}`);
    expect(SET_ASIDE).toContain('older'); // a backup made before keys carried the format is still listed
  });

  // Export session's file (worker/host.ts SessionFile) wraps a save with a `format: 1` of its own. Shown
  // failing (TS-04) with that read as save format 1, and the file refused as "Saved by an older build".
  it('reads an Export session file as no save, never as one from an older build', () => {
    const session = JSON.stringify({ kind: 'interbus-session', format: 1, build: BUILD, city: CITY, start: encode(state, BUILD), speed: 0, commands: [], end: { elapsed: 0, hash: '0' } });
    expect(decode(session, CITY)).toEqual({ result: { outcome: 'unreadable', problem: 'a session file, not a save' }, effects: setAside('unreadable', session) });
  });

  it('sets aside a file with no format', () => {
    expect(decode(raw(state, (e) => void (e.format = 0)), CITY).result).toEqual({ outcome: 'unreadable', problem: 'no format' });
  });

  it('sets aside another city, never reading it into this one (D12)', () => {
    const worcester = { ...CITY, id: 'worcester' };
    const text = encode({ ...state, city: worcester }, BUILD);
    expect(decode(text, CITY)).toEqual({ result: { outcome: 'other-city', city: worcester }, effects: setAside('other-city', text) });
  });

  it('reads another bake of this city for its stops to go onto this bake’s streets, setting nothing aside yet (the M3 spec, item 8)', () => {
    const text = encode(state, BUILD);
    const { result, effects } = decode(text, { ...CITY, revision: 'r2' });
    expect(result).toMatchObject({ outcome: 'rebaked', from: CITY, envelope: { data: toSaveData(state) } });
    expect(effects).toEqual([]);
  });

  // Each of these V3 read as something: V3 defaulted a missing nextIds to 0 (reissuing live ids),
  // a corrupt cash to $500,000 and a null clock to minute 0 (read.ts:71-77, 182, 187-195).
  const corrupt: [string, (e: Record<string, unknown>) => void, RegExp][] = [
    ['a missing nextIds', (e) => void delete dataOf(e).nextIds, /nextIds: missing/],
    ['a counter at a live id', (e) => void ((dataOf(e).nextIds as { stop: number }).stop = 3), /stop id at or above its counter/],
    ['a corrupt amount', (e) => void ((dataOf(e).ledger as { amountCents: unknown }[])[1]!.amountCents = 'lots'), /amountCents: not a whole number/],
    ['a null clock', (e) => void (dataOf(e).clock = null), /clock: not an object/],
    ['a null stop', (e) => void ((dataOf(e).stops as unknown[])[0] = null), /stops\[0\]: not an object/],
    ['a line naming a missing stop', (e) => void ((dataOf(e).lines as { stopIds: number[] }[])[0]!.stopIds = [1, 99]), /names a missing stop/],
    ['a duplicate stop id', (e) => void ((dataOf(e).stops as { id: number }[])[1]!.id = 1), /duplicate stop id/],
    ['no starting cash first', (e) => void (dataOf(e).ledger as unknown[]).shift(), /starting cash/],
    ['a field not in the schema', (e) => void (dataOf(e).camera = { zoom: 14 }), /camera: not in the schema/],
    ['a night-only line', (e) => void ((dataOf(e).lines as { headways: { overnight: number } }[])[0]!.headways.overnight = 60), /headway rules/],
    // A kept version every 0 seconds made the day's departures loop for ever: the worker hung on import, and held as the autosave every load failed (the systems audit's seventh round).
    ['a kept version every 0 seconds', (e) => void ((dataOf(e).lines as { earlier: unknown[] }[])[0]!.earlier = [{ until: 0, stops: [{ lon: -71.077, lat: 42.3499 }, { lon: -71.095, lat: 42.3375 }], depot: null, model: 'sparrow', routeM: 3_000, pullOutM: 0, pullInM: 0, plan: { cycle: 0, cycles: { peak: 0, offpeak: 0, overnight: 0 }, headways: { peak: 0, offpeak: 0, overnight: null }, buses: 2, oneWayS: 0, pullOutS: 0, pullInS: 0 } }]), /impossible earlier version/],
    ['a stop of no tier', (e) => void ((dataOf(e).stops as { tier: number }[])[0]!.tier = 7), /a stop of no tier/],
    ['a contract at its counter', (e) => void ((dataOf(e).contracts as { id: number }[])[0]!.id = 3), /contract id at or above its counter/],
    ['a contract taken before its offer', (e) => void ((dataOf(e).contracts as { acceptedDay: number }[])[0]!.acceptedDay = 0), /taken before it was offered/],
    ['an event that ends before it starts', (e) => void ((dataOf(e).event as { endDay: number }).endDay = 2), /an event with impossible days or streets/],
    ['an event on one street twice', (e) => void ((dataOf(e).event as { edges: number[] }).edges = [12, 12]), /an event with impossible days or streets/],
    ['a medal from a day not yet played', (e) => void ((dataOf(e).medals as { silver: number }).silver = 9), /a medal awarded on a day not yet played/],
    ['a medal with no day', (e) => void ((dataOf(e).medals as { gold: unknown }).gold = true), /medals.gold: not a whole number/],
    ['more trips today than since founding', (e) => void (dataOf(e).tripsToday = 2_000), /more trips today than since founding/],
    ['snow on a stretch of street', (e) => void ((dataOf(e).event as { kind: string }).kind = 'snow'), /an event whose kind does not match its streets or place/],
    ['a festival with no place', (e) => void Object.assign(dataOf(e).event as object, { kind: 'festival', edges: [] }), /an event whose kind does not match its streets or place/],
    ['a ledger out of day order', (e) => void (dataOf(e).ledger as unknown[]).push({ day: 2, kind: 'fares', amountCents: 100, lineId: 1 }), /a ledger out of day order/],
    ['a ledger row from a day not yet played', (e) => void (dataOf(e).ledger as unknown[]).push({ day: 5, kind: 'fares', amountCents: 100, lineId: 1 }), /a ledger out of day order/],
    ['a saved time that is no time', (e) => void (e.savedAt = 'yesterday'), /savedAt is not a time/],
  ];
  for (const [what, mutate, problem] of corrupt) {
    it(`sets aside ${what} as unreadable`, () => {
      const text = raw(state, mutate);
      const { result, effects } = decode(text, CITY);
      expect(result.outcome).toBe('unreadable');
      expect('problem' in result ? result.problem : '').toMatch(problem);
      expect(effects).toEqual(setAside('unreadable', text));
    });
  }
});

it('a new game starts at founding with one row and fresh counters', () => {
  const data = toSaveData(newGame(CITY, { name: 'X', colour: '#000000' }, 1));
  expect(data.clock.elapsed).toBe(0);
  expect(data.ledger).toEqual([{ day: 0, kind: 'founding', amountCents: 47_454_800, lineId: null }]); // Day 0 (D25)
  expect(data.nextIds).toEqual({ stop: 1, line: 1, bus: 1, depot: 1, contract: 1 });
  expect([data.medals, data.tripsCarried, data.tripsToday]).toEqual([{ bronze: null, silver: null, gold: null }, 0, 0]);
});
