// M2's costs on the fixture: a depot and the debug line run two days, and every cost is a ledger row
// that equals the line inspector's forecast to the cent (the M2 spec's exit check 5; I1, I6).
import { describe, expect, it } from 'vitest';
import { addDebugLine } from './commands/debugLine';
import { placeDepot } from './commands/placeDepot';
import { SECONDS_PER_DAY } from './config/time';
import { DEPOT_UPKEEP_PER_HOUR_CENTS, forecastDay } from './economy/costs';
import { busesOut } from './rules/schedule';
import type { RowKind } from './economy/ledger';
import { encode } from './save/save';
import { advance } from './step';
import { fixtureGame, gameWithDepot, onDepotLand } from './testing';
import type { World } from './world';

const BUILD = { sha: 'test', version: '0.0.0' };

function game(withDepot = true): World {
  const world = withDepot ? gameWithDepot() : fixtureGame();
  if (!addDebugLine(world).ok) throw new Error('no line');
  return world;
}

const total = (world: World, day: number, kind: RowKind) =>
  world.state.ledger.rows.filter((r) => r.day === day && r.kind === kind).reduce((s, r) => s + r.amountCents, 0);

describe('costs as ledger rows (the M2 spec, item 5)', () => {
  it('banks each cost as rows equal to the forecast, to the cent, on a part day and a whole one (I1, I6)', () => {
    const world = game();
    const service = [...world.services.values()][0]!;
    expect(service.depotId).toBe(world.state.depots[0]!.id);
    expect(service.costs.pullOutM).toBeGreaterThan(0);
    const events = advance(world, 2 * SECONDS_PER_DAY);
    // Day 1 starts at 05:00, so its forecast is from hour 5; day 2 is a whole day.
    for (const [day, fromHour] of [[1, 5], [2, 0]] as const) {
      const forecast = forecastDay(service.costs, fromHour);
      expect(forecast.running).toBeGreaterThan(0);
      expect(forecast.deadhead).toBeGreaterThan(0);
      expect(total(world, day, 'running')).toBe(-forecast.running);
      expect(total(world, day, 'wages')).toBe(-forecast.wages);
      expect(total(world, day, 'deadhead')).toBe(-forecast.deadhead);
      expect(total(world, day, 'upkeep')).toBe(-(24 - fromHour) * DEPOT_UPKEEP_PER_HOUR_CENTS);
      const card = events.find((e) => e.day === day)!;
      expect(card.rows.reduce((s, r) => s + r.amountCents, 0)).toBe(card.cashAfterCents - card.cashBeforeCents);
    }
    expect(world.state.ledger.cashCents).toBe(world.state.ledger.rows.reduce((s, r) => s + r.amountCents, 0));
  });

  it('runs the debug line at $1,300–1,400 a day in running and wages, two Sparrows by day', () => {
    const world = game();
    expect(world.state.lines[0]!.buses).toBe(2);
    const service = [...world.services.values()][0]!;
    expect(busesOut(service.day)).toBe(2);
    const day = forecastDay(service.costs);
    // 57 departures out and back × 3.2 km × $0.90 ≈ $332 (3.5 km and $363, the spec's magnitude,
    // until buses drove one-way streets both ways on 2026-10-14), and two buses out about 18.7 hours
    // each × $26 ≈ $972.
    expect(day.running).toBe(114 * 291);
    expect(day.wages).toBeGreaterThan(96_000);
    expect(day.wages).toBeLessThan(98_000);
    expect(day.running + day.wages).toBeGreaterThan(130_000);
    expect(day.running + day.wages).toBeLessThan(140_000);
  });

  it('has no deadhead without a depot, and parks a line at a depot placed after it', () => {
    const world = game(false);
    const service = [...world.services.values()][0]!;
    expect(service.depotId).toBeNull();
    advance(world, SECONDS_PER_DAY);
    expect(total(world, 1, 'deadhead')).toBe(0);
    expect(total(world, 1, 'upkeep')).toBe(0);
    expect(total(world, 1, 'wages')).toBe(-forecastDay(service.costs, 5).wages);
    const placed = placeDepot(world, onDepotLand());
    if (!placed.ok) throw new Error(placed.reason);
    expect([...world.services.values()][0]!.depotId).toBe(placed.depotId);
  });

  it('closes each day into one row per kind and line, so a save grows by a day card a day', () => {
    const world = game();
    advance(world, SECONDS_PER_DAY);
    const afterOne = encode(world.state, BUILD).length;
    advance(world, 9 * SECONDS_PER_DAY);
    const rows = world.state.ledger.rows.filter((r) => r.day === 5);
    expect(rows.map((r) => r.kind)).toEqual(['fares', 'subsidy', 'running', 'wages', 'deadhead', 'upkeep', 'stopUpkeep']);
    // A day of one line, one depot and its stops is seven rows, about 0.4 KB of save.
    expect((encode(world.state, BUILD).length - afterOne) / 9).toBeLessThan(500);
  });
});
