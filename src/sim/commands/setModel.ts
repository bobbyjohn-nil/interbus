// A line changing model (the M3 spec, item 2): every bus it has is sold at half price, as one Sales
// row, and the buses its headways need of the new model are bought, as one Purchases row. The rule
// checks the cash on the net, so the sale lands first.
import { BUS_MODELS, type BusModelId } from '../config/fleet';
import { toCalendarTime } from '../core/calendar';
import type { LineId } from '../core/ids';
import { ok, refuse, type Result } from '../core/result';
import { sell, spend } from '../economy/ledger';
import { checkModelChange, type ModelChangeRefusal } from '../rules/line';
import { fleetContext, recomputeInService, type World } from '../world';

export function setModel(
  world: World,
  lineId: LineId,
  model: BusModelId,
): Result<{ bought: number; buyCents: number; saleCents: number }, ModelChangeRefusal | 'no_such_line', { room?: number; shortCents?: number }> {
  const line = world.state.lines.find((l) => l.id === lineId);
  const service = world.services.get(lineId);
  if (!line || !service) return refuse('no_such_line');
  const plan = service.plan;
  const change = checkModelChange(
    fleetContext(world),
    { routeM: plan.stopDistM[plan.stopDistM.length - 1]!, stops: plan.stops.length, rush: plan.rush ?? 0, buses: line.buses, model: BUS_MODELS[line.model], headways: line.headways },
    BUS_MODELS[model],
  );
  if (!change.ok) return change;
  const day = toCalendarTime(world.state.elapsed).day;
  if (change.saleCents > 0) sell(world.state.ledger, change.saleCents, day);
  const paid = spend(world.state.ledger, change.buyCents, day);
  if (!paid.ok) throw new Error(`setModel: the rule passed ${change.buyCents} against ${world.state.ledger.cashCents}`);
  line.model = model;
  line.buses = change.needed;
  recomputeInService(world);
  return ok({ bought: change.needed, buyCents: change.buyCents, saleCents: change.saleCents });
}
