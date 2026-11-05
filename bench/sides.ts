// The street places' bench (render/map/sides.ts): how long the map takes, once a change to the network, to stand each line in
// its place on the streets it shares and each line's route on its side, as `loadMap` works them out for the routes, the buses
// and a click. On Inner Boston, the lines as the worker posts them (host.ts lineViews): the pacing run's card-building
// companies at the bus ceiling (bench/fixtures, as `npm run bench recompute` times them), a late game of 30 lines along the
// corridors (scene.ts lateScene) and the busy scene (busyScene). `npm run bench sides`; never part of the PR checks.
import { readFileSync } from 'node:fs';
import { bridgesOf, placesOf, ribbonGaps, runsOf, sidesAlong, turnsBack } from '../src/render/map/sides';
import { busyScene, lateScene } from '../src/sim/scene';
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
  // The busy scene, as `npm run bench scene` writes it: its turn-backs include one of 169 degrees (#202's review).
  const busy = busyScene(city, { id: 'boston', revision: 'inner-boston', hash: '-' }, CORRIDORS, 200).world;
  recompute(busy);
  worlds.push({ name: 'the busy scene, 200 buses at 08:00', world: busy });

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
    // Where each line's ribbon goes from one run to the next: the widest gap between round caps, in ribbons, with the bridges and
    // without (bridgesOf; a ribbon is 7 px at zoom 16), and the points where a line turns back off the street's middle.
    const p = placesOf(lines);
    // And the corner pieces (bridgesOf's three-point pieces), laid only where the round caps would not carry the ribbon on without
    // one, against every point on along a street or round a corner where the side before stands off the middle, where each was
    // laid before the systems audit's twenty-second round.
    let [cuts, turns, broken, brokenBefore, widest, widestBefore, corners, offMiddle] = [0, 0, 0, 0, 0, 0, 0, 0];
    for (const l of lines) {
      const s = sidesAlong(p, l.id, l.route);
      const runs = runsOf(l.route, s, true);
      cuts += runs.length - 1;
      for (const run of runs.slice(1)) if (turnsBack(l.route, run.first)) turns++;
      offMiddle += runs.slice(1).filter((now, r) => !turnsBack(l.route, now.first) && runs[r]!.side !== 0).length;
      const bridges = bridgesOf(l.route, runs);
      corners += bridges.filter((b) => b.points.length === 3).length;
      const [after, before] = [ribbonGaps(l.route, runs, bridges), ribbonGaps(l.route, runs, [])];
      for (const g of after) if (Math.max(...g) > 1 + 1e-9) broken++;
      for (const g of before) if (Math.max(...g) > 1 + 1e-9) brokenBefore++;
      widest = Math.max(widest, ...after.flat());
      widestBefore = Math.max(widestBefore, ...before.flat());
    }
    console.log(`  ${cuts} points where a ribbon goes from one run to the next, ${turns} of them turn-backs: ${brokenBefore} broke there without bridges, the widest gap ${(Math.max(0, widestBefore - 1) * 7).toFixed(1)} px at zoom 16; with them ${broken}, the widest link ${widest.toFixed(2)} ribbons; a corner piece at ${corners} of the ${offMiddle} on along or round a corner from a side off the middle`);
  }
}
