// Crowding (K27) on Inner Boston's ten corridor lines (bench/inner.ts): each line's riders, the
// riders full buses turn away and when, with Sparrows every 10 min at peak and 15 off-peak, with
// Metro 40s on the same headways, and with Sparrows on the starter's 20. `npm run bench crowding`.
import { BUS_MODELS, type BusModel } from '../src/sim/config/fleet';
import { assign, type LinePlan } from '../src/sim/demand/assign';
import { innerBoston } from './inner';

const inner = innerBoston();
if (inner) {
  const { world, plans, names } = inner;
  const clock = (slot: number | null) => (slot === null ? '—' : `${String(Math.floor(slot / 2)).padStart(2, '0')}:${slot % 2 ? '30' : '00'}`);
  const run = (label: string, model: BusModel, change: Partial<LinePlan> = {}) => {
    const lines = plans.map((p) => ({ ...p, kmh: model.kmh, seats: model.seats, ...change }));
    const result = assign(world.city, world.commuters, lines);
    console.log(`\n${label}: line, riders a day, turned away a day, fullest half-hour, busiest leg at peak (riders a day as if all were peak)`);
    let riders = 0;
    let shed = 0;
    lines.forEach((p, k) => {
      const d = result.lines.get(p.id)!;
      riders += d.perDay;
      shed += d.shedPerDay;
      console.log(`  ${names[k]!.padEnd(22)} ${d.perDay.toFixed(1).padStart(7)} ${d.shedPerDay.toFixed(1).padStart(7)}  ${clock(d.fullSlot)}  ${d.busiestLeg[0]!.toFixed(0).padStart(6)}`);
    });
    console.log(`  ${'all ten'.padEnd(22)} ${riders.toFixed(1).padStart(7)} ${shed.toFixed(1).padStart(7)}  (${((shed / (riders + shed)) * 100).toFixed(1)}% turned away)`);
  };
  run('Sparrows, every 10 min at peak, 15 off-peak', BUS_MODELS.sparrow);
  run('Metro 40s, every 10 min at peak, 15 off-peak', BUS_MODELS.metro40);
  run('Sparrows, every 20 min by day', BUS_MODELS.sparrow, { headways: { peak: 1200, offpeak: 1200, overnight: null } });
}
