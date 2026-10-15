// Finance (the M3 spec, item 6): every row by kind for today, yesterday and this quarter, with
// capital in, so each column adds up to the change in cash over it; beside a day's forecast. Shown
// failing (TS-04) with capital rows left out of the columns, as V1 and V2 left capital out of
// "profit": the quarter no longer adds up to the cash.
import { describe, expect, it } from 'vitest';
import { createLine } from '../commands/createLine';
import { addDebugLine, DEBUG_STOPS } from '../commands/debugLine';
import { setHeadways } from '../commands/setHeadways';
import { SECONDS_PER_DAY } from '../config/time';
import { subsidyCents } from '../rules/fare';
import { advance } from '../step';
import { gameWithDepot } from '../testing';
import { forecastDay } from './costs';
import { finance } from './finance';
import { foundingCapitalCents, post, rowsOfDay, type RowKind } from './ledger';

function game() {
  const world = gameWithDepot();
  if (!addDebugLine(world).ok) throw new Error('no line');
  return world;
}

const total = (rows: readonly { todayCents: number; yesterdayCents: number; quarterCents: number }[], column: 'todayCents' | 'yesterdayCents' | 'quarterCents') => rows.reduce((s, r) => s + r[column], 0);

describe('Finance', () => {
  it('adds each column up to the change in cash over it, capital included', () => {
    const world = game();
    advance(world, SECONDS_PER_DAY + 12 * 3_600); // to 17:00 on day 2
    const f = finance(world);
    expect([f.day, f.quarter, f.quarterFirstDay]).toEqual([2, 1, 1]);
    // The starting cash sits on Day 0 (D25), before Quarter 1's first day: the column is the cash less it.
    expect(total(f.rows, 'quarterCents')).toBe(world.state.ledger.cashCents - foundingCapitalCents());
    expect(total(f.rows, 'yesterdayCents')).toBe(rowsOfDay(world.state.ledger, 1).reduce((s, r) => s + r.amountCents, 0));
    expect(total(f.rows, 'todayCents')).toBe(rowsOfDay(world.state.ledger, 2).reduce((s, r) => s + r.amountCents, 0));
    expect(f.rows.find((r) => r.kind === 'founding')).toMatchObject({ todayCents: 0, yesterdayCents: 0, quarterCents: 0, forecastCents: null });
    // Day 1's purchase, a row of its own kind (the debug line is laid free of charge).
    expect(f.rows.find((r) => r.kind === 'depots')).toMatchObject({ yesterdayCents: -15_000_000, forecastCents: null });
    expect(f.rows.find((r) => r.kind === 'stops')).toMatchObject({ yesterdayCents: 0, forecastCents: null });
    expect(f.rows.find((r) => r.kind === 'contract')!.forecastCents).toBeNull();
  });

  it('forecasts a whole day the way the inspector does: costs to the cent, upkeep for each depot and stop, interest on what is owed', () => {
    const world = game();
    const f = finance(world);
    const c = forecastDay([...world.services.values()][0]!.costs);
    const forecast = (kind: string) => f.rows.find((r) => r.kind === kind)!.forecastCents;
    // Four Signs at $4 a day each (config/stops.ts), and nothing owed.
    expect([forecast('running'), forecast('wages'), forecast('deadhead'), forecast('upkeep'), forecast('stopUpkeep'), forecast('interest')]).toEqual([-c.running, -c.wages, -c.deadhead, -30_000, -1_600, 0]);
    post(world.state.ledger, { day: 1, kind: 'buses', amountCents: -(world.state.ledger.cashCents + 10_000_000) });
    expect(finance(world).rows.find((r) => r.kind === 'interest')!.forecastCents).toBe(-6_000); // 0.06% of $100,000
    const riders = Math.floor(world.assignment.lines.get(world.state.lines[0]!.id)!.perDay);
    expect([forecast('fares'), forecast('subsidy')]).toEqual([riders * 225, riders * 160]);
  });

  // A line settling after a change made with its buses out banks each leg at the version it ran on,
  // and the Lines view forecasts that; Finance forecast the new day plan alone, so after a headway
  // change at noon it read 23% more fuel than the day banked. Shown failing (TS-04) with the forecast
  // made without the day.
  it('forecasts what a line settling after a change will bank today, as the Lines view does', () => {
    const world = game();
    advance(world, SECONDS_PER_DAY + 7 * 3_600); // to 12:00 on day 2, buses out
    const line = world.state.lines[0]!;
    if (!setHeadways(world, line.id, { peak: 600, offpeak: 600, overnight: null }).ok) throw new Error('no change');
    expect(world.services.get(line.id)!.settling).toBeTruthy();
    const f = finance(world);
    const forecast = (kind: RowKind) => -f.rows.find((r) => r.kind === kind)!.forecastCents!;
    const day = { running: forecast('running'), wages: forecast('wages'), deadhead: forecast('deadhead') };
    expect(day).toEqual(forecastDay(world.services.get(line.id)!.costs, 0, 2));
    expect(f.lines[0]!.forecastCents).toEqual(day); // the Lines view's, the same numbers
    // Its fares and subsidy are a whole day's at the riders it has now: only on the day a line is drawn do they count from that hour.
    const riders = Math.floor(world.assignment.lines.get(line.id)!.paidPerDay);
    expect([-forecast('fares'), -forecast('subsidy'), f.lines[0]!.incomeCents]).toEqual([riders * line.fareCents, riders * subsidyCents(line.fareCents), riders * (line.fareCents + subsidyCents(line.fareCents))]);
    advance(world, 12 * 3_600 + 60); // past day 2's close
    const banked = (kind: RowKind) => -rowsOfDay(world.state.ledger, 2).filter((r) => r.kind === kind).reduce((s, r) => s + r.amountCents, 0);
    expect(day).toEqual({ running: banked('running'), wages: banked('wages'), deadhead: banked('deadhead') });
  });

  // A line drawn mid-day bills from its first drive out (rules/transition.ts), as the day banks it, and
  // its riders pay from the hour it was drawn, that whole clock hour (step.ts banks by the hour), so
  // Finance forecasts both from then. Shown failing (TS-04) with paidRidersOn returning a whole day's
  // riders: 941 riders' fares and subsidy against the costs from 15:20, where 417 pay by midnight, so the
  // line's day read $2,667.10 and banked $649.70. On 5f4bce3 both were a whole day's: $1,471.27 against
  // $587.65 banked.
  it('forecasts a line drawn at 15:20 from then, its fares and subsidy from 15:00 and its costs from its drives out, as the day banks them', () => {
    const world = gameWithDepot();
    advance(world, 10 * 3_600 + 20 * 60); // 15:20 on day 1
    const made = createLine(world, DEBUG_STOPS.map((s) => s.at), { peak: 600, offpeak: 600, overnight: null });
    if (!made.ok) throw new Error(made.reason);
    const line = world.state.lines[0]!;
    const demand = world.assignment.lines.get(line.id)!;
    const riders = Math.floor(demand.paidBySlot.slice(2 * 15).reduce((s, paid) => s + paid, 0));
    expect(riders).toBeLessThan(0.6 * demand.paidPerDay);
    const f = finance(world);
    const forecast = (kind: RowKind) => f.rows.find((r) => r.kind === kind)!.forecastCents!;
    const fare = [line.fareCents, subsidyCents(line.fareCents)];
    expect([forecast('fares'), forecast('subsidy'), f.lines[0]!.incomeCents]).toEqual([riders * fare[0]!, riders * fare[1]!, riders * (fare[0]! + fare[1]!)]);
    const costs = forecastDay(world.services.get(line.id)!.costs, 0, 1);
    expect(f.lines[0]!.forecastCents).toEqual(costs);
    expect([forecast('running'), forecast('wages'), forecast('deadhead')]).toEqual([-costs.running, -costs.wages, -costs.deadhead]);
    // Day 1 then banks it: its costs to the cent, its fares and subsidy within a boarding.
    advance(world, 8 * 3_600 + 40 * 60); // to day 1's close
    const banked = (kind: RowKind) => rowsOfDay(world.state.ledger, 1).filter((r) => r.kind === kind && r.lineId === line.id).reduce((s, r) => s + r.amountCents, 0);
    expect({ running: -banked('running'), wages: -banked('wages'), deadhead: -banked('deadhead') }).toEqual(costs);
    expect(Math.abs(banked('fares') - forecast('fares'))).toBeLessThanOrEqual(fare[0]!);
    expect(Math.abs(banked('subsidy') - forecast('subsidy'))).toBeLessThanOrEqual(fare[1]!);
    // Day 2 is a whole day of it.
    const whole = Math.floor(world.assignment.lines.get(line.id)!.paidPerDay);
    expect(finance(world).lines[0]!.incomeCents).toBe(whole * (fare[0]! + fare[1]!));
  });

  // Changed again the same day, long after it handed over to its own day plan, it keeps that basis: it
  // keeps the version before it was drawn, which ran no bus, until the day's close (world.ts). Shown
  // failing (TS-04) with recomputeInService letting go of a drawn line's earlier versions once it has
  // handed over, as of any settled line: changed at 18:00, its day read a whole day's $3,110.80 of fares
  // and subsidy and $2,073.82 of costs, the hours before 15:20 in them, where day 1 banked $877.99 of
  // costs; and with merge() starting again from the day plan past a handover, its running read NaN.
  it('keeps forecasting a line drawn at 15:20 from that hour after a second change at 18:00, as the day banks it', () => {
    const world = gameWithDepot();
    advance(world, 10 * 3_600 + 20 * 60); // 15:20 on day 1
    const made = createLine(world, DEBUG_STOPS.map((s) => s.at), { peak: 600, offpeak: 600, overnight: null });
    if (!made.ok) throw new Error(made.reason);
    const line = world.state.lines[0]!;
    expect(world.services.get(line.id)!.effect.merged!.handover).toBeLessThan(16 * 3_600);
    advance(world, 2 * 3_600 + 40 * 60); // 18:00
    if (!setHeadways(world, line.id, { peak: 900, offpeak: 900, overnight: null }).ok) throw new Error('no change');
    const f = finance(world);
    const forecast = (kind: RowKind) => f.rows.find((r) => r.kind === kind)!.forecastCents!;
    const fare = [line.fareCents, subsidyCents(line.fareCents)];
    // Its fares and subsidy at the riders it has now, as any line's, from the hour it was drawn.
    const riders = Math.floor(world.assignment.lines.get(line.id)!.paidBySlot.slice(2 * 15).reduce((s, paid) => s + paid, 0));
    expect([forecast('fares'), forecast('subsidy'), f.lines[0]!.incomeCents]).toEqual([riders * fare[0]!, riders * fare[1]!, riders * (fare[0]! + fare[1]!)]);
    // Its costs nothing before the draw, its hours from 15:00 all of its day, and the day banks them to the cent.
    const costs = forecastDay(world.services.get(line.id)!.costs, 0, 1);
    expect(forecastDay(world.services.get(line.id)!.costs, 15, 1)).toEqual(costs);
    expect(f.lines[0]!.forecastCents).toEqual(costs);
    advance(world, 6 * 3_600); // to day 1's close
    const banked = (kind: RowKind) => rowsOfDay(world.state.ledger, 1).filter((r) => r.kind === kind && r.lineId === line.id).reduce((s, r) => s + r.amountCents, 0);
    expect({ running: -banked('running'), wages: -banked('wages'), deadhead: -banked('deadhead') }).toEqual(costs);
  });

  it('starts a new quarter on day 9: its column holds days 9 on, yesterday day 8', () => {
    const world = game();
    world.state.elapsed = 8 * SECONDS_PER_DAY + 3_600; // 06:00 on day 9
    for (const day of [7, 8, 9]) post(world.state.ledger, { day, kind: 'fares', amountCents: day * 100 });
    const f = finance(world);
    expect([f.day, f.quarter, f.quarterFirstDay]).toEqual([9, 2, 9]);
    expect(f.rows.find((r) => r.kind === 'fares')).toMatchObject({ todayCents: 900, yesterdayCents: 800, quarterCents: 900 });
    expect(f.rows.find((r) => r.kind === 'founding')!.quarterCents).toBe(0);
  });
});

