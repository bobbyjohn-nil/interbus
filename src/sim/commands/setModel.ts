// A line changing model (the M3 spec, item 2): every bus it has is sold at half price, as a Buses sold
// row, and the buses its headways need of the new model are bought, as a Buses bought row (D25). The
// rule checks the cash on the net, and so does the ledger: the two are one purchase.
import { BUS_MODELS, type BusModelId } from '../config/fleet';
import { toCalendarTime } from '../core/calendar';
import type { LineId } from '../core/ids';
import { ok, refuse, type Result } from '../core/result';
import { spendParts } from '../economy/ledger';
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
  const paid = spendParts(
    world.state.ledger,
    [
      { kind: 'busSales', amountCents: change.saleCents, lineId },
      { kind: 'buses', amountCents: -change.buyCents, lineId },
    ],
    day,
  );
  if (!paid.ok) throw new Error(`setModel: the rule passed ${change.buyCents} against ${world.state.ledger.cashCents}`);
  line.model = model;
  line.buses = change.needed;
  recomputeInService(world);
  return ok({ bought: change.needed, buyCents: change.buyCents, saleCents: change.saleCents });
}
