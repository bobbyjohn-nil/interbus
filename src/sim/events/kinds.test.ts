// Snow and the festival (the M4 spec, item 2). Snow slows every bus drive to 0.72 of its speed on top
// of the hour's traffic, so round trips stretch and a line short of buses runs less often; riders'
// own rides keep the street's speed, as under roadworks. A festival draws ×2.6 riders to and from
// the cells within 900 m of a stop picked by its paid boardings. Each only while it is on.
import { describe, expect, it } from 'vitest';
import { addDebugLine } from '../commands/debugLine';
import { FESTIVAL_DEMAND } from '../config/events';
import { SECONDS_PER_DAY } from '../config/time';
import { toCalendarTime } from '../core/calendar';
import { createRng } from '../core/rng';
import { toXY } from '../core/geo';
import { checkLineDraft } from '../rules/line';
import { advance } from '../step';
import { COPLEY, gameWithDepot } from '../testing';
import { commutersToday, lineDraftContext, recompute, type World } from '../world';
import { pickFestivalStop } from './roll';

function running(): World {
  const world = gameWithDepot();
  if (!addDebugLine(world).ok) throw new Error('no debug line');
  return world;
}
const today = (world: World) => toCalendarTime(world.state.elapsed).day;

describe('snow', () => {
  it('slows every drive by 0.72 from its first day to its last, and the line tool prices a line on the same round trip (GD-05)', () => {
    const world = running();
    const line = world.state.lines[0]!;
    const calm = world.services.get(line.id)!;
    const day = today(world);
    world.state.event = { kind: 'snow', startDay: day + 1, endDay: day + 1, street: '', edges: [], at: null };
    recompute(world);
    expect(world.services.get(line.id)!.timing.cycles).toEqual(calm.timing.cycles); // pending: nothing yet
    const [starts] = advance(world, SECONDS_PER_DAY);
    expect(starts!.retimed).toBe(true);
    const snowy = world.services.get(line.id)!;
    // The spec's magnitude: the debug line's peak round trip from about 1,641 s to about 2,060 s
    // (dwells and layovers keep their time; only the driving slows).
    expect(calm.timing.cycles!.peak).toBeGreaterThan(1_550);
    expect(calm.timing.cycles!.peak).toBeLessThan(1_750);
    expect(snowy.timing.cycles!.peak / calm.timing.cycles!.peak).toBeGreaterThan(1.2);
    expect(snowy.timing.cycles!.peak / calm.timing.cycles!.peak).toBeLessThan(1 / 0.72);
    // Riders ride at the street's speed: the plan they see keeps its streets and its bus's speed.
    expect(snowy.plan.kmh).toBe(calm.plan.kmh);
    expect(snowy.plan.stopDistM).toEqual(calm.plan.stopDistM);
    const stops = line.stopIds.map((id) => world.state.stops.find((s) => s.id === id)!).map((s) => toXY(world.city.frame, [s.lon, s.lat]));
    expect(checkLineDraft(lineDraftContext(world), stops, line.headways).draft.cycles).toEqual(snowy.timing.cycles);
    const [ends] = advance(world, SECONDS_PER_DAY);
    expect(ends!.ended?.kind).toBe('snow');
    expect(world.services.get(line.id)!.timing.cycles).toEqual(calm.timing.cycles);
  });
});

describe('a festival', () => {
  it('draws ×2.6 riders to and from cells near its stop while it is on: every boarding at its stop, and fewer of the line’s', () => {
    const world = running();
    const line = world.state.lines[0]!;
    const copley = line.stopIds[0]!;
    const boardings = () => world.assignment.lines.get(line.id)!.boardingsByStop[0]!;
    const riders = () => world.assignment.lines.get(line.id)!.perDay;
    const before = boardings();
    const lineBefore = riders();
    const day = today(world);
    const at = world.state.stops.find((s) => s.id === copley)!;
    world.state.event = { kind: 'festival', startDay: day, endDay: day, street: 'Copley Square', edges: [], at: { lon: at.lon, lat: at.lat } };
    recompute(world);
    // Every trip boarding at the festival's own stop starts or ends within 900 m of it (a 650 m walk
    // from a 350 m cell), so its boardings rise the full ×2.6 short of crowding; the line's, less.
    expect(boardings() / before).toBeCloseTo(FESTIVAL_DEMAND, 6);
    expect(riders() / lineBefore).toBeGreaterThan(1.2);
    expect(riders() / lineBefore).toBeLessThan(FESTIVAL_DEMAND);
    // Flows near it are FESTIVAL_DEMAND times the city's; none far from it moves.
    const boosted = commutersToday(world);
    let up = 0;
    let same = 0;
    for (let k = 0; k < boosted.flow.length; k++) {
      const base = world.commuters.flow[k]!;
      if (base === 0) continue;
      const ratio = boosted.flow[k]! / base;
      if (Math.abs(ratio - FESTIVAL_DEMAND) < 1e-9) up++;
      else if (ratio === 1) same++;
    }
    expect(up).toBeGreaterThan(0);
    expect(up + same).toBe(world.commuters.flow.filter((f) => f > 0).length);
    // Over: the city's commuters again.
    world.state.event = { ...world.state.event, startDay: day - 1, endDay: day - 1 };
    recompute(world);
    expect(boardings()).toBe(before);
  });

  it('gathers round busier stops more often', () => {
    const world = running();
    const counts = new Map<number, number>();
    const rng = createRng(5);
    for (let k = 0; k < 2_000; k++) {
      const stop = pickFestivalStop(world, rng)!;
      counts.set(stop.id, (counts.get(stop.id) ?? 0) + 1);
    }
    const line = world.state.lines[0]!;
    const demand = world.assignment.lines.get(line.id)!;
    const busiest = line.stopIds[demand.boardingsByStop.indexOf(Math.max(...demand.boardingsByStop))]!;
    const quietest = line.stopIds[demand.boardingsByStop.indexOf(Math.min(...demand.boardingsByStop))]!;
    expect(counts.get(busiest)!).toBeGreaterThan(counts.get(quietest) ?? 0);
    expect(toXY(world.city.frame, COPLEY)).toBeDefined();
  });
});
