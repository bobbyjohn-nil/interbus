// A stop's tier (the M3 spec, item 5): up costs the steps' prices as a Stop upgrades row; down sells
// the fittings back at half what the steps cost, as a Stops sold back row (D25). Riders feel the new walk bonus
// from the recompute it triggers.
import { toCalendarTime } from '../core/calendar';
import type { StopId } from '../core/ids';
import { ok, refuse, type Result } from '../core/result';
import { spendParts } from '../economy/ledger';
import { checkStopTier, type StopTier, type StopTierRefusal } from '../rules/stopTier';
import { recompute, type World } from '../world';

export function setStopTier(
  world: World,
  stopId: StopId,
  tier: number,
): Result<{ priceCents: number; saleCents: number }, StopTierRefusal | 'no_such_stop', { limit?: number; shortCents?: number }> {
  const stop = world.state.stops.find((s) => s.id === stopId);
  if (!stop) return refuse('no_such_stop');
  const linesHere = world.state.lines.filter((l) => l.stopIds.includes(stopId)).length;
  const verdict = checkStopTier({ cashCents: world.state.ledger.cashCents, linesHere }, stop.tier, tier);
  if (!verdict.ok) return verdict;
  const day = toCalendarTime(world.state.elapsed).day;
  const paid = spendParts(
    world.state.ledger,
    [
      { kind: 'stopUpgrades', amountCents: -verdict.priceCents },
      { kind: 'stopSales', amountCents: verdict.saleCents },
    ],
    day,
  );
  if (!paid.ok) return refuse('insufficient_funds', { shortCents: paid.shortCents });
  stop.tier = tier as StopTier;
  recompute(world);
  return ok({ priceCents: verdict.priceCents, saleCents: verdict.saleCents });
}
