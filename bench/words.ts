// The names' words bench (render/map/overlays.ts nameFeatures): a line's names keep their words, so MapLibre keeps showing them,
// wherever its runs lie where they lay. On Inner Boston's two card-building companies at 12:00 (bench/fixtures), for each line and
// each of its stops between its ends, the stop taken off (removeStop, as the route editor's Remove and Save route do), the line's
// old route standing with its buses as right after the change (loadMap.ts standLines): how many of its runs then lie where a run
// lay, at the same side, under new words, which MapLibre fades in as new names. And how many of a line's runs share their words,
// which MapLibre would join or space apart. `npm run bench words`; never part of the PR checks.
import { readFileSync } from 'node:fs';
import { nameFeatures } from '../src/render/map/overlays';
import { placesOf, runsOf, sidesAlong, type Places } from '../src/render/map/sides';
import { removeStop } from '../src/sim/commands/removeStop';
import type { LineId, StopId } from '../src/sim/core/ids';
import { fromSaveData } from '../src/sim/save/save';
import type { SaveData } from '../src/sim/save/schema';
import type { LineView } from '../src/sim/types';
import { createWorld, recompute, type World } from '../src/sim/world';
import { lineViews } from '../src/worker/host';
import { innerBostonCity } from './inner';

const city = innerBostonCity();
if (!city) {
  console.log('bench: Inner Boston skipped; fetch it with `npm run cities`');
} else {
  /** The company on `seed` at 12:00 of its day. */
  const company = (seed: number): World => {
    const kept = JSON.parse(readFileSync(`bench/fixtures/lategame-card-s${seed}.json`, 'utf8')) as { readonly company: SaveData & { clock: { elapsed: number } } };
    const data = structuredClone(kept.company);
    const START = 5 * 3_600;
    data.clock.elapsed = Math.floor((data.clock.elapsed + START) / 86_400) * 86_400 + 12 * 3_600 - START;
    const world = createWorld(city, fromSaveData(data));
    recompute(world);
    return world;
  };
  /** A line's names as the map lays them, by where each lies and its side. */
  const names = (line: LineView, places: Places) => {
    const runs = runsOf(line.route, sidesAlong(places, line.id, line.route));
    return nameFeatures(line, runs).map((f) => ({ where: `${f.properties.side}|${f.geometry.coordinates.map((p) => p.join()).join(' ')}`, label: f.properties.label }));
  };
  for (const seed of [1, 2]) {
    const lines = lineViews(company(seed));
    const before = placesOf(lines);
    let shared = 0;
    for (const line of lines) {
      const labels = names(line, before).map((n) => n.label);
      shared += labels.length - new Set(labels).size;
    }
    let [edits, touched, reworded, kept] = [0, 0, 0, 0];
    for (const line of lines) {
      const was = new Map(names(line, before).map((n) => [n.where, n.label]));
      for (let j = 1; j + 1 < line.stopIds.length; j++) {
        const world = company(seed);
        if (!removeStop(world, line.id as LineId, line.stopIds[j]! as StopId).ok) continue;
        edits++;
        const after = lineViews(world);
        const now = after.find((l) => l.id === line.id)!;
        const old = now.settling?.earlier[now.settling.earlier.length - 1]?.route ?? line.route;
        let moved = 0;
        for (const n of names(now, placesOf([...after, { id: line.id, route: old }]))) {
          const label = was.get(n.where);
          if (label === undefined) continue;
          if (label === n.label) kept++;
          else moved++;
        }
        reworded += moved;
        if (moved) touched++;
      }
    }
    console.log(`the company on seed ${seed} at 12:00, ${lines.length} lines: ${edits} stops that can come off a line between its ends; after ${touched} of them, ${reworded} runs lying where they lay took new words, and ${kept} kept theirs; ${shared} of a line's runs share their words with another of its runs`);
  }
}
