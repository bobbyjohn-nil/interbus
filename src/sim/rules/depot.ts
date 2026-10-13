// Where a depot may stand, and what it costs: one predicate for the cursor card, the place command
// and the green tint (GD-05). V3's order of checks (`Intralines_City@dc63602:src/game/depots/
// siting.ts:75-92`): how many, the land, a street to leave by, then room from the other depots.
import { DEPOT_FIRST_PRICE_CENTS, DEPOT_PRICE_GROWTH, DEPOT_PRICE_STEP_CENTS, DEPOT_SPACING_M, DEPOT_STREET_REACH_M, MAX_DEPOTS } from '../config/depots';
import { distXY, pointInRing, type XY } from '../core/geo';
import { ok, refuse, type Result } from '../core/result';

/** The price of the next depot when `built` already stand. */
export function depotPriceCents(built: number): number {
  return Math.round((DEPOT_FIRST_PRICE_CENTS * DEPOT_PRICE_GROWTH ** built) / DEPOT_PRICE_STEP_CENTS) * DEPOT_PRICE_STEP_CENTS;
}

/** What the predicate reads: the city's depot land, its street nodes, and the depots already built. */
export interface DepotSiteContext {
  readonly land: readonly (readonly XY[])[];
  readonly nearestNode: (at: XY, withinM: number) => { readonly node: number; readonly distM: number } | null;
  readonly depots: readonly XY[];
}

export type DepotRefusal = 'depot_limit' | 'not_depot_land' | 'too_far_from_street' | 'too_close_to_depot';

export interface DepotSite {
  /** The street node the depot's buses leave from. */
  readonly node: number;
  readonly streetM: number;
  readonly priceCents: number;
}

/** Whether a depot may stand at `at` (frame metres), and if so where its buses leave and what it costs. */
export function checkDepotSite(ctx: DepotSiteContext, at: XY): Result<DepotSite, DepotRefusal, { limitM?: number; nearestM?: number }> {
  if (ctx.depots.length >= MAX_DEPOTS) return refuse('depot_limit');
  if (!ctx.land.some((ring) => pointInRing(ring, at))) return refuse('not_depot_land');
  const street = ctx.nearestNode(at, DEPOT_STREET_REACH_M);
  if (!street) return refuse('too_far_from_street', { limitM: DEPOT_STREET_REACH_M });
  const nearestM = ctx.depots.reduce((best, d) => Math.min(best, distXY(d, at)), Infinity);
  if (nearestM < DEPOT_SPACING_M) return refuse('too_close_to_depot', { limitM: DEPOT_SPACING_M, nearestM });
  return ok({ node: street.node, streetM: street.distM, priceCents: depotPriceCents(ctx.depots.length) });
}
