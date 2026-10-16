// A line settling after a change made with its buses out (the M4 spec, item 4; I6, I1, I8): the rows
// it banks are the forecast made at the change, to the cent, each leg and drive at the version it ran
// on; a save mid-way loads to the same plan; and once it has settled it lets go of the earlier
// version, its own day plan holding alone. A line drawn mid-day starts the same way, from its depot.
import { describe, expect, it } from 'vitest';
import { createLine } from './commands/createLine';
import { addDebugLine, DEBUG_STOPS } from './commands/debugLine';
import { extendLine } from './commands/extendLine';
import { removeStop } from './commands/removeStop';
import { setHeadways } from './commands/setHeadways';
import { setModel } from './commands/setModel';
import { setRoute } from './commands/setRoute';
import { WAGE_CENTS_PER_HOUR } from './config/fleet';
import { SECONDS_PER_DAY, SECONDS_PER_HOUR } from './config/time';
import { toCalendarTime } from './core/calendar';
import { toLngLat, type LngLat } from './core/geo';
import type { LineId, StopId } from './core/ids';
import { createRng, type Rng } from './core/rng';
import { forecastDay, lineCostsInHour } from './economy/costs';
import { finance } from './economy/finance';
import { post, type RowKind } from './economy/ledger';
import { hourOfPlan } from './rules/schedule';
import { busesOutAt, hourOfMerged, planInEffect } from './rules/transition';
import { fromSaveData, toSaveData } from './save/save';
import { advance } from './step';
import { gameWithDepot } from './testing';
import { createWorld, frameSecond, settlingOf, type World } from './world';

const total = (world: World, day: number, kind: RowKind) => world.state.ledger.rows.filter((r) => r.day === day && r.kind === kind).reduce((s, r) => s + r.amountCents, 0);

/** The debug line, then on day 2 at `clock` (08:00 by default), with its buses out, Symphony taken off it or the line extended beyond Longwood. */
function changed(how: 'remove' | 'extend' = 'remove', clock = 8 * SECONDS_PER_HOUR): { world: World; line: LineId } {
  const world = gameWithDepot();
  if (!addDebugLine(world).ok) throw new Error('no line');
  const line = world.state.lines[0]!;
  advance(world, SECONDS_PER_DAY + clock - 5 * SECONDS_PER_HOUR); // founding was 05:00 on day 1
  const done = how === 'remove' ? removeStop(world, line.id, line.stopIds[1] as StopId) : extendLine(world, line.id, 'end', [[-71.1085, 42.3395]]);
  if (!done.ok) throw new Error(`not changed: ${done.reason}`);
  return { world, line: line.id };
}

describe('a line settling after a change (the M4 spec, item 4)', () => {
  it('keeps the version its trips under way began on, until it settles', () => {
    const { world, line } = changed();
    const s = world.services.get(line)!;
    expect(world.state.lines[0]!.earlier).toHaveLength(1);
    expect(s.settling?.frameDay).toBe(2);
    expect(s.effect.merged!.handover).toBeGreaterThan(8 * SECONDS_PER_HOUR);
  });

  it('banks from the change what it forecast at the change, to the cent, each leg at the length of the version it ran on (I1, I6)', () => {
    // At 07:45 the 07:40 trip is on its way out; its run back, after the change, is on the shorter route.
    const { world, line } = changed('extend', 7 * SECONDS_PER_HOUR + 45 * 60);
    const costs = world.services.get(line)!.costs;
    // Hour 7 banks at 08:00, its part before the change included.
    const forecast = forecastDay(costs, 7, 2);
    const kinds = ['running', 'wages', 'deadhead'] as const;
    const before = kinds.map((k) => total(world, 2, k));
    advance(world, 16 * SECONDS_PER_HOUR + 15 * 60);
    kinds.forEach((k, i) => expect(total(world, 2, k) - before[i]!, k).toBe(-forecast[k]));
    // Billed as the new version throughout, those hours would cost more.
    expect(forecast.running).toBeLessThan(forecastDay(costs, 7).running);
  });

  it('loads a save made while it settles to the same plan (I8)', () => {
    const { world, line } = changed();
    advance(world, 600);
    const loaded = createWorld(world.city, fromSaveData(toSaveData(world.state)));
    expect(JSON.stringify(loaded.services.get(line)!.effect)).toBe(JSON.stringify(world.services.get(line)!.effect));
  });

  it('lets go of the earlier version at the close after it has settled, its day plan holding alone', () => {
    const { world, line } = changed();
    const closes = advance(world, 16 * SECONDS_PER_HOUR);
    expect(closes.at(-1)!.retimed).toBe(true);
    expect(world.state.lines[0]!.earlier).toEqual([]);
    expect(world.services.get(line)!.effect.merged).toBeNull();
  });
});

