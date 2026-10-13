import { describe, expect, it } from 'vitest';
import { mint, type LineId, type StopId } from '../core/ids';
import { post } from '../economy/ledger';
import { newGame, type CityRef, type SimState } from '../state';
import { backupKey, decode, encode, fromSaveData, SAVE_FORMAT, saveKey, toSaveData } from './save';
import { schemaHash, SAVE_SCHEMA, type Field } from './schema';
import lock from './schema.lock.json';

const CITY: CityRef = { id: 'boston', revision: 'fixture-mini-boston', hash: 'abc123' };
const BUILD = { sha: '0123456789abcdef0123456789abcdef01234567', version: '0.0.0' };
const TWENTY_MIN = 1200;

function addStop(state: SimState, lon: number, lat: number): StopId {
  const [id, next] = mint(state.nextIds, 'stop');
  state.nextIds = next;
  state.stops.push({ id, lon, lat });
  return id;
}

function addLine(state: SimState, stopIds: StopId[]): LineId {
  const [id, next] = mint(state.nextIds, 'line');
  state.nextIds = next;
  state.lines.push({ id, name: `Line ${id}`, colour: '#c0392b', stopIds, fareCents: 225, headways: { peak: TWENTY_MIN, offpeak: TWENTY_MIN, overnight: null }, boardedMilli: 1_234_567, buses: 2 });
  return id;
}

/** A game a few days in: stops, a line, income rows and a used RNG. */
function playedGame(): SimState {
  const state = newGame(CITY, { name: 'Back Bay Transit', colour: '#c0392b' }, 2026);
  const stops = [addStop(state, -71.077, 42.3499), addStop(state, -71.0857, 42.3424), addStop(state, -71.095, 42.3375)];
  const line = addLine(state, stops);
  for (let day = 1; day <= 3; day++) post(state.ledger, { day, kind: 'fares', amountCents: 1_234 * day, lineId: line });
  for (let i = 0; i < 17; i++) state.rng.next();
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
    expect(result.envelope.build).toEqual(BUILD);
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
      ['city', 'clock', 'company', 'depots', 'ledger', 'lines', 'nextIds', 'rng', 'stops'].sort(),
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
  const setAside = (why: 'unreadable' | 'older' | 'other-city', text: string) => [
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
    expect(decode(text, CITY, SAVE_FORMAT + 1)).toEqual({ result: { outcome: 'older', format: SAVE_FORMAT }, effects: setAside('older', text) });
  });

  it('sets aside a file with no format', () => {
    expect(decode(raw(state, (e) => void (e.format = 0)), CITY).result).toEqual({ outcome: 'unreadable', problem: 'no format' });
  });

  it('sets aside another city or revision, never reading it into this one (a rebake, D12)', () => {
    const text = encode(state, BUILD);
    expect(decode(text, { ...CITY, revision: 'r1' })).toEqual({ result: { outcome: 'other-city', city: CITY }, effects: setAside('other-city', text) });
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
    ['no Founding capital first', (e) => void (dataOf(e).ledger as unknown[]).shift(), /Founding capital/],
    ['a field not in the schema', (e) => void (dataOf(e).camera = { zoom: 14 }), /camera: not in the schema/],
    ['a night-only line', (e) => void ((dataOf(e).lines as { headways: { overnight: number } }[])[0]!.headways.overnight = 60), /headway rules/],
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
  expect(data.ledger).toEqual([{ day: 1, kind: 'founding', amountCents: 42_720_000, lineId: null }]);
  expect(data.nextIds).toEqual({ stop: 1, line: 1, bus: 1, depot: 1, contract: 1 });
});
