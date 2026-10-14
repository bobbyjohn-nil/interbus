// The busy scene for the slow-laptop run (the M5 spec, item 9; src/sim/scene.ts), on the fixture: more
// buses than any company can own (five depots of six), all of them on the road at 08:00 on day 1,
// buying nothing but its depots, and a save that reads back as the same game.
import { describe, expect, it } from 'vitest';
import { DEPOT_CAPACITY, MAX_DEPOTS } from './config/depots';
import { toCalendarTime } from './core/calendar';
import { decode, encode, fromSaveData, stateHash } from './save/save';
import { busyScene, FIXTURE_CORRIDORS, SCENE_AT, SCENE_HEADWAYS } from './scene';
import { fixtureCity } from './testing';

const REF = { id: 'boston', revision: 'mini-boston', hash: '-' };

describe('the busy scene, on the fixture', () => {
  const scene = busyScene(fixtureCity(), REF, FIXTURE_CORRIDORS, 1_000);
  const { state } = scene.world;

  it('holds more buses than five depots of six park, every line every 5 minutes', () => {
    expect(scene.buses).toBeGreaterThan(MAX_DEPOTS * DEPOT_CAPACITY);
    expect(scene.depots).toBeLessThanOrEqual(MAX_DEPOTS);
    for (const line of state.lines) expect(line.headways).toEqual(SCENE_HEADWAYS);
    expect(new Set(state.lines.map((l) => l.model))).toEqual(new Set(['sparrow', 'metro40']));
  });

  it('stands at 08:00 on day 1, its capital untouched but for its depots', () => {
    expect(state.elapsed).toBe(SCENE_AT);
    expect(toCalendarTime(state.elapsed).day).toBe(1);
    expect(state.ledger.rows.filter((r) => r.kind === 'depots').length).toBe(scene.depots);
  });

  it('saves to a file that reads back as the same game', () => {
    const read = decode(encode(state, { sha: 'test', version: '0.0.0' }), REF).result;
    expect(read.outcome).toBe('ok');
    if (read.outcome === 'ok') expect(stateHash(fromSaveData(read.envelope.data))).toBe(stateHash(state));
  });
});