// Shown failing (TS-04) on 5f4bce3: the line drawn at 10:20 had 3 buses out at that instant, placed
// on its streets by its day plan, with no drive out billed.
describe('a line whose service starts with none of its buses out (I6, I1)', () => {
  it('starts a line drawn at 10:20 from its depot: each bus pulls out in time for its first departure, billed for the drive, and nothing billed before the line was drawn', () => {
    const world = gameWithDepot();
    advance(world, 5 * SECONDS_PER_HOUR + 20 * 60); // 10:20 on day 1
    const at = 10 * SECONDS_PER_HOUR + 20 * 60;
    const made = createLine(world, DEBUG_STOPS.map((s) => s.at), { peak: 600, offpeak: 600, overnight: null });
    if (!made.ok) throw new Error(made.reason);
    const service = world.services.get(made.lineId)!;
    const { effect } = service;
    const plan = effect.merged ?? effect.periodic;
    const { pullOutS } = service.day.inputs;
    // No bus out as it is drawn, no departure before one could reach it from the depot, and one pulling out for each.
    expect(busesOutAt(effect, at)).toBe(0);
    expect(plan.trips.filter((t) => t >= at && t < at + pullOutS)).toEqual([]);
    const outs = plan.stints.filter((s) => s.leaveDepot >= at && s.leaveDepot < 11 * SECONDS_PER_HOUR).length;
    expect(outs).toBe(world.state.lines[0]!.buses);
    // Hour 10 banks at 11:00 what was forecast when the line was drawn: a drive out for each bus, as the
    // morning's first is billed, and drivers paid only from their drives out.
    const forecast = (h: number) => forecastDay(service.costs, h, 1);
    const kinds = ['running', 'wages', 'deadhead'] as const;
    const before = kinds.map((k) => total(world, 1, k));
    advance(world, 40 * 60);
    const hour = kinds.map((k, i) => total(world, 1, k) - before[i]!);
    expect(hour).toEqual(kinds.map((k) => forecast(11)[k] - forecast(10)[k]));
    // One drive out, as the day plan bills the morning's first (without a day, its hour on the day plan).
    const driveOut = lineCostsInHour(service.costs, 4).deadhead / hourOfPlan(service.day, 4 * SECONDS_PER_HOUR, 5 * SECONDS_PER_HOUR).pullOuts;
    expect(hour[2]).toBe(-outs * driveOut);
    expect(-hour[1]!).toBeLessThanOrEqual(Math.ceil((outs * (11 * SECONDS_PER_HOUR - at) * WAGE_CENTS_PER_HOUR) / SECONDS_PER_HOUR));
  });

  // Changed again within the hour it was drawn, once it has handed over to its own day plan, it keeps
  // the version before the draw, which ran no bus (world.ts), so that hour still bills only from the
  // drives out. Shown failing (TS-04) with recomputeInService letting go of a drawn line's earlier
  // versions once it has handed over, as of any settled line, and with merge() starting again from the
  // day plan past a handover: hour 15 billed the 15:00 departure no bus ran, three drivers from 15:00
  // ($78.00 of wages, where from their drives out it is $52.00) and no drive out ($0, where three cost
  // $10.32).
  it('bills the hour a line was drawn from its drives out after a second change in that hour', () => {
    const world = gameWithDepot();
    advance(world, 10 * SECONDS_PER_HOUR + 60); // 15:01 on day 1
    const at = 15 * SECONDS_PER_HOUR + 60;
    const made = createLine(world, DEBUG_STOPS.map((s) => s.at), { peak: 600, offpeak: 600, overnight: null });
    if (!made.ok) throw new Error(made.reason);
    const drawn = world.services.get(made.lineId)!;
    const { handover } = drawn.effect.merged!;
    expect(handover).toBeLessThan(15.75 * SECONDS_PER_HOUR);
    advance(world, handover + 60 - at);
    if (!setHeadways(world, made.lineId, { peak: 900, offpeak: 900, overnight: null }).ok) throw new Error('no change');
    const plan = world.services.get(made.lineId)!.effect.merged!;
    const { pullOutS } = drawn.day.inputs;
    // Still no departure before a bus could reach it from the depot, and one pulling out for each bus.
    expect(plan.trips.filter((t) => t >= 15 * SECONDS_PER_HOUR && t < at + pullOutS)).toEqual([]);
    const outs = plan.stints.filter((s) => s.leaveDepot >= at && s.leaveDepot < 16 * SECONDS_PER_HOUR).length;
    expect(outs).toBe(world.state.lines[0]!.buses);
    const kinds = ['running', 'wages', 'deadhead'] as const;
    const before = kinds.map((k) => total(world, 1, k));
    advance(world, 16 * SECONDS_PER_HOUR - (handover + 60));
    const hour = kinds.map((k, i) => total(world, 1, k) - before[i]!);
    const driveOut = lineCostsInHour(drawn.costs, 4).deadhead / hourOfPlan(drawn.day, 4 * SECONDS_PER_HOUR, 5 * SECONDS_PER_HOUR).pullOuts;
    expect(hour[2]).toBe(-outs * driveOut);
    expect(-hour[1]!).toBeLessThanOrEqual(Math.ceil((outs * (16 * SECONDS_PER_HOUR - at) * WAGE_CENTS_PER_HOUR) / SECONDS_PER_HOUR));
  });
});

