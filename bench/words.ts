// The names' words bench (render/map/overlays.ts nameFeatures): a line's names keep their words, so MapLibre keeps showing them,
// wherever its runs lie where they lay. On Inner Boston's two card-building companies at 12:00 (bench/fixtures), each of the
// route editor's changes to each line: a stop taken off between its ends or at one (removeStop), a stop put in halfway along
// each of its legs (insertStop), and the line run on 300 m from either end, the way it ran there (extendLine). With the line's old
// route standing with its buses as right after the change (loadMap.ts standLines): how many of its runs then lie where a run lay,
// at the same side, under new words, which MapLibre fades in as new names. And how many of a line's runs took other words than
// their start's own (codeOf), as another of its runs had come to them first, which a change before them could undo.
// `npm run bench words`; never part of the PR checks.
import { readFileSync } from 'node:fs';
import { codeOf, nameFeatures, startsAt, wordsOf } from '../src/render/map/overlays';
import { placesOf, runsOf, sidesAlong, type Places } from '../src/render/map/sides';
import { extendLine } from '../src/sim/commands/extendLine';
import { insertStop } from '../src/sim/commands/insertStop';
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
  /** A line's names as the map lays them, by where each lies and its side, and whether each has its start's own words. */
  const names = (line: LineView, places: Places) => {
    const runs = runsOf(line.route, sidesAlong(places, line.id, line.route));
    const starts = startsAt(line.route, runs.map((run) => run.first));
    return nameFeatures(line, runs).map((f, k) => ({
      where: `${f.properties.side}|${f.geometry.coordinates.map((p) => p.join()).join(' ')}`,
      label: f.properties.label,
      own: f.properties.label === wordsOf(line.name, codeOf(starts[k]!)),
    }));
  };
  /** Where stop `id` stands on `world`. */
  const at = (world: World, id: number): [number, number] => {
    const stop = world.state.stops.find((s) => s.id === id)!;
    return [stop.lon, stop.lat];
  };
  for (const seed of [1, 2]) {
    const lines = lineViews(company(seed));
    const before = placesOf(lines);
    let moved = 0;
    for (const line of lines) moved += names(line, before).filter((n) => !n.own).length;
    const tally = new Map<string, { edits: number; touched: number; reworded: number; kept: number }>();
    for (const line of lines) {
      const was = new Map(names(line, before).map((n) => [n.where, n.label]));
      const [id, ids] = [line.id as LineId, line.stopIds];
      const edits: [kind: string, edit: (world: World) => boolean][] = [];
      for (let j = 1; j + 1 < ids.length; j++) edits.push(['a stop taken off between its ends', (w) => removeStop(w, id, ids[j]! as StopId).ok]);
      for (const j of [0, ids.length - 1]) edits.push(['a stop taken off at an end', (w) => removeStop(w, id, ids[j]! as StopId).ok]);
      for (let j = 0; j + 1 < ids.length; j++) {
        edits.push([
          'a stop put in',
          (w) => {
            const [a, b] = [at(w, ids[j]!), at(w, ids[j + 1]!)];
            return insertStop(w, id, [(a[0] + b[0]) / 2 + 0.0002, (a[1] + b[1]) / 2 + 0.0002]).ok;
          },
        ]);
      }
      for (const end of ['start', 'end'] as const) {
        edits.push([
          'the line run on from an end',
          (w) => {
            const [a, b] = end === 'start' ? [at(w, ids[1]!), at(w, ids[0]!)] : [at(w, ids[ids.length - 2]!), at(w, ids[ids.length - 1]!)];
            const k = 300 / Math.hypot((b[0] - a[0]) * 82_000, (b[1] - a[1]) * 111_195);
            return extendLine(w, id, end, [[b[0] + (b[0] - a[0]) * k, b[1] + (b[1] - a[1]) * k]]).ok;
          },
        ]);
      }
      for (const [kind, edit] of edits) {
        const world = company(seed);
        if (!edit(world)) continue;
        const after = lineViews(world);
        const now = after.find((l) => l.id === line.id)!;
        const old = now.settling?.earlier[now.settling.earlier.length - 1]?.route ?? line.route;
        const t = tally.get(kind) ?? { edits: 0, touched: 0, reworded: 0, kept: 0 };
        let reworded = 0;
        for (const n of names(now, placesOf([...after, { id: line.id, route: old }]))) {
          const label = was.get(n.where);
          if (label === undefined) continue;
          if (label === n.label) t.kept++;
          else reworded++;
        }
        t.edits++;
        t.reworded += reworded;
        if (reworded) t.touched++;
        tally.set(kind, t);
      }
    }
    console.log(`the company on seed ${seed} at 12:00, ${lines.length} lines; ${moved} of its runs took other words than their start's own:`);
    for (const [kind, t] of tally) console.log(`  ${kind}: ${t.edits} changes; after ${t.touched} of them, ${t.reworded} runs lying where they lay took new words, and ${t.kept} kept theirs`);
  }
}
