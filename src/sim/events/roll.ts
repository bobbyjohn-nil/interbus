// City events (the M4 spec, item 2; PLAN §3): at a day's start, with none pending, on or in the gap
// after one, the events' own stream rolls one for the next day, so a company sees it coming. V2
// rolled at the same moment from a stream salted by the day (`Intralines_City_dep@archive/
// intralines-city-v1:Gaming/src/30-sim.js:4576-4655`); here the stream is saved with the game and
// is the events' alone, so rolling one never shifts the contract deck (I8).
//
// Each roll picks its kind evenly (V2), then its days. A festival gathers riders round a stop picked
// by its paid boardings, so busier stops draw more festivals (V2, `:4617-4660`); snow covers the city.
// Roadworks take up to 400 m of one named street a running line drives (V2 took one edge of its
// coarser grid, `:4687-4720`): the stretch starts on a driven edge and grows along the same street
// from either end, the line's own edges first, while it stays within ROADWORKS_MAX_M. Every line
// over it drives it at ROADWORKS_SPEED, in every period (rules/cycle.ts slowedM).
import { EVENT_CHANCE_PER_DAY, EVENT_DAYS, EVENT_GAP_DAYS, EVENT_KINDS, EVENT_WARN_DAYS, FESTIVAL_RADIUS_M, ROADWORKS_MAX_M } from '../config/events';
import { distXY, toXY, type XY } from '../core/geo';
import type { Rng } from '../core/rng';
import type { CityEvent, Stop } from '../state';
import { lineEdges, type World } from '../world';

/** At the start of `day`: rolls the next event, to start tomorrow, and returns it; null on a day none is rolled. */
export function rollEvent(world: World, day: number): CityEvent | null {
  const state = world.state;
  if (state.event && day <= state.event.endDay + EVENT_GAP_DAYS) return null;
  const rng = state.eventRng;
  if (!(rng.next() < EVENT_CHANCE_PER_DAY)) return null;
  const kind = rng.pick(EVENT_KINDS);
  const [fewest, most] = EVENT_DAYS[kind];
  const days = rng.int(fewest, most);
  const startDay = day + EVENT_WARN_DAYS;
  const span = { startDay, endDay: startDay + days - 1 };
  if (kind === 'roadworks') {
    const stretch = pickRoadworks(world, rng);
    // No running line on a named street: nothing to dig up today (V2 skipped the day too).
    if (!stretch) return null;
    state.event = { kind, ...span, street: stretch.street, edges: stretch.edges, at: null };
  } else if (kind === 'festival') {
    const stop = pickFestivalStop(world, rng);
    // No stop with riders: nobody to gather.
    if (!stop) return null;
    state.event = { kind, ...span, street: placeName(world, toXY(world.city.frame, [stop.lon, stop.lat])), edges: [], at: { lon: stop.lon, lat: stop.lat } };
  } else {
    // Snow falls on a company that runs something, or on nobody it matters to.
    if (!world.state.lines.some((l) => l.buses > 0 && world.services.has(l.id))) return null;
    state.event = { kind, ...span, street: '', edges: [], at: null };
  }
  return state.event;
}

/** A festival's stop: one riders board at, weighted by its paid boardings (V2 weighted its pick to busier stops), or null if none has riders. */
export function pickFestivalStop(world: World, rng: Rng): Stop | null {
  const paid = new Map<number, number>();
  for (const line of world.state.lines) {
    const demand = world.assignment.lines.get(line.id);
    if (!demand) continue;
    line.stopIds.forEach((id, q) => paid.set(id, (paid.get(id) ?? 0) + Math.max(0, (demand.boardingsByStop[q] ?? 0) - (demand.transfersByStop[q] ?? 0))));
  }
  const stops = world.state.stops.filter((s) => (paid.get(s.id) ?? 0) > 0).sort((a, b) => a.id - b.id);
  const total = stops.reduce((sum, s) => sum + paid.get(s.id)!, 0);
  if (total <= 0) return null;
  let left = rng.next() * total;
  for (const s of stops) {
    left -= paid.get(s.id)!;
    if (left < 0) return s;
  }
  return stops[stops.length - 1]!;
}

/** What a place is called: the nearest landmark within a festival's reach, else the nearest named street, else ''. */
function placeName(world: World, at: XY): string {
  let best: { name: string; d: number } | null = null;
  for (const l of world.city.landmarks) {
    const d = distXY(l.at, at);
    if (d <= FESTIVAL_RADIUS_M && (!best || d < best.d)) best = { name: l.name, d };
  }
  if (best) return best.name;
  const { graph, streets } = world.city;
  let street: { name: string; d: number } | null = null;
  for (let e = 0; e < streets.length; e++) {
    if (streets[e]!.name === '') continue;
    const a = graph.edgeA[e]!;
    const d = distXY([graph.x[a]!, graph.y[a]!], at);
    if (!street || d < street.d) street = { name: streets[e]!.name, d };
  }
  return street?.name ?? '';
}

/** A stretch of one named street a running line drives, at most ROADWORKS_MAX_M, or null if no running line drives one. */
export function pickRoadworks(world: World, rng: Rng): { street: string; edges: number[] } | null {
  const { graph, streets } = world.city;
  const maxDm = ROADWORKS_MAX_M * 10;
  const driven = new Set<number>();
  for (const line of world.state.lines) if (line.buses > 0 && world.services.has(line.id)) for (const e of lineEdges(world, line)) driven.add(e);
  const named = [...driven].filter((e) => streets[e]!.name !== '' && graph.edgeDm[e]! <= maxDm).sort((a, b) => a - b);
  if (named.length === 0) return null;
  const first = rng.pick(named);
  const street = streets[first]!.name;
  const edges = [first];
  let dm = graph.edgeDm[first]!;
  const ends = [graph.edgeA[first]!, graph.edgeB[first]!];
  for (;;) {
    let best: { edge: number; side: number; node: number } | null = null;
    for (let side = 0; side < 2; side++) {
      const node = ends[side]!;
      for (let k = graph.start[node]!; k < graph.start[node + 1]!; k++) {
        const edge = graph.slotEdge[k]!;
        if (edges.includes(edge) || streets[edge]!.name !== street || dm + graph.edgeDm[edge]! > maxDm) continue;
        // A driven edge before one no line drives, then the lower index.
        const before = !best || (driven.has(edge) ? !driven.has(best.edge) || edge < best.edge : !driven.has(best.edge) && edge < best.edge);
        if (before) best = { edge, side, node: graph.slotNode[k]! };
      }
    }
    if (!best) break;
    edges.push(best.edge);
    dm += graph.edgeDm[best.edge]!;
    ends[best.side] = best.node;
  }
  return { street, edges: edges.sort((a, b) => a - b) };
}
