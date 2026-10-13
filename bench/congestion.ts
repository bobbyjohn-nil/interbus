// What hourly congestion (the M3 spec, item 15) does to round trips and bus counts: each period's
// factor by street class, then the fixture's debug line and Inner Boston's ten corridors, each line's
// rush weight, its round trip at the day's average traffic and in each period, and the buses it needs
// at 10 and 15 minutes with congestion and without, then Inner Boston's riders by period with and
// without. `npm run bench congestion`.
import { bakeSim } from '../tools/bake/sim.mjs';
import { addDebugLine } from '../src/sim/commands/debugLine';
import { loadCity } from '../src/sim/city/simfile';
import { CLASS_RUSH, STREET_RUSH } from '../src/sim/config/traffic';
import { SPARROW } from '../src/sim/config/fleet';
import { busesNeeded, cycleSeconds, cyclesOf } from '../src/sim/rules/cycle';
import { newGame } from '../src/sim/state';
import { periodCongestion } from '../src/sim/traffic/congestion';
import { createWorld, planLine } from '../src/sim/world';
import { assign, type LinePlan } from '../src/sim/demand/assign';
import { PERIODS, periodAt, type Headways } from '../src/sim/rules/periods';
import { innerBoston } from './inner';

const f3 = (v: number) => v.toFixed(3);
for (const [name, rush] of [['motorway and trunk', CLASS_RUSH.motorway!], ['primary and secondary', CLASS_RUSH.primary!], ['tertiary', CLASS_RUSH.tertiary!], ['other streets', STREET_RUSH]] as const) {
  const c = periodCongestion(rush);
  console.log(`congestion, ${name} (${rush}): peak ${f3(c.peak)}, off-peak ${f3(c.offpeak)}, overnight ${f3(c.overnight)}`);
}

const HEADWAYS: [string, Headways][] = [
  ['20 min', { peak: 1_200, offpeak: 1_200, overnight: null }],
  ['10/15 min', { peak: 600, offpeak: 900, overnight: null }],
  ['10 min', { peak: 600, offpeak: 600, overnight: null }],
];
let before = 0;
let after = 0;
function report(name: string, plan: LinePlan): void {
  const routeM = plan.stopDistM[plan.stopDistM.length - 1]!;
  const cycle = cycleSeconds(routeM, plan.stops.length, SPARROW.kmh);
  const cycles = cyclesOf(routeM, plan.stops.length, SPARROW.kmh, plan.rush ?? 0);
  const buses = HEADWAYS.map(([label, h]) => {
    const was = busesNeeded(cycle, h);
    const now = busesNeeded(cycles, h);
    if (label === '10/15 min') {
      before += was;
      after += now;
    }
    return `${label} ${was}→${now}`;
  });
  console.log(`${name}: ${(routeM / 1000).toFixed(1)} km, rush ${f3(plan.rush ?? 0)}; round trip ${cycle} s, peak ${cycles.peak}, off-peak ${cycles.offpeak}, overnight ${cycles.overnight}; buses ${buses.join(', ')}`);
}

const loaded = loadCity(bakeSim('boston', 'mini-boston').text);
if (!loaded.ok) throw new Error(loaded.problem);
const world = createWorld(loaded.city, newGame({ id: 'boston', revision: 'mini-boston', hash: '-' }, { name: 'x', colour: '#000000' }, 1));
addDebugLine(world);
report('fixture, debug line', planLine(world, world.state.lines[0]!)!);
before = 0;
after = 0;
const inner = innerBoston();
if (inner) {
  inner.plans.forEach((plan, n) => report(inner.names[n]!, plan));
  console.log(`Inner Boston's ten corridors at 10/15 min: ${before} buses without congestion, ${after} with`);
  // And the riders: the same plans with no rush, then with their routes' own.
  const calm = assign(inner.world.city, inner.world.commuters, inner.plans.map((p) => ({ ...p, rush: 0 })));
  const busy = assign(inner.world.city, inner.world.commuters, inner.plans);
  const periods = (a: typeof calm) => PERIODS.map((p) => [...a.lines.values()].reduce((sum, d) => sum + d.bySlot.reduce((s, v, k) => s + (periodAt(k * 1800 + 900) === p ? v : 0), 0), 0));
  const [c, b] = [periods(calm), periods(busy)];
  console.log(`Inner Boston's riders a day: ${calm.tripsPerDay.toFixed(1)} without congestion, ${busy.tripsPerDay.toFixed(1)} with (${(((busy.tripsPerDay - calm.tripsPerDay) / calm.tripsPerDay) * 100).toFixed(2)}%); boardings at peak ${c[0]!.toFixed(1)} → ${b[0]!.toFixed(1)}, off-peak ${c[1]!.toFixed(1)} → ${b[1]!.toFixed(1)}, overnight ${c[2]!.toFixed(1)} → ${b[2]!.toFixed(1)}`);
}