const COSTS = ['running', 'wages', 'deadhead'] as const;
const H = SECONDS_PER_HOUR;

/** Finance's Day forecast of the costs of a game's one line, which its row under Lines shows too. */
function dayForecast(world: World): Record<(typeof COSTS)[number], number> {
  const f = finance(world);
  const day = { running: 0, wages: 0, deadhead: 0 };
  for (const k of COSTS) day[k] = -f.rows.find((r) => r.kind === k)!.forecastCents!;
  expect(f.lines[0]!.forecastCents).toEqual(day);
  return day;
}

/** The costs `day` has banked so far (0, not -0, before any). */
const banked = (world: World, day: number) => ({ running: 0 - total(world, day, 'running'), wages: 0 - total(world, day, 'wages'), deadhead: 0 - total(world, day, 'deadhead') });

/** The forecast's hours before the one under way, which the day has banked already. */
function forecastSoFar(world: World, line: LineId) {
  const t = toCalendarTime(world.state.elapsed);
  const costs = world.services.get(line)!.costs;
  const [day, rest] = [forecastDay(costs, 0, t.day), forecastDay(costs, t.hour, t.day)];
  return { running: day.running - rest.running, wages: day.wages - rest.wages, deadhead: day.deadhead - rest.deadhead };
}

/** A game with a depot and cash to spare, the debug line's stops drawn as a line every 20 minutes at 05:00 on day 1. */
function drawnAtFive(): { world: World; line: LineId } {
  const world = gameWithDepot();
  post(world.state.ledger, { day: 1, kind: 'contract', amountCents: 500_000_000 });
  const made = createLine(world, DEBUG_STOPS.map((s) => s.at), { peak: 1_200, offpeak: 1_200, overnight: null });
  if (!made.ok) throw new Error(made.reason);
  return { world, line: made.lineId };
}

