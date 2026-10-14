// Each stop's day (the M3 spec, item 5): its boardings and alightings over every line that calls
// there, of the boardings those changing from another line (item 13), and its net, V2's
// apportionment (`Intralines_City_dep@archive/intralines-city-v1:Gaming/src/30-sim.js:3757-3792`):
// what its paid boardings pay at each line's fare and subsidy (a change pays nothing; its trip paid
// its first line, EC-04), less each line's day of costs shared by boardings, or evenly over its
// stops when nobody boards, and less its own upkeep (config/stops.ts; D25). Flagged Quiet under 5
// boardings a day and Loss under −$20 a day.
import { stopUpkeepCents } from '../config/stops';
import type { StopId } from '../core/ids';
import { subsidyCents } from '../rules/fare';
import { stopFlags } from '../rules/stopDay';
import type { World } from '../world';
import { forecastDay } from './costs';

export interface StopDay {
  readonly id: StopId;
  readonly boardings: number;
  readonly alightings: number;
  /** Of the boardings, those changing from another line. */
  readonly transfers: number;
  readonly netCents: number;
  readonly quiet: boolean;
  readonly loss: boolean;
}

export function stopDays(world: World): StopDay[] {
  const sums = new Map<StopId, { boardings: number; alightings: number; transfers: number; net: number }>(
    world.state.stops.map((s) => [s.id, { boardings: 0, alightings: 0, transfers: 0, net: -stopUpkeepCents(s.tier) }]),
  );
  for (const line of world.state.lines) {
    const demand = world.assignment.lines.get(line.id);
    const service = world.services.get(line.id);
    const costs = service ? forecastDay(service.costs) : null;
    const dayCost = costs ? costs.running + costs.wages + costs.deadhead : 0;
    const total = demand ? demand.perDay : 0;
    const rate = line.fareCents + subsidyCents(line.fareCents);
    line.stopIds.forEach((id, q) => {
      const sum = sums.get(id);
      if (!sum) return;
      const boardings = demand?.boardingsByStop[q] ?? 0;
      const transfers = demand?.transfersByStop[q] ?? 0;
      sum.boardings += boardings;
      sum.alightings += demand?.alightingsByStop[q] ?? 0;
      sum.transfers += transfers;
      sum.net += (boardings - transfers) * rate - (total > 0 ? (dayCost * boardings) / total : dayCost / line.stopIds.length);
    });
  }
  return [...sums].map(([id, s]) => {
    const netCents = Math.round(s.net);
    return { id, boardings: s.boardings, alightings: s.alightings, transfers: s.transfers, netCents, ...stopFlags(s.boardings, netCents) };
  });
}
