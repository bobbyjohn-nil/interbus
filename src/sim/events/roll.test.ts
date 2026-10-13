// City events (the M4 spec, item 2): roadworks rolled a day ahead from the events' own stream, one at
// a time with a gap after each, on up to 400 m of one named street a running line drives, slowing
// every line over it in every period only while they are on (I8: the contract deck never moves).
import { describe, expect, it } from 'vitest';
import { addDebugLine } from '../commands/debugLine';
import { EVENT_GAP_DAYS, ROADWORKS_DAYS, ROADWORKS_MAX_M } from '../config/events';
import { SECONDS_PER_DAY } from '../config/time';
import { toXY } from '../core/geo';
import { checkLineDraft } from '../rules/line';
import type { CityEvent } from '../state';
import { advance, type SimEvent } from '../step';
import { gameWithDepot } from '../testing';
import { lineDraftContext, lineEdges, recompute, type World } from '../world';

function running(seed = 7): World {
  const world = gameWithDepot(seed);
  if (!addDebugLine(world).ok) throw new Error('no debug line');
  return world;
}

/** The day closes of `days` days. */
function run(world: World, days: number): SimEvent[] {
  const out: SimEvent[] = [];
  for (let d = 0; d < days; d++) out.push(...advance(world, SECONDS_PER_DAY));
  return out;
}

const rolledIn = (closes: readonly SimEvent[]) => closes.filter((c) => c.rolled).map((c) => ({ closed: c.day, event: c.rolled! }));
const metres = (world: World, edges: readonly number[]) => edges.reduce((s, e) => s + world.city.graph.edgeDm[e]! / 10, 0);

describe('city events', () => {
  it('rolls nothing while no line runs: roadworks need a street a bus drives', () => {
    const world = gameWithDepot();
    expect(rolledIn(run(world, 40))).toEqual([]);
    expect(world.state.event).toBeNull();
  });

  it('rolls one at a time, the day before it starts, for 3–6 days, and none in the two days after one ends', () => {
    const rolled = rolledIn(run(running(), 200));
    expect(rolled.length).toBeGreaterThan(5);
    for (const { closed, event } of rolled) {
      // Rolled at the start of the day after the close, to start the day after that.
      expect(event.startDay).toBe(closed + 2);
      expect(event.endDay - event.startDay + 1).toBeGreaterThanOrEqual(ROADWORKS_DAYS[0]);
      expect(event.endDay - event.startDay + 1).toBeLessThanOrEqual(ROADWORKS_DAYS[1]);
    }
    for (let k = 1; k < rolled.length; k++) expect(rolled[k]!.closed + 1).toBeGreaterThan(rolled[k - 1]!.event.endDay + EVENT_GAP_DAYS);
  });

  it('takes up to 400 m of one named street, in one piece, that a running line drives', () => {
    const world = running();
    const driven = new Set(lineEdges(world, world.state.lines[0]!));
    const { graph, streets } = world.city;
    const rolled = rolledIn(run(world, 200));
    for (const { event } of rolled) {
      expect(event.street).not.toBe('');
      expect(event.edges.every((e) => streets[e]!.name === event.street)).toBe(true);
      expect(metres(world, event.edges)).toBeLessThanOrEqual(ROADWORKS_MAX_M);
      expect(event.edges.some((e) => driven.has(e))).toBe(true);
      // One piece: every edge reaches the first through shared ends.
      const reached = new Set([event.edges[0]!]);
      for (let grew = true; grew; ) {
        grew = false;
        for (const e of event.edges) {
          if (reached.has(e)) continue;
          const ends = [graph.edgeA[e], graph.edgeB[e]];
          if ([...reached].some((r) => ends.includes(graph.edgeA[r]) || ends.includes(graph.edgeB[r]))) {
            reached.add(e);
            grew = true;
          }
        }
      }
      expect(reached.size).toBe(event.edges.length);
    }
  });

  it('slows every line over it in every period only while on, and the line tool prices a line there on the same slower round trip (GD-05)', () => {
    const world = running();
    const line = world.state.lines[0]!;
    const calm = world.services.get(line.id)!.timing.cycles!;
    let event: CityEvent | null = null;
    for (let day = 0; day < 60 && !event; day++) for (const c of advance(world, SECONDS_PER_DAY)) event = c.rolled ?? event;
    if (!event) throw new Error('no event in 60 days');
    // Pending: tomorrow's works change nothing yet, even when a command times the network again.
    recompute(world);
    expect(world.services.get(line.id)!.timing.cycles).toEqual(calm);
    const [starts] = advance(world, SECONDS_PER_DAY);
    expect(starts!.retimed).toBe(true);
    const on = world.services.get(line.id)!;
    const works = new Set(event.edges);
    expect(on.plan.worksM).toBeCloseTo(metres(world, lineEdges(world, line).filter((e) => works.has(e))), 6);
    for (const period of ['peak', 'offpeak', 'overnight'] as const) expect(on.timing.cycles![period]).toBeGreaterThan(calm[period]);
    // A line drawn on the same stops today is priced on the same round trip the running one takes.
    const stops = line.stopIds.map((id) => world.state.stops.find((s) => s.id === id)!).map((s) => toXY(world.city.frame, [s.lon, s.lat]));
    expect(checkLineDraft(lineDraftContext(world), stops, line.headways).draft.cycles).toEqual(on.timing.cycles);
    // Over after its last day's close.
    const closes = run(world, event.endDay - event.startDay + 1);
    expect(closes.at(-1)!.ended).toEqual(event);
    expect(closes.at(-1)!.retimed).toBe(true);
    expect(world.services.get(line.id)!.timing.cycles).toEqual(calm);
  });

  it('leaves the contract deck as it was: the events draw from their own stream (I8)', () => {
    const withEvents = running(3);
    const without = running(3);
    // Pending for good, so this one never rolls another.
    without.state.event = { kind: 'roadworks', startDay: 1_000_000, endDay: 1_000_000, street: '', edges: [] };
    const offers = (w: World) => w.state.contracts.map((c) => `${c.offeredDay} ${c.landmark} ${c.kind} ${c.ask}`);
    let rolled = 0;
    for (let day = 1; day <= 60; day++) {
      rolled += advance(withEvents, SECONDS_PER_DAY).filter((c) => c.rolled).length;
      advance(without, SECONDS_PER_DAY);
      expect(offers(withEvents)).toEqual(offers(without));
      expect(withEvents.state.rng.state).toBe(without.state.rng.state);
    }
    expect(rolled).toBeGreaterThan(2);
  });

  it('gives the same events for the same seed and commands (I8)', () => {
    const events = (seed: number) => rolledIn(run(running(seed), 100));
    expect(events(11)).toEqual(events(11));
    expect(events(11)).not.toEqual(events(12));
  });
});
