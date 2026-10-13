// How far the fast assignment's riders sit from the reference loop's (src/sim/demand/reference),
// per line and period, on the fixture and on the synthetic grid. `npm run bench compare`; the
// reference takes about 13 s on the grid. assign.test.ts holds the fixture to these numbers.
import { bakeSim } from '../tools/bake/sim.mjs';
import { addDebugLine } from '../src/sim/commands/debugLine';
import { loadCity, type City } from '../src/sim/city/simfile';
import type { LineId } from '../src/sim/core/ids';
import { assign, spread, SLOTS, type LinePlan } from '../src/sim/demand/assign';
import { buildCommuters, type Commuters } from '../src/sim/demand/commuters';
import { assignNaive } from '../src/sim/demand/reference/assignNaive';
import { PERIODS, periodAt } from '../src/sim/rules/periods';
import { newGame } from '../src/sim/state';
import { createWorld, planLine } from '../src/sim/world';
import { syntheticCity, t03Network } from './synthetic';

const pct = (got: number, want: number) => (want === 0 ? (got === 0 ? '0' : 'new') : `${(((got - want) / want) * 100).toFixed(2)}%`);
const byPeriod = (slots: Float64Array) => PERIODS.map((p) => slots.reduce((sum, v, s) => sum + (s < SLOTS && periodAt(s * 1800 + 900) === p ? v : 0), 0));

function compare(name: string, city: City, commuters: Commuters, plans: LinePlan[]): void {
  const fast = assign(city, commuters, plans);
  const ref = spread(plans, assignNaive(city, commuters, plans));
  let worst = 0;
  for (const plan of plans) {
    const got = byPeriod(fast.lines.get(plan.id)!.bySlot);
    const want = byPeriod(ref.lines.get(plan.id)!.bySlot);
    PERIODS.forEach((_, k) => {
      if (want[k]! > 0) worst = Math.max(worst, Math.abs(got[k]! - want[k]!) / want[k]!);
    });
    console.log(`${name} line ${plan.id}: ${PERIODS.map((p, k) => `${p} ${got[k]!.toFixed(1)} vs ${want[k]!.toFixed(1)} (${pct(got[k]!, want[k]!)})`).join(', ')}`);
  }
  console.log(`${name}: trips ${fast.tripsPerDay.toFixed(1)} vs ${ref.tripsPerDay.toFixed(1)} (${pct(fast.tripsPerDay, ref.tripsPerDay)}); worst line-period ${(worst * 100).toFixed(2)}%`);
}

const loaded = loadCity(bakeSim('boston', 'mini-boston').text);
if (!loaded.ok) throw new Error(loaded.problem);
const world = createWorld(loaded.city, newGame({ id: 'boston', revision: 'mini-boston', hash: '-' }, { name: 'x', colour: '#000000' }, 1));
addDebugLine(world);
const debug = planLine(world, world.state.lines[0]!)!;
const shifted = (id: number, dx: number, dy: number, change: Partial<LinePlan> = {}): LinePlan => ({ ...debug, id: id as LineId, stops: debug.stops.map(([x, y]) => [x + dx, y + dy] as const), ...change });
compare('fixture, debug line', world.city, world.commuters, [debug]);
compare('fixture, four overlapping lines', world.city, world.commuters, [
  debug,
  shifted(2, 300, 200, { headways: { peak: 600, offpeak: 900, overnight: 1800 } }),
  shifted(3, -250, 350, { fareCents: 300 }),
  shifted(4, 60, -40, { fareCents: 150, headways: { peak: 900, offpeak: 900, overnight: null } }),
]);
const city = syntheticCity();
compare('synthetic grid, T03', city, buildCommuters(city), t03Network());
