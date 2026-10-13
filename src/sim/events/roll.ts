// City events (the M4 spec, item 2; PLAN §3): at a day's start, with none pending, on or in the gap
// after one, the events' own stream rolls one for the next day, so a company sees it coming. V2
// rolled at the same moment from a stream salted by the day (`Intralines_City_dep@archive/
// intralines-city-v1:Gaming/src/30-sim.js:4576-4655`); here the stream is saved with the game and
// is the events' alone, so rolling one never shifts the contract deck (I8).
//
// Roadworks take up to 400 m of one named street a running line drives (V2 took one edge of its
// coarser grid, `:4687-4720`): the stretch starts on a driven edge and grows along the same street
// from either end, the line's own edges first, while it stays within ROADWORKS_MAX_M. Every line
// over it drives it at ROADWORKS_SPEED, in every period (rules/cycle.ts slowedM).
import { EVENT_CHANCE_PER_DAY, EVENT_GAP_DAYS, EVENT_WARN_DAYS, ROADWORKS_DAYS, ROADWORKS_MAX_M } from '../config/events';
import type { Rng } from '../core/rng';
import type { CityEvent } from '../state';
import { lineEdges, type World } from '../world';

/** At the start of `day`: rolls the next event, to start tomorrow, and returns it; null on a day none is rolled. */
export function rollEvent(world: World, day: number): CityEvent | null {
  const state = world.state;
  if (state.event && day <= state.event.endDay + EVENT_GAP_DAYS) return null;
  const rng = state.eventRng;
  if (!(rng.next() < EVENT_CHANCE_PER_DAY)) return null;
  const days = rng.int(ROADWORKS_DAYS[0], ROADWORKS_DAYS[1]);
  const stretch = pickRoadworks(world, rng);
  // No running line on a named street: nothing to dig up today (V2 skipped the day too).
  if (!stretch) return null;
  const startDay = day + EVENT_WARN_DAYS;
  state.event = { kind: 'roadworks', startDay, endDay: startDay + days - 1, street: stretch.street, edges: stretch.edges };
  return state.event;
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
