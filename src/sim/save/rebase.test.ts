// A save from another bake of the city (the M3 spec, item 8): every stop goes onto this bake's
// nearest street node within 150 m, and one that finds none refuses the save by its id; an event on
// the old bake's streets is called off.
import { describe, expect, it } from 'vitest';
import { addDebugLine } from '../commands/debugLine';
import { toXY } from '../core/geo';
import { fixtureGame } from '../testing';
import { rebase } from './rebase';

const onNode = (world: ReturnType<typeof fixtureGame>, s: { lon: number; lat: number }) => world.nodes.nearest(toXY(world.city.frame, [s.lon, s.lat]), 0.01) !== null;

describe('rebasing a save onto another bake', () => {
  it('puts every stop on a street node of this bake, names this bake, and the line still runs', () => {
    const world = fixtureGame();
    addDebugLine(world);
    // Another bake's street node 40 m east of Symphony's.
    const symphony = world.state.stops[1]!;
    world.state.stops[1] = { ...symphony, lon: symphony.lon + 0.0005 };
    // Roadworks on the old bake's edges, which mean nothing on this one.
    world.state.event = { kind: 'roadworks', startDay: 2, endDay: 5, street: 'Huntington Avenue', edges: [1, 2] };
    // And a version from before a change, on the old bake's places.
    world.state.lines[0]!.earlier = [{ until: 0, stops: [{ lon: -71.077, lat: 42.3499 }, { lon: -71.1035, lat: 42.336 }], depot: null, model: 'sparrow', routeM: 3_000, pullOutM: 0, pullInM: 0, plan: { cycle: 1_500, cycles: { peak: 1_500, offpeak: 1_500, overnight: 1_500 }, headways: { peak: 1_200, offpeak: 1_200, overnight: null }, buses: 2, oneWayS: 600, pullOutS: 0, pullInS: 0 } }];
    const r2 = { ...world.state.city, revision: 'r2', hash: 'f'.repeat(64) };
    const result = rebase(world, r2);
    expect(result.ok).toBe(true);
    expect(result.ok && result.moved).toBeGreaterThanOrEqual(1);
    expect(world.state.stops.every((s) => onNode(world, s))).toBe(true);
    expect(world.state.city).toEqual(r2);
    expect(world.state.event).toBeNull();
    expect(world.state.lines[0]!.earlier).toEqual([]);
    expect(world.assignment.lines.get(world.state.lines[0]!.id)!.perDay).toBeGreaterThan(500);
  });

  it('refuses a stop with no street within 150 m, by its id', () => {
    const world = fixtureGame();
    addDebugLine(world);
    const longwood = world.state.stops[3]!;
    world.state.stops[3] = { ...longwood, lon: -71.0, lat: 42.0 };
    expect(rebase(world, { ...world.state.city, hash: 'f'.repeat(64) })).toMatchObject({ ok: false, reason: 'stop_off_street', stopId: longwood.id });
  });
});
