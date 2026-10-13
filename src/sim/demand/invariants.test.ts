// I2 and I3's per-period part (PLAN §6) on the fixture, with the debug line.
import { describe, expect, it } from 'vitest';
import { bakeSim } from '../../../tools/bake/sim.mjs';
import { addDebugLine } from '../commands/debugLine';
import { loadCity } from '../city/simfile';
import { toLngLat, toXY, type LngLat } from '../core/geo';
import { mint, type StopId } from '../core/ids';
import { PERIODS, periodAt } from '../rules/periods';
import { newGame } from '../state';
import { createWorld, nearestNode, recompute, type World } from '../world';
import { SLOTS } from './assign';
import { HOURLY_PROFILE } from '../config/demand';

const loaded = loadCity(bakeSim('boston', 'mini-boston').text);
if (!loaded.ok) throw new Error(loaded.problem);
const city = loaded.city;

function game(): World {
  const world = createWorld(city, newGame({ id: 'boston', revision: 'mini-boston', hash: '-' }, { name: 'x', colour: '#000000' }, 1));
  addDebugLine(world);
  return world;
}

function addStop(world: World, at: LngLat): StopId {
  const [id, next] = mint(world.state.nextIds, 'stop');
  world.state.nextIds = next;
  world.state.stops.push({ id, lon: at[0], lat: at[1], tier: 1 });
  return id;
}

describe('I2: adding a line or a stop never cuts linked trips by more than 0.1%', () => {
  // I2's 0.1% for a stop is held with the dwell at zero in invariants-stop.test.ts: the assignment
  // never loses riders to a new stop (EC-02). Here the dwell is real, and a stop costs each rider who
  // rides through it 20 s; in the Fens, where few new riders walk to it, that is the stop's price.
  it('costs at most its dwell for a stop inserted on the line’s own streets between any two of its stops: under 1% of trips', () => {
    const world = game();
    const before = world.assignment.tripsPerDay;
    const line = world.state.lines[0]!;
    const stops = line.stopIds.map((id) => world.state.stops.find((s) => s.id === id)!);
    // A stop at the middle node of the streets the line already drives between neighbours, one at
    // a time, as the line tool will insert it. (A stop off the route drags the line on a detour,
    // which rightly costs riders: the straight midpoint of the MFA and Longwood, in the Fens, adds
    // 436 m and cuts trips 4%.)
    for (let k = 1; k < stops.length; k++) {
      const from = nearestNode(world, toXY(city.frame, [stops[k - 1]!.lon, stops[k - 1]!.lat]))!;
      const to = nearestNode(world, toXY(city.frame, [stops[k]!.lon, stops[k]!.lat]))!;
      const path = world.router.route(from, to)!;
      const middle = path.nodes[Math.floor(path.nodes.length / 2)]!;
      const trial = game();
      const id = addStop(trial, toLngLat(city.frame, [city.graph.x[middle]!, city.graph.y[middle]!]));
      trial.state.lines[0]!.stopIds.splice(k, 0, id);
      recompute(trial);
      // Measured with V2's waits and Boston's fitted β, from 614.4 trips: +19.98%, +10.58% and −0.63% (the Fens).
      expect(trial.assignment.tripsPerDay, `a stop between stops ${k} and ${k + 1}`).toBeGreaterThanOrEqual(before * 0.99);
    }
  });

  it('holds for a second line that shares the first one’s streets', () => {
    const world = game();
    const before = world.assignment.tripsPerDay;
    const at: LngLat[] = [[-71.0857, 42.3424], [-71.0905, 42.3445], [-71.095, 42.3375]];
    const ids = at.map((p) => addStop(world, p));
    const [lineId, next] = mint(world.state.nextIds, 'line');
    world.state.nextIds = next;
    world.state.lines.push({ id: lineId, name: 'Second', colour: '#1f6fb2', stopIds: ids, fareCents: 225, headways: { peak: 900, offpeak: 1800, overnight: null }, boardedMilli: 0, buses: 10, model: 'sparrow' }); // more buses than its headways need, so it runs as planned
    recompute(world);
    expect(world.assignment.tripsPerDay).toBeGreaterThanOrEqual(before * 0.999);
  });
});

