// Test helpers on the mini-Boston fixture: the baked city, a new game on it, and a spot on its
// depot land. Imported only by tests.
import { bakeSim } from '../../tools/bake/sim.mjs';
import { loadCity, type City } from './city/simfile';
import { acceptContract } from './commands/acceptContract';
import { addDebugLine } from './commands/debugLine';
import { placeDepot } from './commands/placeDepot';
import { SPARROW } from './config/fleet';
import { SECONDS_PER_DAY } from './config/time';
import { pointInRing, toLngLat, type LngLat, type XY } from './core/geo';
import { landmarkHeadways, rollOffers } from './economy/contracts';
import { busesNeeded, cycleSeconds } from './rules/cycle';
import { newGame } from './state';
import { advance } from './step';
import { createWorld, planLine, recompute, type World } from './world';

let city: City | null = null;

export function fixtureCity(): City {
  if (city) return city;
  const loaded = loadCity(bakeSim('boston', 'mini-boston').text);
  if (!loaded.ok) throw new Error(loaded.problem);
  return (city = loaded.city);
}

export function fixtureGame(seed = 7): World {
  return createWorld(fixtureCity(), newGame({ id: 'boston', revision: 'mini-boston', hash: '-' }, { name: 'Back Bay Transit', colour: '#c0392b' }, seed));
}

/** A point inside the fixture's largest parcel of depot land. */
export function onDepotLand(): LngLat {
  const c = fixtureCity();
  const ring = [...c.depotLand].sort((a, b) => b.length - a.length)[0]!;
  const [cx, cy] = ring.reduce(([x, y], p) => [x + p[0] / ring.length, y + p[1] / ring.length], [0, 0]);
  for (let t = 0; t <= 1; t += 0.05) {
    const p: XY = [cx + (ring[0]![0] - cx) * t, cy + (ring[0]![1] - cy) * t];
    if (pointInRing(ring, p)) return toLngLat(c.frame, p);
  }
  throw new Error('no point inside the parcel');
}

/** A game with a depot on the fixture's largest parcel. */
export function gameWithDepot(seed = 7): World {
  const world = fixtureGame(seed);
  const placed = placeDepot(world, onDepotLand());
  if (!placed.ok) throw new Error(placed.reason);
  return world;
}

/**
 * I11's company (the M3 spec, item 11): the debug line every 10 minutes all day, so it meets any ask
 * at Copley Square and Longwood, taking every offer it meets at each day's start. Its contract income
 * over `days`, in cents: the test holds 10 seeds within 30% of their median; `npm run bench contracts`
 * measures more.
 */
export function contractIncome(seed: number, days: number): number {
  const world = gameWithDepot(seed);
  if (!addDebugLine(world).ok) throw new Error('no debug line');
  rollOffers(world, 1);
  const line = world.state.lines[0]!;
  line.headways = { peak: 600, offpeak: 600, overnight: null };
  const plan = planLine(world, line)!;
  line.buses = busesNeeded(cycleSeconds(plan.stopDistM.at(-1)!, plan.stops.length, SPARROW.kmh), line.headways);
  recompute(world);
  for (let day = 1; day <= days; day++) {
    const figures = landmarkHeadways(world);
    for (const c of world.state.contracts) if (c.acceptedDay === null && (figures.get(c.landmark) ?? Infinity) <= c.askSeconds) acceptContract(world, c.id);
    advance(world, SECONDS_PER_DAY);
  }
  return world.state.ledger.rows.filter((r) => r.kind === 'contract').reduce((s, r) => s + r.amountCents, 0);
}
