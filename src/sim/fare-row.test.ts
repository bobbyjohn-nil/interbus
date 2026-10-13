// The first-dollar signal (PLAN §10, due Sun Oct 25): one line on the fixture writes a fare row.
// Red means week 3 drops all map work. Also I8 and the day card on a real day of play.
import { describe, expect, it } from 'vitest';
import { bakeSim } from '../../tools/bake/sim.mjs';
import { addDebugLine } from './commands/debugLine';
import { loadCity } from './city/simfile';
import { SECONDS_PER_DAY } from './config/time';
import { decode, encode, fromSaveData } from './save/save';
import { newGame, type CityRef } from './state';
import { advance } from './step';
import { createWorld, type World } from './world';

const baked = bakeSim('boston', 'mini-boston');
const loaded = loadCity(baked.text);
if (!loaded.ok) throw new Error(loaded.problem);
const city = loaded.city;
const REF: CityRef = { id: 'boston', revision: 'mini-boston', hash: baked.sha256 };
const BUILD = { sha: 'test', version: '0.0.0' };

function game(): World {
  const world = createWorld(city, newGame(REF, { name: 'Back Bay Transit', colour: '#c0392b' }, 7));
  const result = addDebugLine(world);
  if (!result.ok) throw new Error(result.reason);
  return world;
}

describe('the first-dollar signal', () => {
  it('one line on the fixture writes a fare row on day 1', () => {
    const world = game();
    advance(world, SECONDS_PER_DAY);
    const fares = world.state.ledger.rows.filter((r) => r.kind === 'fares' && r.day === 1);
    expect(fares.length).toBeGreaterThan(0);
    expect(fares.every((r) => r.lineId === world.state.lines[0]!.id && r.amountCents > 0 && r.amountCents % 225 === 0)).toBe(true);
    const subsidy = world.state.ledger.rows.filter((r) => r.kind === 'subsidy' && r.day === 1);
    expect(subsidy.reduce((s, r) => s + r.amountCents, 0) / 160).toBe(fares.reduce((s, r) => s + r.amountCents, 0) / 225);
  });

  it('closes the day at 24:00 with a card whose rows add up to the change in cash (I1)', () => {
    const world = game();
    const events = advance(world, SECONDS_PER_DAY);
    expect(events.map((e) => e.day)).toEqual([1]);
    const card = events[0]!;
    expect(card.rows.reduce((s, r) => s + r.amountCents, 0)).toBe(card.cashAfterCents - card.cashBeforeCents);
    expect(world.state.ledger.cashCents).toBe(world.state.ledger.rows.reduce((s, r) => s + r.amountCents, 0));
  });

  it('boards nobody overnight while overnight is off (D7)', () => {
    const demand = [...game().assignment.lines.values()][0]!;
    expect([...demand.bySlot.slice(0, 10)].every((b) => b === 0)).toBe(true); // 00:00–05:00
    expect(demand.bySlot[16]! + demand.bySlot[17]!).toBeGreaterThan(demand.bySlot[24]! + demand.bySlot[25]!); // 08:00 above noon
  });

  it('draws riders within a game day at a stop with residents within 300 m (I10)', () => {
    const world = game();
    expect(world.assignment.tripsPerDay).toBeGreaterThan(0);
    advance(world, SECONDS_PER_DAY);
    expect(world.state.lines[0]!.boardedMilli).toBeGreaterThan(0);
  });
});

describe('I8: the sim is the same however it is sliced or saved', () => {
  it('three days in one call equal three days in 72 chunks', () => {
    const one = game();
    advance(one, 3 * SECONDS_PER_DAY);
    const chunked = game();
    for (let k = 0; k < 72; k++) advance(chunked, (3 * SECONDS_PER_DAY) / 72);
    expect(encode(chunked.state, BUILD)).toBe(encode(one.state, BUILD));
  });

  it('a game saved and loaded mid-day plays on exactly as one never saved', () => {
    const straight = game();
    advance(straight, 2 * SECONDS_PER_DAY);
    const saved = game();
    advance(saved, SECONDS_PER_DAY + 7 * 3600 + 1800);
    const text = encode(saved.state, BUILD);
    const { result } = decode(text, REF);
    if (result.outcome !== 'ok') throw new Error(result.outcome);
    const reloaded = createWorld(city, fromSaveData(result.envelope.data));
    expect(encode(reloaded.state, BUILD)).toBe(text);
    advance(reloaded, SECONDS_PER_DAY - 7 * 3600 - 1800);
    expect(encode(reloaded.state, BUILD)).toBe(encode(straight.state, BUILD));
  });
});
