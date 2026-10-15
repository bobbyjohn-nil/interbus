// The busy scene for the slow-laptop run (the M5 spec, item 9; src/sim/scene.ts): a company on the
// preview's Inner Boston with SCENE_BUSES buses (200 by default, PLAN §6) on the road at 08:00 on day
// 1, written as a save file to import through Saves → Import a save file (then Replace this game, if a
// company is in play): .cache/bench/interbus-boston-<n>-buses.json. It reads the city file the preview
// ships (`npm run cities`), so the save loads there as it is. `npm run bench scene`; the nightly
// uploads it as the busy-scene artifact.
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { loadCity } from '../src/sim/city/simfile';
import { encode } from '../src/sim/save/save';
import { busyScene } from '../src/sim/scene';
import { CORRIDORS } from './inner';

const want = Number(process.env.SCENE_BUSES ?? 200);
const index = JSON.parse(readFileSync('cities/index.json', 'utf8')) as { cities: { id: string; sim?: { file: string; sha256: string; extent: string } }[] };
const entry = index.cities[0]!;
if (!entry.sim) throw new Error('scene: cities/index.json names no sim file');
const text = readFileSync(`public/cities/${entry.sim.file}`, 'utf8');
if (createHash('sha256').update(text).digest('hex') !== entry.sim.sha256) throw new Error(`scene: public/cities/${entry.sim.file} is not the file cities/index.json names; run npm run cities`);
const loaded = loadCity(text);
if (!loaded.ok) throw new Error(loaded.problem);

const t0 = performance.now();
const scene = busyScene(loaded.city, { id: entry.id, revision: entry.sim.extent, hash: entry.sim.sha256 }, CORRIDORS, want);
const build = { sha: execSync('git rev-parse HEAD').toString().trim(), version: (JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }).version };
const out = `.cache/bench/interbus-${entry.id}-${want}-buses.json`;
mkdirSync('.cache/bench', { recursive: true });
writeFileSync(out, encode(scene.world.state, build));
console.log(`scene on ${entry.sim.extent}: ${scene.buses} buses on ${scene.lines} lines from ${scene.depots} depots at 08:00 on day 1, in ${((performance.now() - t0) / 1000).toFixed(1)} s → ${out}`);
for (const l of scene.world.state.lines) console.log(`  ${l.name}: ${l.stopIds.length} stops, ${l.buses} ${l.model}`);
if (scene.buses < want) throw new Error(`scene: the corridors hold only ${scene.buses} buses of ${want}`);