// A change on any day but the line's first, made after an earlier change that day has handed over: the
// line keeps every version that ran that day until its close (world.ts recomputeInService), so its plan
// still holds what ran before the earlier change, and the day's forecast is what the day banks (the
// systems audit's fourth round). Shown failing (TS-04) on 43554a9, which let a line's versions go at a
// change once they had handed over on any day but the draw day: 08:00–08:40 then held 8 legs of the
// 10-minute day plan, 7,200 s of driving and no drive out, where 7 legs, 6,000 s and one drive out ran, so
// hour 8 banked $32.01, $78.00 and $0; and the day's forecast read $485.97 running, $1,456.63 wages and
// $20.64 to and from the depot, where day 2 banked $433.59, $1,379.14 and $13.76.
describe('a second change in a day, after the first has handed over (I1, I6)', () => {
  const AT = 8 * H + 40 * 60; // 08:40 on day 2

  /** The line every 10 minutes from 08:00 on day 2, and with `second` every 15 from 08:40, once that has handed over. */
  function changed(second: boolean) {
    const { world, line } = drawnAtFive();
    advance(world, SECONDS_PER_DAY + 3 * H); // 08:00 on day 2
    if (!setHeadways(world, line, { peak: 600, offpeak: 600, overnight: null }).ok) throw new Error('no change');
    expect(world.services.get(line)!.effect.merged!.handover).toBeLessThan(AT);
    advance(world, 40 * 60);
    const before = world.services.get(line)!;
    if (second && !setHeadways(world, line, { peak: 900, offpeak: 900, overnight: null }).ok) throw new Error('no change');
    return { world, line, before, after: world.services.get(line)! };
  }

  it('forecasts with one change what the day banks', () => {
    const { world } = changed(false);
    const day = dayForecast(world);
    advance(world, 24 * H - AT);
    expect(banked(world, 2)).toEqual(day);
  });

  it('keeps what ran before a second change as it ran, hour 8 included, and forecasts what the day banks', () => {
    const { world, line, before, after } = changed(true);
    // Each hour from the change back to midnight holds the legs, driving and drives to and from the depot
    // it did, each at the version it ran on and none at the new one.
    const pad = (n: readonly number[]) => [...n, 0];
    for (let h = 8; h >= 0; h--) {
      const [from, to] = [h * H, Math.min((h + 1) * H, AT)];
      const ran = hourOfMerged(before.effect.merged!, from, to);
      expect(hourOfMerged(after.effect.merged!, from, to), `${h}:00`).toEqual({ legs: pad(ran.legs), serviceS: ran.serviceS, pullOuts: pad(ran.pullOuts), pullIns: pad(ran.pullIns) });
    }
    // So the hours banked already are forecast as they banked, and the day's forecast is what it banks.
    expect(forecastSoFar(world, line)).toEqual(banked(world, 2));
    const day = dayForecast(world);
    advance(world, 24 * H - AT);
    expect(banked(world, 2)).toEqual(day);
  });
});

