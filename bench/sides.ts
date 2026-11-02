// The street places' bench (render/map/sides.ts): how long the map takes, once a change to the network, to stand each line in
// its place on the streets it shares and each line's route on its side, as `loadMap` works them out for the routes, the buses
// and a click. On Inner Boston, the lines as the worker posts them (host.ts lineViews): the pacing run's card-building
// companies at the bus ceiling (bench/fixtures, as `npm run bench recompute` times them) and a late game of 30 lines along the
// corridors (scene.ts lateScene). `npm run bench sides`; never part of the PR checks.
import { readFileSync } from 'node:fs';
import { placesOf, sidesAlong } from '../src/render/map/sides';
import { lateScene } from '../src/sim/scene';
import { fromSaveData } from '../src/sim/save/save';
import type { SaveData } from '../src/sim/save/schema';
import { createWorld, recompute, type World } from '../src/sim/world';
import { lineViews } from '../src/worker/host';
import { CORRIDORS, innerBostonCity } from './inner';

const RUNS = 50;
const city = innerBostonCity();
if (!city) {
  console.log('bench: Inner Boston skipped; fetch it with `npm run cities`');
} else {
  const worlds: { name: string; world: World }[] = [];
  for (const seed of [1, 2]) {
    const kept = JSON.parse(readFileSync(`bench/fixtures/lategame-card-s${seed}.json`, 'utf8')) as { readonly company: SaveData };
    const world = createWorld(city, fromSaveData(kept.company));
    recompute(world);
    worlds.push({ name: `the pacing run's company on seed ${seed} at the bus ceiling`, world });
  }
  const late = lateScene(city, { id: 'boston', revision: 'inner-boston', hash: '-' }, CORRIDORS, 30);
  recompute(late);
  worlds.push({ name: 'a late game along the corridors', world: late });

  const at = (xs: readonly number[], q: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(q * xs.length))]!;
  for (const { name, world } of worlds) {
    const lines = lineViews(world);
    const points = lines.reduce((n, l) => n + l.route.length, 0);
    const [places, sides]: [number[], number[]] = [[], []];
    // Five runs to warm up, then RUNS timed.
    for (let r = 0; r < RUNS + 5; r++) {
      const t0 = performance.now();
      const p = placesOf(lines);
      const t1 = performance.now();
      for (const l of lines) sidesAlong(p, l.id, l.route);
      const t2 = performance.now();
      if (r < 5) continue;
      places.push(t1 - t0);
      sides.push(t2 - t1);
    }
    const shared = [...placesOf(lines).values()].filter((h) => h.length > 1).length;
    const ms = (xs: number[]) => `${at(xs, 0.5).toFixed(2)} ms at p50 and ${at(xs, 0.95).toFixed(2)} at p95`;
    console.log(`${name}, ${lines.length} lines of ${points} points, ${shared} segments shared: the places ${ms(places)}; every line's sides ${ms(sides)}`);
  }
}
