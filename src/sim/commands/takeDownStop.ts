// Take down a stop no line calls at (D25): a stop placed on its own, or left alone, comes down for
// half of what it and its fittings cost, as a Stops sold back row (rules/route.ts).
import { toCalendarTime } from '../core/calendar';
import type { StopId } from '../core/ids';
import { ok, refuse, type Result } from '../core/result';
import { spendParts } from '../economy/ledger';
import { checkTakeDownStop, type TakeDownRefusal } from '../rules/route';
import type { World } from '../world';

export function takeDownStop(world: World, stopId: StopId): Result<{ refundCents: number }, TakeDownRefusal | 'no_such_stop', { limit?: number }> {
  const state = world.state;
  const stop = state.stops.find((s) => s.id === stopId);
  if (!stop) return refuse('no_such_stop');
  const verdict = checkTakeDownStop(stop, state.lines.filter((l) => l.stopIds.includes(stopId)).length);
  if (!verdict.ok) return verdict;
  state.stops = state.stops.filter((s) => s.id !== stopId);
  spendParts(state.ledger, [{ kind: 'stopSales', amountCents: verdict.refundCents }], toCalendarTime(state.elapsed).day);
  return ok({ refundCents: verdict.refundCents });
}
