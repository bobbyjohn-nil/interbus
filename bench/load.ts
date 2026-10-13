// G9 (PLAN §5): a city's sim.json loads in 300 ms or less, from its text to a world ready to play,
// as the worker does on init: parse and check (loadCity), then the street grid, the router, the
// commuter matrix and the first recompute (createWorld). `npm run bench load [file…]`; with no file
// it times mini-Boston and, once baked, Inner Boston. The first run in a fresh process is what a
// player waits for, so G9 gates it; it exits non-zero over the budget, and the City sim file
// workflow publishes nothing then.
import { existsSync, readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { loadCity } from '../src/sim/city/simfile';
import { newGame } from '../src/sim/state';
import { createWorld } from '../src/sim/world';

export const LOAD_BUDGET_MS = 300;
const DEFAULTS = ['.cache/bake/boston/sim-mini-boston.json', '.cache/bake/boston/sim-inner-boston.json'];
const files = process.argv.slice(3);

function loadOnce(text: string): { parse: number; world: number } {
  const t0 = performance.now();
  const loaded = loadCity(text);
  if (!loaded.ok) throw new Error(loaded.problem);
  const t1 = performance.now();
  createWorld(loaded.city, newGame({ id: 'boston', revision: '-', hash: '-' }, { name: 'x', colour: '#000000' }, 1));
  return { parse: t1 - t0, world: performance.now() - t1 };
}

let failed = false;
for (const file of files.length ? files : DEFAULTS.filter((f) => existsSync(f))) {
  const text = readFileSync(file, 'utf8');
  const first = loadOnce(text);
  const warm = Array.from({ length: 5 }, () => loadOnce(text)).map((r) => r.parse + r.world).sort((a, b) => a - b);
  const total = first.parse + first.world;
  const ok = total <= LOAD_BUDGET_MS;
  failed ||= !ok;
  console.log(
    `bench: G9 ${file} (${text.length} B): first load ${total.toFixed(1)} ms (${first.parse.toFixed(1)} ms loadCity + ${first.world.toFixed(1)} ms createWorld), warm median ${warm[2]!.toFixed(1)} ms; ${ok ? 'within' : 'OVER'} ${LOAD_BUDGET_MS} ms`,
  );
}
if (failed) process.exitCode = 1;
