// Test helpers on the mini-Boston fixture: the baked city, a new game on it, and a spot on its
// depot land. Imported only by tests.
import { bakeSim } from '../../tools/bake/sim.mjs';
import { loadCity, type City } from './city/simfile';
import { acceptContract } from './commands/acceptContract';
import { createLine } from './commands/createLine';
import { addDebugLine } from './commands/debugLine';
import { placeDepot } from './commands/placeDepot';
import { SECONDS_PER_DAY } from './config/time';
import { pointInRing, toLngLat, type LngLat, type XY } from './core/geo';
import { landmarkFigures, rollOffers } from './economy/contracts';
import { contractMet } from './rules/contract';
import { busesNeeded } from './rules/cycle';
import { newGame } from './state';
import { advance } from './step';
import { createWorld, recompute, type World } from './world';

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

/** The fixture's Copley Square stop on the debug line, and a stop at Kenmore (e2e/transfer.spec.ts). */
export const COPLEY: LngLat = [-71.077, 42.3499];
export const KENMORE: LngLat = [-71.09721, 42.34883];

/** A game with a depot on the fixture's largest parcel. */
export function gameWithDepot(seed = 7): World {
  const world = fixtureGame(seed);
  const placed = placeDepot(world, onDepotLand());
  if (!placed.ok) throw new Error(placed.reason);
  return world;
}

/**
 * I11's company (the M3 spec, item 11; the M4 spec, item 1): the debug line and a line from Copley to
 * Kenmore, both every 10 minutes all day, so it serves every fixture landmark and meets any HEADWAY ask
 * and RIDERSHIP's 150 at Copley and Kenmore, taking every offer it meets at each day's start. A company
 * that serves only some landmarks earns by where the asks land, not by how they are dealt (GD-04:
 * "comparable play"; DECISIONS, Measured). Its contract income over `days`, in cents: the test holds
 * 10 seeds within 30% of their median; `npm run bench contracts` measures more.
 */
export function contractIncome(seed: number, days: number): number {
  const world = gameWithDepot(seed);
  if (!addDebugLine(world).ok) throw new Error('no debug line');
  if (!createLine(world, [COPLEY, KENMORE]).ok) throw new Error('no Kenmore line');
  rollOffers(world, 1);
  for (const line of world.state.lines) line.headways = { peak: 600, offpeak: 600, overnight: null };
  recompute(world);
  for (const line of world.state.lines) line.buses = busesNeeded(world.services.get(line.id)!.timing.cycles!, line.headways);
  recompute(world);
  for (let day = 1; day <= days; day++) {
    const figures = landmarkFigures(world);
    for (const c of world.state.contracts) if (c.acceptedDay === null && contractMet(c.kind, figures.get(c.landmark)?.[c.kind] ?? null, c.ask)) acceptContract(world, c.id);
    advance(world, SECONDS_PER_DAY);
  }
  return world.state.ledger.rows.filter((r) => r.kind === 'contract').reduce((s, r) => s + r.amountCents, 0);
}
