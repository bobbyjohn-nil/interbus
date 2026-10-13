// I3's strategy sweep on the fixture (`src/sim/economy/strategies.test.ts` holds the verdicts): the
// debug line's day at every setting of peak, off-peak and overnight headway the rules allow, each with
// the buses it needs and no depot, so no deadhead. Prints the best settings, the night-heavy one the
// test compares and a few references. `npm run bench strategies`.
import { bakeSim } from '../tools/bake/sim.mjs';
import { loadCity } from '../src/sim/city/simfile';
import { addDebugLine } from '../src/sim/commands/debugLine';
import { SUBSIDY_PER_BOARDING_CENTS } from '../src/sim/config/economy';
import { forecastDay } from '../src/sim/economy/costs';
import { busesNeeded } from '../src/sim/rules/cycle';
import { checkHeadways, type Headways } from '../src/sim/rules/periods';
import { newGame } from '../src/sim/state';
import { createWorld, recompute } from '../src/sim/world';

const loaded = loadCity(bakeSim('boston', 'mini-boston').text);
if (!loaded.ok) throw new Error(loaded.problem);
const world = createWorld(loaded.city, newGame({ id: 'boston', revision: 'mini-boston', hash: '-' }, { name: 'x', colour: '#000000' }, 1));
addDebugLine(world);
const line = world.state.lines[0]!;

const STEPS = [300, 600, 900, 1_200, 1_800, 2_700, 3_600];
const settings: Headways[] = STEPS.flatMap((peak) => STEPS.flatMap((offpeak) => [null, ...STEPS].map((overnight) => ({ peak, offpeak, overnight })))).filter((h) => checkHeadways(h).ok);
const rows = settings.map((h) => {
  line.headways = h;
  line.buses = busesNeeded(world.services.get(line.id)!.timing.cycle, h);
  recompute(world);
  const riders = world.assignment.lines.get(line.id)!.perDay;
  const c = forecastDay(world.services.get(line.id)!.costs);
  const net = Math.floor(riders) * (line.fareCents + SUBSIDY_PER_BOARDING_CENTS) - c.running - c.wages - c.deadhead;
  return { h, buses: line.buses, riders, net };
});
const best = [...rows].sort((a, b) => b.net - a.net);
const at = (peak: number, offpeak: number, overnight: number | null) => rows.find((r) => r.h.peak === peak && r.h.offpeak === offpeak && r.h.overnight === overnight)!;
const min = (s: number | null) => (s === null ? '—' : String(s / 60));
const show = (label: string, r: (typeof rows)[number]) =>
  console.log(`${label.padEnd(34)} ${min(r.h.peak).padStart(4)} ${min(r.h.offpeak).padStart(4)} ${min(r.h.overnight).padStart(4)}  ${String(r.buses).padStart(2)}  ${r.riders.toFixed(1).padStart(6)}  $${(r.net / 100).toFixed(2)}`);
console.log(`${settings.length} settings the rules allow. Headways in minutes (peak, off-peak, overnight), buses, riders a day, net a day:`);
best.slice(0, 3).forEach((r, k) => show(`best ${k + 1}`, r));
show('daytime longest, overnight shortest', at(3_600, 3_600, 3_600));
show('the starter (every 20 min by day)', at(1_200, 1_200, null));
show('every 5 min by day', at(300, 300, null));
const bestOvernight = best.find((r) => r.h.overnight !== null)!;
show('best with overnight service', bestOvernight);
