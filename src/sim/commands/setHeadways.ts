// A headway change (the M2 spec, item 4): the rule says how many more buses the new headways need,
// the ledger pays for them as one Purchases row, and the line runs them from the next hour. Fewer
// buses are never sold here; a line with spare buses parks them and pays no driver for them.
import { BUS_MODELS } from '../config/fleet';
import { toCalendarTime } from '../core/calendar';
import type { LineId } from '../core/ids';
import { ok, refuse, type Result } from '../core/result';
import { spend } from '../economy/ledger';
import { checkHeadwayChange, type HeadwayChangeRefusal } from '../rules/line';
import type { Headways } from '../rules/periods';
import { fleetContext, recompute, type World } from '../world';

export function setHeadways(
  world: World,
  lineId: LineId,
  headways: Headways,
): Result<{ bought: number; priceCents: number }, HeadwayChangeRefusal | 'no_such_line', { limitSeconds?: number; room?: number; shortCents?: number }> {
  const line = world.state.lines.find((l) => l.id === lineId);
  const service = world.services.get(lineId);
  if (!line || !service) return refuse('no_such_line');
  const change = checkHeadwayChange(fleetContext(world), { cycle: service.timing.cycle, cycles: service.timing.cycles, buses: line.buses, model: BUS_MODELS[line.model] }, headways);
  if (!change.ok) return change;
  if (change.priceCents > 0) {
    const paid = spend(world.state.ledger, change.priceCents, toCalendarTime(world.state.elapsed).day);
    if (!paid.ok) return refuse('insufficient_funds', { shortCents: paid.shortCents });
  }
  line.headways = { ...headways };
  line.buses += change.extra;
  recompute(world);
  return ok({ bought: change.extra, priceCents: change.priceCents });
}
