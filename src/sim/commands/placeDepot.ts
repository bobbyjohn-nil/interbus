// Places a depot (the M2 spec, item 2): the depot rule says where, the ledger pays (a Purchases row),
// and the depot is saved by place. A depot comes before any line or bus (V1).
import { toXY, type LngLat } from '../core/geo';
import { mint, type DepotId } from '../core/ids';
import { ok, refuse, type Result } from '../core/result';
import { toCalendarTime } from '../core/calendar';
import { spend, type SpendRefusal } from '../economy/ledger';
import { checkDepotSite, type DepotRefusal } from '../rules/depot';
import { depotSiteContext, recomputeInService, type World } from '../world';

export function placeDepot(
  world: World,
  at: LngLat,
): Result<{ depotId: DepotId; priceCents: number }, DepotRefusal | SpendRefusal, { limitM?: number; nearestM?: number; shortCents?: number }> {
  const site = checkDepotSite(depotSiteContext(world), toXY(world.city.frame, at));
  if (!site.ok) return site;
  const paid = spend(world.state.ledger, site.priceCents, toCalendarTime(world.state.elapsed).day);
  if (!paid.ok) return refuse(paid.reason, { shortCents: paid.shortCents });
  const [depotId, next] = mint(world.state.nextIds, 'depot');
  world.state.nextIds = next;
  world.state.depots.push({ id: depotId, lon: at[0], lat: at[1] });
  // Lines without a depot park here now, and pay their deadhead from it.
  recomputeInService(world);
  return ok({ depotId, priceCents: site.priceCents });
}
