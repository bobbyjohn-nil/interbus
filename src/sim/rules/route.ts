// Route edits (the M3 spec, item 14): one predicate for the stop card's button and the command
// (GD-05). A line gives up a stop and keeps at least MIN_LINE_STOPS; the streets that joined its
// neighbours through it still join them, so no route is lost. A stop no other line calls at goes
// with it and gives back half of what it and its fittings cost, as a Refunds row: no stop stands
// without a line, as V2's orphans did. Insert waits for M4.
import { STOP_COST_CENTS } from '../config/economy';
import { MIN_LINE_STOPS } from '../config/lines';
import { STOP_TIER_IDS, STOP_TIERS, type StopTier } from '../config/stops';
import { ok, refuse, type Result } from '../core/result';

export type RemoveStopRefusal = 'not_on_line' | 'line_keeps_two';

/** What a stop and its fittings cost: the Sign every stop starts as, and each step up to its tier. */
export function stopCostCents(tier: StopTier): number {
  return STOP_COST_CENTS + STOP_TIER_IDS.filter((t) => t <= tier).reduce((sum, t) => sum + STOP_TIERS[t].upgradeCents, 0);
}

/** Taking `stopId` off a line: whether it may, and what comes back if no other line calls there. */
export function checkRemoveStop(
  line: { readonly stopIds: readonly number[] },
  stop: { readonly id: number; readonly tier: StopTier },
  otherLinesHere: number,
): Result<{ readonly orphaned: boolean; readonly refundCents: number }, RemoveStopRefusal, { limit?: number }> {
  if (!line.stopIds.includes(stop.id)) return refuse('not_on_line');
  if (line.stopIds.length - 1 < MIN_LINE_STOPS) return refuse('line_keeps_two', { limit: MIN_LINE_STOPS });
  const orphaned = otherLinesHere === 0;
  return ok({ orphaned, refundCents: orphaned ? Math.floor(stopCostCents(stop.tier) / 2) : 0 });
}
