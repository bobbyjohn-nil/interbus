// A stop's tier: one predicate for the stop card's buttons and the command (GD-05). Up a step costs
// that tier's price; down gives back half of what the steps cost (the M3 spec, item 5).
import { STOP_TIER_IDS, STOP_TIERS, type StopTier, type StopTierRow } from '../config/stops';
import { ok, refuse, type Result } from '../core/result';
import { spendableCents } from './credit';

export { STOP_TIER_IDS, STOP_TIERS, type StopTier, type StopTierRow };

export type StopTierRefusal = 'same_tier' | 'no_such_tier' | 'needs_lines' | 'insufficient_funds';

/** What the predicate reads: the cash, and how many lines call at the stop. */
export interface StopTierContext {
  readonly cashCents: number;
  readonly linesHere: number;
}

export function checkStopTier(
  ctx: StopTierContext,
  from: StopTier,
  to: number,
): Result<{ readonly priceCents: number; readonly saleCents: number }, StopTierRefusal, { limit?: number; shortCents?: number }> {
  if (!STOP_TIER_IDS.includes(to as StopTier)) return refuse('no_such_tier');
  if (to === from) return refuse('same_tier');
  const steps = (a: number, b: number) => STOP_TIER_IDS.filter((t) => t > a && t <= b).reduce((sum, t) => sum + STOP_TIERS[t].upgradeCents, 0);
  if (to < from) return ok({ priceCents: 0, saleCents: steps(to, from) / 2 });
  const need = STOP_TIERS[to as StopTier].minLines;
  if (ctx.linesHere < need) return refuse('needs_lines', { limit: need });
  const priceCents = steps(from, to);
  if (priceCents > spendableCents(ctx.cashCents)) return refuse('insufficient_funds', { shortCents: priceCents - spendableCents(ctx.cashCents) });
  return ok({ priceCents, saleCents: 0 });
}