// A change late in the evening hands over the next morning, so the line keeps its versions past
// midnight; a change that next day after the handover still finds what ran before it. The first passes
// on 43554a9 too.
describe('a change late in the evening, then one the next day (I1, I6)', () => {
  it('forecasts each day what it banks', () => {
    const { world, line } = drawnAtFive();
    advance(world, 19 * H + 23 * H + 40 * 60); // 23:40 on day 2
    if (!setHeadways(world, line, { peak: 600, offpeak: 600, overnight: null }).ok) throw new Error('no change');
    expect(world.services.get(line)!.effect.merged!.handover).toBeGreaterThan(SECONDS_PER_DAY);
    const two = dayForecast(world);
    advance(world, 20 * 60); // day 2's close, the line still settling
    expect(banked(world, 2)).toEqual(two);
    expect(world.state.lines[0]!.earlier).toHaveLength(1);
    advance(world, 8 * H); // 08:00 on day 3, after the handover
    if (!setHeadways(world, line, { peak: 900, offpeak: 900, overnight: null }).ok) throw new Error('no change');
    expect(forecastSoFar(world, line)).toEqual(banked(world, 3));
    const three = dayForecast(world);
    advance(world, 16 * H);
    expect(banked(world, 3)).toEqual(three);
  });

  // Every version of a day is kept until its close, which lets go of those before the last the line had
  // settled onto: so it carries one version past midnight here, not three, and its plan from midnight is
  // the same as with all three. Shown failing with settle() keeping every version of a line still
  // settling, which carried all three, a whole day's; on 43554a9, which let them go at each change once
  // handed over, it kept one before the close.
  it('carries into the next day only the versions from the last it had settled onto, its plan from midnight the same', () => {
    const { world, line } = drawnAtFive();
    advance(world, SECONDS_PER_DAY + 3 * H); // 08:00 on day 2
    // Every 10 minutes from 08:00, every 15 from 12:00 (handing over at 23:45) and every 10 from 23:50.
    for (const [every, until] of [[600, 12 * H], [900, 23 * H + 50 * 60], [600, 24 * H - 1]] as const) {
      if (!setHeadways(world, line, { peak: every, offpeak: every, overnight: null }).ok) throw new Error('no change');
      const s = world.services.get(line)!;
      advance(world, until - frameSecond(s.settling, world.state.elapsed));
      if (until < 24 * H - 1) expect(world.services.get(line)!.effect.merged!.handover).toBeLessThan(until);
    }
    const kept = world.state.lines[0]!;
    const all = [...kept.earlier!];
    expect(all).toHaveLength(3);
    advance(world, 1); // day 2's close
    expect(world.services.get(line)!.effect.merged!.handover).toBeGreaterThan(SECONDS_PER_DAY);
    expect(kept.earlier).toEqual(all.slice(2));
    // The plan with all three, as before the close, holds the same from midnight: the same buses out each
    // minute, and each hour the same legs, driving and drives to and from the depot, none on the two let go.
    const s = world.services.get(line)!;
    const [lon, lat] = toLngLat(world.city.frame, s.plan.stops[0]!);
    const whole = planInEffect(s.day.inputs, settlingOf(all, { firstStop: { lon, lat }, model: kept.model })!.earlier);
    expect(whole.merged!.handover).toBe(s.effect.merged!.handover);
    for (let t = SECONDS_PER_DAY; t < 2 * SECONDS_PER_DAY; t += 60) expect(busesOutAt(s.effect, t), `${t}`).toBe(busesOutAt(whole, t));
    for (let h = 0; h < 24; h++) {
      const from = SECONDS_PER_DAY + h * H;
      const was = hourOfMerged(whole.merged!, from, from + H);
      expect(hourOfMerged(s.effect.merged!, from, from + H), `day 3, ${h}:00`).toEqual({ legs: was.legs.slice(2), serviceS: was.serviceS, pullOuts: was.pullOuts.slice(2), pullIns: was.pullIns.slice(2) });
      expect([...was.legs.slice(0, 2), ...was.pullOuts.slice(0, 2), ...was.pullIns.slice(0, 2)]).toEqual([0, 0, 0, 0, 0, 0]);
    }
  });
  // Two changes late in the evening, the first not handed over by the second, after one long since handed
  // over: the close keeps the versions from the one it had settled onto, two of three, not the newest
  // alone, and its plan from midnight is the same as with all three. Shown failing with settledOnto
  // returning the newest version kept, which rebased the next day on the 23:30 change's version, one
  // that never ran alone: kept [23:40's] where [23:30's, 23:40's] were due.
  it('keeps the versions from the last it had settled onto, when that is not the newest', () => {
    const { world, line } = drawnAtFive();
    advance(world, SECONDS_PER_DAY + 3 * H); // 08:00 on day 2
    const change = (every: number, until: number) => {
      if (!setHeadways(world, line, { peak: every, offpeak: every, overnight: null }).ok) throw new Error('no change');
      const handover = world.services.get(line)!.effect.merged!.handover;
      advance(world, until - frameSecond(world.services.get(line)!.settling, world.state.elapsed));
      return handover;
    };
    expect(change(600, 23 * H + 30 * 60)).toBeLessThan(23 * H + 30 * 60); // every 10 from 08:00, long handed over by 23:30
    expect(change(900, 23 * H + 40 * 60)).toBeGreaterThan(23 * H + 40 * 60); // every 15 from 23:30, not by 23:40
    change(1_200, 24 * H - 1); // every 20 from 23:40
    const kept = world.state.lines[0]!;
    const all = [...kept.earlier!];
    expect(all).toHaveLength(3);
    advance(world, 1); // day 2's close
    expect(kept.earlier).toEqual(all.slice(1));
    const s = world.services.get(line)!;
    const [lon, lat] = toLngLat(world.city.frame, s.plan.stops[0]!);
    const whole = planInEffect(s.day.inputs, settlingOf(all, { firstStop: { lon, lat }, model: kept.model })!.earlier);
    expect(whole.merged!.handover).toBe(s.effect.merged!.handover);
    for (let t = SECONDS_PER_DAY; t < 2 * SECONDS_PER_DAY; t += 60) expect(busesOutAt(s.effect, t), `${t}`).toBe(busesOutAt(whole, t));
    for (let h = 0; h < 24; h++) {
      const from = SECONDS_PER_DAY + h * H;
      const was = hourOfMerged(whole.merged!, from, from + H);
      expect(hourOfMerged(s.effect.merged!, from, from + H), `day 3, ${h}:00`).toEqual({ legs: was.legs.slice(1), serviceS: was.serviceS, pullOuts: was.pullOuts.slice(1), pullIns: was.pullIns.slice(1) });
      expect([was.legs[0], was.pullOuts[0], was.pullIns[0]]).toEqual([0, 0, 0]);
    }
  });
});

