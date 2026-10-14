// Medals at a day's close (the M4 spec, item 3): bronze from the first quarter's card at 55 or more,
// silver at 25,000 trips carried, which puts the Goliath on sale; each once. A trip counts as its
// fare banks, so a change onto a second line, which boards free (EC-04), is not counted again.
import { describe, expect, it } from 'vitest';
import { setModel } from './commands/setModel';
import { createLine } from './commands/createLine';
import { addDebugLine } from './commands/debugLine';
import { placeDepot } from './commands/placeDepot';
import { SILVER_TRIPS } from './config/medals';
import { SECONDS_PER_DAY } from './config/time';
import { foundLedger } from './economy/ledger';
import { newGame } from './state';
import { advance, type SimEvent } from './step';
import { COPLEY, fixtureCity, KENMORE, onDepotLand } from './testing';
import { createWorld, type World } from './world';

/** A company founded with a million dollars, a depot and the debug line every 20 minutes. */
function company(): World {
  const world = createWorld(fixtureCity(), { ...newGame({ id: 'boston', revision: 'mini-boston', hash: '-' }, { name: 'x', colour: '#000000' }, 7), ledger: foundLedger(100_000_000) });
  if (!placeDepot(world, onDepotLand()).ok || !addDebugLine(world).ok) throw new Error('no line');
  return world;
}

const closes = (events: SimEvent[]) => events.filter((e) => e.kind === 'day-closed');

describe('medals at the close', () => {
  it('counts each trip once as its fare banks, a change onto a second line not again, and starts each day afresh', () => {
    const world = company();
    if (!createLine(world, [COPLEY, KENMORE]).ok) throw new Error('no Kenmore line');
    const transfers = [...world.assignment.lines.values()].reduce((n, d) => n + d.transfersByStop.reduce((a, b) => a + b, 0), 0);
    expect(transfers).toBeGreaterThan(10);
    const [day1] = closes(advance(world, SECONDS_PER_DAY));
    const banked = world.state.lines.reduce((n, l) => n + Math.floor(l.boardedMilli / 1000), 0);
    expect(world.state.tripsCarried).toBe(banked);
    expect(day1!.trips).toBe(banked);
    expect(world.state.tripsToday).toBe(0);
    const [day2] = closes(advance(world, SECONDS_PER_DAY));
    expect(world.state.tripsCarried).toBe(banked + day2!.trips);
  });

  it('awards bronze at the first quarter’s close graded 55 or more, and never again', () => {
    const world = company();
    const days = closes(advance(world, 16 * SECONDS_PER_DAY));
    const eighth = days[7]!; // a quarter is eight days (D25)
    expect(eighth.card!.overall).toBeGreaterThanOrEqual(55);
    expect(days.map((d) => d.medals.join())).toEqual(days.map((d) => (d.day === 8 ? 'bronze' : '')));
    expect(days[15]!.card!.overall).toBeGreaterThanOrEqual(55);
    expect(world.state.medals).toEqual({ bronze: 8, silver: null, gold: null });
  });

  it('awards silver at the close that passes 25,000 trips, once, and the Goliath is for sale from then on', () => {
    const world = company();
    const lineId = world.state.lines[0]!.id;
    world.state.tripsCarried = SILVER_TRIPS - 100;
    expect(setModel(world, lineId, 'goliath')).toEqual({ ok: false, reason: 'model_locked' });
    const [day1] = closes(advance(world, SECONDS_PER_DAY));
    expect(day1!.medals).toEqual(['silver']);
    expect(world.state.medals.silver).toBe(1);
    expect(setModel(world, lineId, 'goliath')).toMatchObject({ ok: true });
    expect(world.state.lines[0]!.model).toBe('goliath');
    const [day2] = closes(advance(world, SECONDS_PER_DAY));
    expect(day2!.medals).toEqual([]);
    expect(world.state.medals.silver).toBe(1);
  });
});
