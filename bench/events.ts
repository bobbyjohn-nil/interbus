// City events (the M4 spec, item 2): on the fixture with the debug line running, SEEDS seeds
// (default 100) of DAYS days (default 100) each. Prints events a quarter, how long roadworks last
// and how much street they take, and what they add to the debug line's round trip in each period
// and to the buses its headways need. Then, on Inner Boston's ten corridors, the whole recompute
// (every line's timing and the demand model) with roadworks off and on (I14: ≤150 ms p95).
// `npm run bench events [seeds] [days]`.
import { addDebugLine } from '../src/sim/commands/debugLine';
import { DAYS_PER_QUARTER, SECONDS_PER_DAY } from '../src/sim/config/time';
import { busesNeeded } from '../src/sim/rules/cycle';
import { advance } from '../src/sim/step';
import { gameWithDepot } from '../src/sim/testing';
import { toCalendarTime } from '../src/sim/core/calendar';
import { createRng } from '../src/sim/core/rng';
import { pickRoadworks } from '../src/sim/events/roll';
import { recompute, type World } from '../src/sim/world';
import { innerBoston } from './inner';

const SEEDS = Number(process.argv[3] ?? 100);
const DAYS = Number(process.argv[4] ?? 100);
let events = 0;
const lengths: number[] = [];
const metres: number[] = [];
const added: { peak: number[]; offpeak: number[] } = { peak: [], offpeak: [] };
let moreBuses = 0;
for (let seed = 1; seed <= SEEDS; seed++) {
  const world = gameWithDepot(seed);
  addDebugLine(world);
  const line = world.state.lines[0]!;
  const calm = world.services.get(line.id)!.timing.cycles!;
  for (let day = 1; day <= DAYS; day++) {
    for (const closed of advance(world, SECONDS_PER_DAY)) {
      if (!closed.rolled) continue;
      events++;
      lengths.push(closed.rolled.endDay - closed.rolled.startDay + 1);
      metres.push(closed.rolled.edges.reduce((s, e) => s + world.city.graph.edgeDm[e]! / 10, 0));
    }
    const plan = world.services.get(line.id)!;
    if ((plan.plan.worksM ?? 0) > 0) {
      const cycles = plan.timing.cycles!;
      added.peak.push(cycles.peak - calm.peak);
      added.offpeak.push(cycles.offpeak - calm.offpeak);
      if (busesNeeded(cycles, line.headways) > line.buses) moreBuses++;
    }
  }
}
const spread = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  return s.length ? `${s[0]}–${s.at(-1)}, median ${s[Math.floor(s.length / 2)]}` : 'none';
};
const f1 = (v: number) => v.toFixed(1);
console.log(`events over ${SEEDS} seeds × ${DAYS} days: ${events}, ${f1((events / (SEEDS * DAYS)) * DAYS_PER_QUARTER)} a ${DAYS_PER_QUARTER}-day quarter`);
console.log(`roadworks days: ${spread(lengths)}; street metres: ${spread(metres.map(Math.round))}`);
console.log(`days the debug line drives through roadworks: ${added.peak.length}; seconds added to its round trip at peak ${spread(added.peak)}, off-peak ${spread(added.offpeak)}`);
console.log(`of those days, its headways needed more buses than it has on ${moreBuses}`);

const inner = innerBoston();
if (inner) {
  const world = inner.world;
  for (const line of world.state.lines) line.buses = 10;
  recompute(world);
  const time = (w: World) => {
    for (let k = 0; k < 3; k++) recompute(w);
    const ms: number[] = [];
    for (let k = 0; k < 20; k++) {
      const t0 = performance.now();
      recompute(w);
      ms.push(performance.now() - t0);
    }
    ms.sort((a, b) => a - b);
    return `p50 ${f1(ms[10]!)} ms, p95 ${f1(ms[18]!)} ms`;
  };
  const off = time(world);
  const stretch = pickRoadworks(world, createRng(1))!;
  const today = toCalendarTime(world.state.elapsed).day;
  world.state.event = { kind: 'roadworks', startDay: today, endDay: today + 3, street: stretch.street, edges: stretch.edges };
  recompute(world);
  const slowed = world.state.lines.filter((l) => (world.services.get(l.id)!.plan.worksM ?? 0) > 0).length;
  console.log(`Inner Boston's recompute, ten corridors: ${off} without roadworks; ${time(world)} with ${f1(streetM(stretch.edges))} m of ${stretch.street} dug up, under ${slowed} line(s)`);
}

function streetM(edges: readonly number[]): number {
  return edges.reduce((s, e) => s + inner!.world.city.graph.edgeDm[e]! / 10, 0);
}