/** A change the line card or the route editor might make to the line as it stands: what it was, or null where the rules refused it. */
function anyChange(world: World, rng: Rng, id: LineId): string | null {
  const line = world.state.lines.find((l) => l.id === id)!;
  const every = () => rng.pick([300, 600, 900, 1_200, 1_800]);
  const stops = line.stopIds.map((s) => world.state.stops.find((p) => p.id === s)!).map((p): LngLat => [p.lon, p.lat]);
  switch (rng.int(0, 4)) {
    case 0:
      return setHeadways(world, id, { peak: every(), offpeak: every(), overnight: null }).ok ? 'headways' : null;
    case 1:
      return setModel(world, id, line.model === 'sparrow' ? 'metro40' : 'sparrow').ok ? 'model' : null;
    case 2:
      return setRoute(world, id, [...stops].reverse()).ok ? 'reversed' : null;
    case 3:
      return removeStop(world, id, rng.pick(line.stopIds)).ok ? 'a stop removed' : null;
    default:
      return extendLine(world, id, 'end', [[-71.1085, 42.3395]]).ok ? 'extended' : null;
  }
}

// Changes one after another over two days, some within a round trip of the last and some long after it
// handed over, a first stop moved among them (a route reversed or its first stop removed): after each,
// the hours the day has banked are forecast as they banked, and at each close the day's forecast meets
// its card to the cent. Seeded. Shown failing (TS-04) on 43554a9 with each seed at its first change after
// a handover: seed 1's model swap at 08:10 on day 2 forecast hours 0–7 at $52.38 running, $147.33 wages
// and $6.46 to and from the depot, where they banked $46.56, $121.33 and $20.22.
describe('changes in a row through two days (seeded; I1, I6)', () => {
  for (const seed of [1, 2, 3]) {
    it(`seed ${seed}: each day's forecast is what it banks, the hours gone as they banked`, { timeout: 60_000 }, () => {
      const rng = createRng(seed);
      const { world, line } = drawnAtFive();
      advance(world, SECONDS_PER_DAY + H); // 06:00 on day 2
      const done: string[] = [];
      let afterHandover = 0;
      let firstStop = 0;
      for (;;) {
        const t = toCalendarTime(world.state.elapsed);
        const wait = rng.pick([0, 5, 10, 20, 40, 60, 90]) * 60;
        if (t.secondOfDay + wait >= SECONDS_PER_DAY) {
          const day = dayForecast(world);
          advance(world, SECONDS_PER_DAY - t.secondOfDay);
          expect(banked(world, t.day), `day ${t.day}: ${done.join('; ')}`).toEqual(day);
          if (t.day === 3) break;
          continue;
        }
        advance(world, wait);
        for (let k = rng.int(1, 2); k > 0; k--) {
          const s = world.services.get(line)!;
          const handedOver = (world.state.lines[0]!.earlier ?? []).length > 0 && frameSecond(s.settling, world.state.elapsed) >= s.effect.merged!.handover;
          const first = s.plan.stops[0]!;
          const what = anyChange(world, rng, line);
          if (!what) continue;
          const now = toCalendarTime(world.state.elapsed);
          done.push(`day ${now.day} ${now.hour}:${String(now.minute).padStart(2, '0')} ${what}`);
          afterHandover += Number(handedOver);
          firstStop += Number(world.services.get(line)!.plan.stops[0]!.join() !== first.join());
          expect(forecastSoFar(world, line), done.join('; ')).toEqual(banked(world, now.day));
        }
      }
      expect(afterHandover).toBeGreaterThan(0);
      expect(firstStop).toBeGreaterThan(0);
    });
  }
});
