// The recompute bench (PLAN §10 week 3, I14: ≤150 ms p95 on Boston with three periods; R2 needs
// ≤100 ms, D11). `npm run bench` bundles this file as the game's build would (vitest's module
// transform turns every imported constant into a getter call, which tripled the hot loop's time)
// and runs it in Node; never part of the PR checks. Times the demand model's whole recompute
// (assign: every catchment, every pair, all three periods) on the fixture with three lines, on a
// synthetic Inner-Boston-sized grid with T03's network, and, once `node tools/bake/sim.mjs boston
// inner-boston` has baked it, on Inner Boston itself with ten lines along real corridors.
// Results go to .cache/bench/recompute.json.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { bakeSim } from '../tools/bake/sim.mjs';
import { addDebugLine } from '../src/sim/commands/debugLine';
import { loadCity } from '../src/sim/city/simfile';
import { mint, type LineId } from '../src/sim/core/ids';
import { assign, type LinePlan } from '../src/sim/demand/assign';
import { buildCommuters } from '../src/sim/demand/commuters';
import { newGame } from '../src/sim/state';
import { createWorld, planLine } from '../src/sim/world';
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

// Inner Boston with ten lines along real corridors, 116 stops as in T03: each line's stops are
// spaced evenly between its ends and snap to the street graph as the line tool's will.
const INNER = '.cache/bake/boston/sim-inner-boston.json';
const CORRIDORS: [name: string, from: [number, number], to: [number, number], stops: number][] = [
  ['Massachusetts Avenue', [-71.119, 42.3736], [-71.0838, 42.3293], 12],
  ['Huntington Avenue', [-71.0776, 42.3496], [-71.111, 42.3285], 12],
  ['Washington Street', [-71.0603, 42.3555], [-71.0985, 42.317], 12],
  ['Columbia Road', [-71.0571, 42.3302], [-71.087, 42.319], 12],
  ['Cambridge Street', [-71.0767, 42.3706], [-71.119, 42.3736], 12],
  ['Commonwealth Avenue', [-71.0953, 42.3488], [-71.13, 42.3519], 11],
  ['Beacon Street', [-71.0953, 42.3488], [-71.1495, 42.3361], 11],
  ['Dorchester Avenue', [-71.0552, 42.3523], [-71.0524, 42.3209], 11],
  ['East Boston', [-71.0396, 42.3691], [-71.0047, 42.3868], 11],
  ['Broadway, Somerville', [-71.0768, 42.384], [-71.1218, 42.3967], 12],
];
if (existsSync(INNER)) {
  const inner = loadCity(readFileSync(INNER, 'utf8'));
  if (!inner.ok) throw new Error(inner.problem);
  const boston = createWorld(inner.city, newGame({ id: 'boston', revision: 'inner-boston', hash: '-' }, { name: 'x', colour: '#000000' }, 1));
  const bostonPlans = CORRIDORS.map(([name, from, to, count], n) => {
    const stopIds = Array.from({ length: count }, (_, k) => {
      const t = k / (count - 1);
      const [id, next] = mint(boston.state.nextIds, 'stop');
      boston.state.nextIds = next;
      boston.state.stops.push({ id, lon: from[0] + (to[0] - from[0]) * t, lat: from[1] + (to[1] - from[1]) * t });
      return id;
    });
    const [id, next] = mint(boston.state.nextIds, 'line');
    boston.state.nextIds = next;
    const line = { id, name, colour: '#1f6fb2', stopIds, fareCents: 225, headways: { peak: 600, offpeak: 900, overnight: n % 3 === 0 ? 1800 : null }, boardedMilli: 0 };
    boston.state.lines.push(line);
    const plan = planLine(boston, line);
    if (!plan) throw new Error(`bench: ${name} does not route`);
    return plan;
  });
  results.innerBostonCells = inner.city.cells.length;
  time(`Inner Boston ${inner.city.cells.length} cells, ${bostonPlans.length} lines, ${bostonPlans.reduce((s, p) => s + p.stops.length, 0)} stops, 3 periods`, () => assign(inner.city, boston.commuters, bostonPlans));
} else {
  console.log(`bench: Inner Boston skipped; bake it with \`node tools/bake/sim.mjs boston inner-boston\``);
}

mkdirSync('.cache/bench', { recursive: true });
writeFileSync('.cache/bench/recompute.json', `${JSON.stringify(results, null, 2)}\n`);
