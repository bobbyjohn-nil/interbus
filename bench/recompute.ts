// The recompute bench (PLAN §10 week 3, I14: ≤150 ms p95 on Boston with three periods; R2 needs
// ≤100 ms, D11). `npm run bench` bundles this file as the game's build would (vitest's module
// transform turns every imported constant into a getter call, which tripled the hot loop's time)
// and runs it in Node; never part of the PR checks. Times the demand model's whole recompute
// (assign: every catchment, every pair, all three periods) on the fixture with three lines, on a
// synthetic Inner-Boston-sized grid with T03's network, and, once `node tools/bake/sim.mjs boston
// inner-boston` has baked it, on Inner Boston itself with ten lines along real corridors.
// Results go to .cache/bench/recompute.json.
import { mkdirSync, writeFileSync } from 'node:fs';
import { bakeSim } from '../tools/bake/sim.mjs';
import { addDebugLine } from '../src/sim/commands/debugLine';
import { loadCity } from '../src/sim/city/simfile';
import type { LineId } from '../src/sim/core/ids';
import { assign, type LinePlan } from '../src/sim/demand/assign';
import { buildCommuters } from '../src/sim/demand/commuters';
import { newGame } from '../src/sim/state';
import { createWorld, planLine } from '../src/sim/world';
import { innerBoston } from './inner';
import { syntheticCity, t03Network } from './synthetic';

const RUNS = 30;
/** I14's budget on Boston; R2 (D11) needs ≤100 ms. */
const BUDGET_MS = 150;
const results: Record<string, unknown> = {};

function time(name: string, run: () => void): { p50: number; p95: number } {
  for (let k = 0; k < 3; k++) run(); // warm the JIT
  const ms: number[] = [];
  for (let k = 0; k < RUNS; k++) {
    const t0 = performance.now();
    run();
    ms.push(performance.now() - t0);
  }
  ms.sort((a, b) => a - b);
  const out = { p50: ms[Math.floor(RUNS * 0.5)]!, p95: ms[Math.ceil(RUNS * 0.95) - 1]! };
  results[name] = { ...out, runs: RUNS };
  console.log(`bench: ${name}: p50 ${out.p50.toFixed(1)} ms, p95 ${out.p95.toFixed(1)} ms over ${RUNS} runs`);
  if (out.p95 > BUDGET_MS) {
    console.error(`bench: ${name} is over I14's ${BUDGET_MS} ms`);
    process.exitCode = 1;
  }
  return out;
}

const loaded = loadCity(bakeSim('boston', 'mini-boston').text);
if (!loaded.ok) throw new Error(loaded.problem);
const world = createWorld(loaded.city, newGame({ id: 'boston', revision: 'mini-boston', hash: '-' }, { name: 'x', colour: '#000000' }, 1));
addDebugLine(world);
const debug = planLine(world, world.state.lines[0]!)!;
// Two more lines over the same streets, shifted, so catchments overlap as they will.
const shift = (id: number, dx: number, dy: number): LinePlan => ({ ...debug, id: id as LineId, stops: debug.stops.map(([x, y]) => [x + dx, y + dy] as const) });
const fixturePlans = [debug, shift(2, 300, 200), shift(3, -250, 350)];
time(`mini-Boston ${world.city.cells.length} cells, 3 lines, 3 periods`, () => assign(world.city, world.commuters, fixturePlans));

const city = syntheticCity();
const commuters = buildCommuters(city);
const plans = t03Network();
const stops = plans.reduce((s, p) => s + p.stops.length, 0);
time(`synthetic ${city.cells.length} cells, ${plans.length} lines, ${stops} stops, 3 periods`, () => assign(city, commuters, plans));

const inner = innerBoston();
if (inner) {
  const { world: boston, plans: bostonPlans } = inner;
  results.innerBostonCells = boston.city.cells.length;
  time(`Inner Boston ${boston.city.cells.length} cells, ${bostonPlans.length} lines, ${bostonPlans.reduce((s, p) => s + p.stops.length, 0)} stops, 3 periods`, () => assign(boston.city, boston.commuters, bostonPlans));
}

mkdirSync('.cache/bench', { recursive: true });
writeFileSync('.cache/bench/recompute.json', `${JSON.stringify(results, null, 2)}\n`);