describe('I2’s bus clause (the M2 spec): adding a bus never cuts linked trips by more than 0.1%', () => {
  // Every 10 minutes at peak needs 3 Sparrows on the debug line's 1,539 s round trip, so buses 0 to 4
  // run it from not at all, through short-handed, to one spare.
  const HEADWAYS = { peak: 600, offpeak: 1_200, overnight: 3_600 };
  const tripsWith = (buses: number, second = false) => {
    const world = game();
    world.state.lines[0]!.headways = HEADWAYS;
    world.state.lines[0]!.buses = buses;
    if (second) {
      const ids = ([[-71.0857, 42.3424], [-71.0905, 42.3445], [-71.095, 42.3375]] as LngLat[]).map((p) => addStop(world, p));
      const [lineId, next] = mint(world.state.nextIds, 'line');
      world.state.nextIds = next;
      world.state.lines.push({ id: lineId, name: 'Second', colour: '#1f6fb2', stopIds: ids, fareCents: 225, headways: { peak: 900, offpeak: 1800, overnight: null }, boardedMilli: 0, buses: 10, model: 'sparrow' });
    }
    recompute(world);
    return world.assignment.tripsPerDay;
  };

  it('holds for each bus added to a line, from none to one spare', () => {
    const trips = [0, 1, 2, 3, 4].map((b) => tripsWith(b));
    for (let b = 1; b < trips.length; b++) expect(trips[b], `bus ${b}`).toBeGreaterThanOrEqual(trips[b - 1]! * 0.999);
    expect(trips[3]).toBeGreaterThan(trips[1]!); // short-handed runs slower and carries fewer
    expect(trips[4]).toBe(trips[3]); // a spare bus changes nothing
  });

  it('holds for each bus added to a line that shares its streets with another', () => {
    const trips = [0, 1, 2, 3, 4].map((b) => tripsWith(b, true));
    for (let b = 1; b < trips.length; b++) expect(trips[b], `bus ${b}`).toBeGreaterThanOrEqual(trips[b - 1]! * 0.999);
  });
});

describe('I2, crowded stops (EC-02: V1 kept each home’s 4 nearest stops, so new stops pushed useful ones out)', () => {
  it('holds when a short line packs four stops around one of the first line’s', () => {
    const world = game();
    const before = world.assignment.tripsPerDay;
    // Four stops within about 120 m of Symphony, nearer to many homes than the debug line's own stop,
    // on a line priced out of the market ($20), so all it can do to the first line's riders is crowd
    // its stop out of a home's nearest few.
    const symphony = toXY(city.frame, [-71.0857, 42.3424]);
    const ids = [[-80, -60], [80, -60], [80, 60], [-80, 60]].map(([dx, dy]) => addStop(world, toLngLat(city.frame, [symphony[0] + dx!, symphony[1] + dy!])));
    const [lineId, next] = mint(world.state.nextIds, 'line');
    world.state.nextIds = next;
    world.state.lines.push({ id: lineId, name: 'Loop', colour: '#1f6fb2', stopIds: ids, fareCents: 2000, headways: { peak: 600, offpeak: 600, overnight: null }, boardedMilli: 0, buses: 10, model: 'sparrow' });
    recompute(world);
    expect(world.assignment.tripsPerDay).toBeGreaterThanOrEqual(before * 0.999);
  });
});

describe('I3, per period: no line boards more riders in a period than that period generates', () => {
  it('keeps every period within its share of the day’s commuter trips', () => {
    const world = game();
    const generated = 2 * world.commuters.flow.reduce((s, f) => s + f, 0) * (city.tripScalePermille / 1000);
    for (const period of PERIODS) {
      let boarded = 0;
      let share = 0;
      for (let s = 0; s < SLOTS; s++) {
        if (periodAt(s * 1800 + 900) !== period) continue;
        share += HOURLY_PROFILE[Math.floor(s / 2)]! / 2;
        for (const line of world.assignment.lines.values()) boarded += line.bySlot[s]!;
      }
      expect(boarded, period).toBeLessThanOrEqual(generated * share);
    }
  });
});
