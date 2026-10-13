// Where a click puts a stop (the M2 spec, item 3): joining a stop that already stands within 250 m,
// as a transfer (EC-10), or else on the nearest street node. One predicate for the cursor card, the
// draft card and Create (GD-05).
import { STOP_JOIN_M, STOP_STREET_REACH_M } from '../config/lines';
import { distXY, type XY } from '../core/geo';
import { ok, refuse, type Result } from '../core/result';

/** What the predicate reads: the street nodes, and the stops standing (with any a draft has placed). */
export interface StopSiteContext {
  readonly nearestNode: (at: XY, withinM: number) => { readonly node: number; readonly at: XY; readonly distM: number } | null;
  readonly stops: readonly { readonly id: number; readonly at: XY }[];
}

/** A stop a click picks: one already standing, or a new one on a street node. */
export type StopPick =
  | { readonly kind: 'join'; readonly stopId: number; readonly at: XY; readonly distM: number }
  | { readonly kind: 'new'; readonly node: number; readonly at: XY; readonly distM: number };

export type StopRefusal = 'no_street_near';

export function checkStopSite(ctx: StopSiteContext, at: XY): Result<StopPick, StopRefusal, { limitM: number }> {
  let join: { id: number; at: XY; distM: number } | null = null;
  for (const s of ctx.stops) {
    const d = distXY(s.at, at);
    if (d <= STOP_JOIN_M && (!join || d < join.distM || (d === join.distM && s.id < join.id))) join = { id: s.id, at: s.at, distM: d };
  }
  if (join) return ok({ kind: 'join', stopId: join.id, at: join.at, distM: join.distM });
  const street = ctx.nearestNode(at, STOP_STREET_REACH_M);
  if (!street) return refuse('no_street_near', { limitM: STOP_STREET_REACH_M });
  return ok({ kind: 'new', node: street.node, at: street.at, distM: street.distM });
}
