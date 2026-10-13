// Remove a stop from a line (the M3 spec, item 14): the line runs on without it from the recompute,
// keeping its buses (a shorter cycle may leave one spare); a stop no other line calls at is taken
// down and half of what it cost comes back as a Refunds row (rules/route.ts).
import { toCalendarTime } from '../core/calendar';
import type { LineId, StopId } from '../core/ids';
import { ok, refuse, type Result } from '../core/result';
import { refund } from '../economy/ledger';
import { checkRemoveStop, type RemoveStopRefusal } from '../rules/route';
import { recompute, type World } from '../world';

export function removeStop(
  world: World,
  lineId: LineId,
  stopId: StopId,
): Result<{ orphaned: boolean; refundCents: number }, RemoveStopRefusal | 'no_such_line' | 'no_such_stop', { limit?: number }> {
  const state = world.state;
  const line = state.lines.find((l) => l.id === lineId);
  if (!line) return refuse('no_such_line');
  const stop = state.stops.find((s) => s.id === stopId);
  if (!stop) return refuse('no_such_stop');
  const others = state.lines.filter((l) => l !== line && l.stopIds.includes(stopId)).length;
  const verdict = checkRemoveStop(line, stop, others);
  if (!verdict.ok) return verdict;
  line.stopIds = line.stopIds.filter((id) => id !== stopId);
  if (verdict.orphaned) {
    state.stops = state.stops.filter((s) => s.id !== stopId);
    if (verdict.refundCents > 0) refund(state.ledger, verdict.refundCents, toCalendarTime(state.elapsed).day);
  }
  recompute(world);
  return ok({ orphaned: verdict.orphaned, refundCents: verdict.refundCents });
}
