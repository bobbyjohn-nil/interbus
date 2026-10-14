// Finance (the M3 spec, item 6): every row by kind for today, yesterday and this quarter, with
// capital in, so each column adds up to the change in cash over it; beside a day's forecast. Shown
// failing (TS-04) with capital rows left out of the columns, as V1 and V2 left capital out of
// "profit": the quarter no longer adds up to the cash.
import { describe, expect, it } from 'vitest';
import { addDebugLine } from '../commands/debugLine';
import { SECONDS_PER_DAY } from '../config/time';
import { advance } from '../step';
import { gameWithDepot } from '../testing';
import { forecastDay } from './costs';
import { finance } from './finance';
import { post, rowsOfDay } from './ledger';

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
    // Quarter 1 began with the founding capital, so its column is the cash.
    expect(total(f.rows, 'quarterCents')).toBe(world.state.ledger.cashCents);
    expect(total(f.rows, 'yesterdayCents')).toBe(rowsOfDay(world.state.ledger, 1).reduce((s, r) => s + r.amountCents, 0));
    expect(total(f.rows, 'todayCents')).toBe(rowsOfDay(world.state.ledger, 2).reduce((s, r) => s + r.amountCents, 0));
    expect(f.rows.find((r) => r.kind === 'founding')).toMatchObject({ yesterdayCents: 42_720_000, forecastCents: null });
    expect(f.rows.find((r) => r.kind === 'purchase')!.forecastCents).toBeNull();
  });

  it('forecasts a whole day the way the inspector does: costs to the cent, upkeep for each depot', () => {
    const world = game();
    const f = finance(world);
    const c = forecastDay([...world.services.values()][0]!.costs);
    const forecast = (kind: string) => f.rows.find((r) => r.kind === kind)!.forecastCents;
    expect([forecast('running'), forecast('wages'), forecast('deadhead'), forecast('upkeep')]).toEqual([-c.running, -c.wages, -c.deadhead, -30_000]);
    const riders = Math.floor(world.assignment.lines.get(world.state.lines[0]!.id)!.perDay);
    expect([forecast('fares'), forecast('subsidy')]).toEqual([riders * 225, riders * 160]);
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
