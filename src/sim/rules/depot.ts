// Where a depot may stand, and what it costs: one predicate for the cursor card and the place command
// (GD-05); the green tint draws the depot land it reads. V3's order of checks (`Intralines_City@dc63602:src/game/depots/
// siting.ts:75-92`): how many, the land, a street to leave by, then room from the other depots; then
// the cash, as the stop and line rules check it, so the card never offers a depot the click refuses.
import { DEPOT_FIRST_PRICE_CENTS, DEPOT_PRICE_GROWTH, DEPOT_PRICE_STEP_CENTS, DEPOT_SPACING_M, DEPOT_STREET_REACH_M, MAX_DEPOTS } from '../config/depots';
import { distXY, pointInRing, type XY } from '../core/geo';
import { ok, refuse, type Result } from '../core/result';
import { shortfallCents } from './credit';

/** The price of the next depot when `built` already stand. */
export function depotPriceCents(built: number): number {
  return Math.round((DEPOT_FIRST_PRICE_CENTS * DEPOT_PRICE_GROWTH ** built) / DEPOT_PRICE_STEP_CENTS) * DEPOT_PRICE_STEP_CENTS;
}

/** What the predicate reads: the city's depot land, its street nodes, the depots already built and the cash. */
export interface DepotSiteContext {
  readonly land: readonly (readonly XY[])[];
  readonly nearestNode: (at: XY, withinM: number) => { readonly node: number; readonly distM: number } | null;
  readonly depots: readonly XY[];
  readonly cashCents: number;
}

export type DepotRefusal = 'depot_limit' | 'not_depot_land' | 'too_far_from_street' | 'too_close_to_depot' | 'insufficient_funds';

export interface DepotSite {
  /** The street node the depot's buses leave from. */
  readonly node: number;
  readonly streetM: number;
  readonly priceCents: number;
}

/** Whether a depot may stand at `at` (frame metres), and if so where its buses leave and what it costs. */
export function checkDepotSite(ctx: DepotSiteContext, at: XY): Result<DepotSite, DepotRefusal, { limitM?: number; nearestM?: number; shortCents?: number; priceCents?: number }> {
  if (ctx.depots.length >= MAX_DEPOTS) return refuse('depot_limit');
  if (!ctx.land.some((ring) => pointInRing(ring, at))) return refuse('not_depot_land');
  const street = ctx.nearestNode(at, DEPOT_STREET_REACH_M);
  if (!street) return refuse('too_far_from_street', { limitM: DEPOT_STREET_REACH_M });
  const nearestM = ctx.depots.reduce((best, d) => Math.min(best, distXY(d, at)), Infinity);
  if (nearestM < DEPOT_SPACING_M) return refuse('too_close_to_depot', { limitM: DEPOT_SPACING_M, nearestM });
  const priceCents = depotPriceCents(ctx.depots.length);
  const short = shortfallCents(priceCents, ctx.cashCents);
  if (short > 0) return refuse('insufficient_funds', { shortCents: short, priceCents });
  return ok({ node: street.node, streetM: street.distM, priceCents });
}
