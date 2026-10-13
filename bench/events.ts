// City events (the M4 spec, item 2): on the fixture with the debug line running, SEEDS seeds
// (default 100) of DAYS days (default 100) each. Prints events a quarter and of each kind, how long
// each kind lasts and how much street roadworks take, what roadworks and snow add to the debug
// line's round trip and to the buses its headways need, and what a festival does to its riders.
// Then, on Inner Boston's ten corridors, the whole recompute (every line's timing and the demand
// model) with no event, roadworks, snow and a festival (I14: ≤150 ms p95).
// `npm run bench events [seeds] [days]`.
import { addDebugLine } from '../src/sim/commands/debugLine';
import { DAYS_PER_QUARTER, SECONDS_PER_DAY } from '../src/sim/config/time';
import { busesNeeded } from '../src/sim/rules/cycle';
import { advance } from '../src/sim/step';
import { gameWithDepot } from '../src/sim/testing';
import { toCalendarTime } from '../src/sim/core/calendar';
import { createRng } from '../src/sim/core/rng';
import { pickRoadworks } from '../src/sim/events/roll';
import { eventPhase } from '../src/sim/rules/event';
import { recompute, type World } from '../src/sim/world';
import { innerBoston } from './inner';

const SEEDS = Number(process.argv[3] ?? 100);
const DAYS = Number(process.argv[4] ?? 100);
let events = 0;
const kinds = new Map<string, number[]>();
const metres: number[] = [];
const added: Record<'works' | 'snow', { peak: number[]; offpeak: number[]; moreBuses: number }> = { works: { peak: [], offpeak: [], moreBuses: 0 }, snow: { peak: [], offpeak: [], moreBuses: 0 } };
const festivalRiders: number[] = [];
for (let seed = 1; seed <= SEEDS; seed++) {
  const world = gameWithDepot(seed);
  addDebugLine(world);
  const line = world.state.lines[0]!;
  const calm = world.services.get(line.id)!.timing.cycles!;
  const calmRiders = world.assignment.lines.get(line.id)!.perDay;
  for (let day = 1; day <= DAYS; day++) {
    for (const closed of advance(world, SECONDS_PER_DAY)) {
      if (!closed.rolled) continue;
      events++;
      const e = closed.rolled;
      kinds.set(e.kind, [...(kinds.get(e.kind) ?? []), e.endDay - e.startDay + 1]);
      if (e.kind === 'roadworks') metres.push(e.edges.reduce((s, k) => s + world.city.graph.edgeDm[k]! / 10, 0));
    }
    const plan = world.services.get(line.id)!;
    const e = world.state.event;
    const on = e && eventPhase(e, toCalendarTime(world.state.elapsed).day) === 'on' ? e.kind : null;
    const slowed = (plan.plan.worksM ?? 0) > 0 ? added.works : on === 'snow' ? added.snow : null;
    if (slowed) {
      const cycles = plan.timing.cycles!;
      slowed.peak.push(cycles.peak - calm.peak);
      slowed.offpeak.push(cycles.offpeak - calm.offpeak);
      if (busesNeeded(cycles, line.headways) > line.buses) slowed.moreBuses++;
    }
    if (on === 'festival') festivalRiders.push(Math.round((100 * world.assignment.lines.get(line.id)!.perDay) / calmRiders) / 100);
  }
}
const spread = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  return s.length ? `${s[0]}–${s.at(-1)}, median ${s[Math.floor(s.length / 2)]}` : 'none';
};
const f1 = (v: number) => v.toFixed(1);
console.log(`events over ${SEEDS} seeds × ${DAYS} days: ${events}, ${f1((events / (SEEDS * DAYS)) * DAYS_PER_QUARTER)} a ${DAYS_PER_QUARTER}-day quarter`);
for (const [kind, days] of kinds) console.log(`  ${kind}: ${days.length}, lasting ${spread(days)} days`);
console.log(`roadworks' street metres: ${spread(metres.map(Math.round))}`);
for (const [name, a] of [['roadworks', added.works], ['snow', added.snow]] as const) {
  console.log(`days the debug line drives in ${name}: ${a.peak.length}; seconds added to its round trip at peak ${spread(a.peak)}, off-peak ${spread(a.offpeak)}; its headways needed more buses than it has on ${a.moreBuses}`);
}
console.log(`festival days: ${festivalRiders.length}; the debug line's riders against a calm day ×${spread(festivalRiders)}`);

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
  world.state.event = { kind: 'roadworks', startDay: today, endDay: today + 3, street: stretch.street, edges: stretch.edges, at: null };
  recompute(world);
  const slowed = world.state.lines.filter((l) => (world.services.get(l.id)!.plan.worksM ?? 0) > 0).length;
  console.log(`Inner Boston's recompute, ten corridors: ${off} with no event; ${time(world)} with ${f1(streetM(stretch.edges))} m of ${stretch.street} dug up, under ${slowed} line(s)`);
  world.state.event = { kind: 'snow', startDay: today, endDay: today, street: '', edges: [], at: null };
  console.log(`  ${time(world)} in snow`);
  const stop = world.state.stops[0]!;
  world.state.event = { kind: 'festival', startDay: today, endDay: today, street: '', edges: [], at: { lon: stop.lon, lat: stop.lat } };
  console.log(`  ${time(world)} with a festival (its commuters worked out once, then kept)`);
}

function streetM(edges: readonly number[]): number {
  return edges.reduce((s, e) => s + inner!.world.city.graph.edgeDm[e]! / 10, 0);
}
