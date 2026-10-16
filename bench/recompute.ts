// The recompute bench (PLAN §10 week 3, I14: ≤150 ms p95 on Boston with three periods; R2 needs
// ≤100 ms, D11). `npm run bench` bundles this file as the game's build would (vitest's module
// transform turns every imported constant into a getter call, which tripled the hot loop's time)
// and runs it in Node; never part of the PR checks. Times the demand model's whole recompute
// (assign: every catchment, every pair, all three periods) on the fixture with three lines, on a
// synthetic Inner-Boston-sized grid with T03's network, and, once `node tools/bake/sim.mjs boston
// inner-boston` has baked it, on Inner Boston itself with ten lines along real corridors, then the
// whole recompute there with five depots.
// Results go to .cache/bench/recompute.json.
import { mkdirSync, writeFileSync } from 'node:fs';
import { bakeSim } from '../tools/bake/sim.mjs';
import { addDebugLine } from '../src/sim/commands/debugLine';
import { loadCity } from '../src/sim/city/simfile';
import { toCalendarTime } from '../src/sim/core/calendar';
import { toLngLat } from '../src/sim/core/geo';
import { mint, type LineId } from '../src/sim/core/ids';
import { assign, type LinePlan } from '../src/sim/demand/assign';
import { buildCommuters } from '../src/sim/demand/commuters';
import { depotNear } from '../src/sim/pacing';
import { newGame } from '../src/sim/state';
import { commutersToday, createWorld, planLine, recompute } from '../src/sim/world';
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
  // A festival's first recompute (the M4 spec's magnitudes: I14 with events on): its flows boosted
  // afresh each run, as at the close that starts it, round Massachusetts Avenue's middle stop. Snow
  // and roadworks change only the plans' times, not the work the assignment does.
  const [lon, lat] = bostonPlans[0]!.stops[6]!;
  const at = toLngLat(boston.city.frame, [lon, lat]);
  const day = toCalendarTime(boston.state.elapsed).day;
  const state = { ...boston.state, event: { kind: 'festival' as const, startDay: day, endDay: day, street: '', edges: [], at: { lon: at[0], lat: at[1] } } };
  time(`Inner Boston on a festival's first day, 3 periods`, () => assign(boston.city, commutersToday({ city: boston.city, commuters: { ...boston.commuters }, state }), bostonPlans));
  // The whole recompute as a building command runs it, with the company's depots as players have them:
  // the five Inner Boston allows (MAX_DEPOTS), each on the depot land nearest the middle of every other
  // corridor, and every line at three Sparrows every 20 minutes, the 30 buses they hold. Each line's
  // drives to and from its depot are routed once, in the warm-up, and read again in the timed runs, as a
  // command that leaves the first stops and depots as they were reads them (the systems audit's fourth
  // round: routing every line from every depot at each recompute took it to 190-240 ms at p50). A
  // command that moves a first stop or adds a depot routes its own new drives once, untimed here.
  for (const line of boston.state.lines) Object.assign(line, { buses: 3, headways: { peak: 1_200, offpeak: 1_200, overnight: null } });
  for (const n of [0, 2, 4, 6, 8]) {
    const stops = bostonPlans[n]!.stops;
    const [lon, lat] = depotNear(boston.city, stops[Math.floor(stops.length / 2)]!);
    const [id, next] = mint(boston.state.nextIds, 'depot');
    boston.state.nextIds = next;
    boston.state.depots.push({ id, lon, lat });
  }
  time(`Inner Boston's whole recompute, ${boston.state.lines.length} lines of 3 Sparrows and ${boston.state.depots.length} depots`, () => recompute(boston));
}

mkdirSync('.cache/bench', { recursive: true });
writeFileSync('.cache/bench/recompute.json', `${JSON.stringify(results, null, 2)}\n`);
