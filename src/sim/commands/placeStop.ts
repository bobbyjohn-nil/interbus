// Place a stop on its own (D25: "options to place individual stops"): the stop rule decides, the
// ledger pays a New stops row, and the stop stands alone until a line calls there. The cursor card
// reads the same rule (GD-05).
import { toCalendarTime } from '../core/calendar';
import { toLngLat, toXY, type LngLat } from '../core/geo';
import { mint, type StopId } from '../core/ids';
import { ok, refuse, type Result } from '../core/result';
import { spendParts } from '../economy/ledger';
import { checkPlaceStop, type PlaceStopRefusal } from '../rules/stop';
import { lineDraftContext, type World } from '../world';

export function placeStop(world: World, at: LngLat): Result<{ stopId: StopId; priceCents: number }, PlaceStopRefusal, { limitM?: number; stopId?: number; shortCents?: number }> {
  const state = world.state;
  const verdict = checkPlaceStop(lineDraftContext(world), toXY(world.city.frame, at));
  if (!verdict.ok) return verdict;
  const paid = spendParts(state.ledger, [{ kind: 'stops', amountCents: -verdict.priceCents }], toCalendarTime(state.elapsed).day);
  if (!paid.ok) return refuse('insufficient_funds', { shortCents: paid.shortCents });
  const [stopId, next] = mint(state.nextIds, 'stop');
  state.nextIds = next;
  const [lon, lat] = toLngLat(world.city.frame, verdict.at);
  state.stops.push({ id: stopId, lon, lat, tier: 1 });
  return ok({ stopId, priceCents: verdict.priceCents });
}