// D25: Finance "would be better with some visuals". The chart's days and each line's money are read
// from the rows, not kept beside them. Shown failing (TS-04) with capital left out of the walk back to
// each day's closing cash, with no cap on the days, and with each line's money read from today.
describe('Finance’s chart and lines', () => {
  it('gives each day its money in, out and capital, adding up to its change in cash, and its closing cash', () => {
    const world = game();
    advance(world, SECONDS_PER_DAY + 6 * 3_600); // to 11:00 on day 2
    post(world.state.ledger, { day: 2, kind: 'buses', amountCents: -13_000_000 }); // a bus bought on day 2
    advance(world, 2 * SECONDS_PER_DAY); // to 11:00 on day 4
    const f = finance(world);
    expect(f.days.map((d) => d.day)).toEqual([1, 2, 3, 4]);
    let cash = f.openingCents;
    for (const d of f.days) {
      const rows = rowsOfDay(world.state.ledger, d.day).reduce((s, r) => s + r.amountCents, 0);
      expect(d.inCents + d.outCents + d.capitalCents).toBe(rows);
      expect(d.inCents).toBeGreaterThanOrEqual(0);
      expect(d.outCents).toBeLessThanOrEqual(0);
      cash += rows;
      expect(d.cashCents).toBe(cash);
    }
    expect(f.days.at(-1)!.cashCents).toBe(world.state.ledger.cashCents);
    expect(f.days.map((d) => d.capitalCents)).toEqual([-15_000_000, -13_000_000, 0, 0]); // the depot on day 1, the bus on day 2
  });

  it('keeps two quarters of days at most', () => {
    const world = game();
    advance(world, 20 * SECONDS_PER_DAY);
    const f = finance(world);
    expect(f.days).toHaveLength(16);
    expect(f.days[0]!.day).toBe(6);
    expect(f.days.at(-1)!.day).toBe(21);
  });

  it('gives each line yesterday’s money from the rows that name it, and its costs in the day’s forecast', () => {
    const world = game();
    advance(world, SECONDS_PER_DAY + 3 * 3_600); // to 08:00 on day 2, its first buses out
    const f = finance(world);
    const id = world.state.lines[0]!.id;
    const ofLine = (day: number, kinds: string[]) => rowsOfDay(world.state.ledger, day).filter((r) => r.lineId === id && kinds.includes(r.kind)).reduce((s, r) => s + r.amountCents, 0);
    const forecastCents = forecastDay(world.services.get(id)!.costs, 0, 2);
    const line = world.state.lines[0]!;
    const incomeCents = Math.floor(world.assignment.lines.get(id)!.paidPerDay) * (line.fareCents + subsidyCents(line.fareCents));
    expect(f.lines).toEqual([{ id, yesterdayInCents: ofLine(1, ['fares', 'subsidy']), yesterdayOutCents: ofLine(1, ['running', 'wages', 'deadhead']), incomeCents, forecastCents }]);
    expect(f.lines[0]!.yesterdayInCents).toBeGreaterThan(0);
    expect(f.lines[0]!.yesterdayOutCents).toBeLessThan(0);
    expect(ofLine(2, ['fares', 'subsidy'])).not.toBe(f.lines[0]!.yesterdayInCents); // today's differ
  });
});
