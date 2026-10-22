// Close a line (the late game at the bus ceiling, DECISIONS, Open, its recommended (a)): every bus it has sold at half price, as a
// Buses sold row, and each of its stops no other line calls at taken down for half its cost, as a Stops sold back row, as a
// route edit takes down the stops it leaves (rules/route.ts closingOf, which the Lines panel's ask reads too; GD-05). Its rows in the
// ledger stay, under its id. A bus out on a trip leaves with the line, and the hour under way banks nothing for it: step.ts
// banks each hour's fares and costs by the lines running at its end.
import { BUS_MODELS } from '../config/fleet';
import { toCalendarTime } from '../core/calendar';
import type { LineId } from '../core/ids';
import { ok, refuse, type Result } from '../core/result';
import { spendParts, type SpendPart } from '../economy/ledger';
import { closingOf } from '../rules/route';
import { recomputeInService, type World } from '../world';

export function closeLine(world: World, lineId: LineId): Result<{ saleCents: number; refundCents: number; stopsDown: number }, 'no_such_line'> {
  const state = world.state;
  const line = state.lines.find((l) => l.id === lineId);
  if (!line) return refuse('no_such_line');
  const closing = closingOf(
    { buses: line.buses, model: BUS_MODELS[line.model], stopIds: line.stopIds },
    state.stops.map((s) => ({ id: s.id, tier: s.tier, linesHere: state.lines.filter((l) => l.stopIds.includes(s.id)).length })),
  );
  const parts: SpendPart[] = [{ kind: 'busSales', amountCents: closing.saleCents, lineId }, { kind: 'stopSales', amountCents: closing.refundCents }];
  // Sales only add cash, so the ledger never refuses them.
  spendParts(state.ledger, parts, toCalendarTime(state.elapsed).day);
  const down = new Set(closing.removed.map((r) => r.stopId));
  state.lines = state.lines.filter((l) => l.id !== lineId);
  state.stops = state.stops.filter((s) => !down.has(s.id));
  recomputeInService(world);
  return ok({ saleCents: closing.saleCents, refundCents: closing.refundCents, stopsDown: down.size });
}
