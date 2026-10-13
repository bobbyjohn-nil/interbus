// Test helpers on the mini-Boston fixture: the baked city, a new game on it, and a spot on its
// depot land. Imported only by tests.
import { bakeSim } from '../../tools/bake/sim.mjs';
import { loadCity, type City } from './city/simfile';
import { placeDepot } from './commands/placeDepot';
import { pointInRing, toLngLat, type LngLat, type XY } from './core/geo';
import { newGame } from './state';
import { createWorld, type World } from './world';

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
