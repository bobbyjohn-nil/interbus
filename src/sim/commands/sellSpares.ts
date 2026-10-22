// A line's spare buses sold (the late game at the bus ceiling, DECISIONS, Open, its recommended (a)): those its headways no
// longer need, at half price as a Buses sold row, so their depot places are free for another line. The rule is
// rules/line.ts checkSellSpares, which the line card reads too (GD-05). A line short of its spares after a slower day (snow,
// roadworks) runs short-handed, as any line does.
import { BUS_MODELS } from '../config/fleet';
import { toCalendarTime } from '../core/calendar';
import type { LineId } from '../core/ids';
import { ok, refuse, type Result } from '../core/result';
import { spendParts } from '../economy/ledger';
import { checkSellSpares, type SellSparesRefusal } from '../rules/line';
import { recomputeInService, type World } from '../world';

export function sellSpares(world: World, lineId: LineId): Result<{ sold: number; saleCents: number }, SellSparesRefusal | 'no_such_line'> {
  const line = world.state.lines.find((l) => l.id === lineId);
  const service = world.services.get(lineId);
  if (!line || !service) return refuse('no_such_line');
  const verdict = checkSellSpares({ buses: line.buses, cycle: service.timing.cycle, cycles: service.timing.cycles, model: BUS_MODELS[line.model], headways: line.headways });
  if (!verdict.ok) return verdict;
  // A sale only adds cash, so the ledger never refuses it.
  spendParts(world.state.ledger, [{ kind: 'busSales', amountCents: verdict.saleCents, lineId }], toCalendarTime(world.state.elapsed).day);
  line.buses = verdict.needed;
  recomputeInService(world);
  return ok({ sold: verdict.sold, saleCents: verdict.saleCents });
}
