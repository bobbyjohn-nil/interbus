// Set a line's whole route (D25: route editing in "an expanded menu there you can reorder, add, and
// remove stops"): the route rule decides on the whole line; the ledger pays New stops and Buses bought
// rows for what it adds and a Stops sold back row for the stops it leaves alone, which come down; and
// every trip under way finishes on the route it began on (world.ts recomputeInService). One command,
// so one undo puts it all back (I9). The editor's card reads the same rule (GD-05).
import { BUS_MODELS } from '../config/fleet';
import type { StopTier } from '../config/stops';
import { toCalendarTime } from '../core/calendar';
import { toLngLat, toXY, type LngLat } from '../core/geo';
import { mint, type LineId, type StopId } from '../core/ids';
import { ok, refuse, type Result } from '../core/result';
import { spendParts } from '../economy/ledger';
import { checkRoute, type RouteRefusal, type RouteVerdict } from '../rules/route';
import { lineDraftContext, recomputeInService, type World } from '../world';

/** The route rule's verdict on `line` running through `points`, for the command and the editor's card. */
export function routeVerdict(world: World, lineId: LineId, points: readonly LngLat[]): RouteVerdict | null {
  const state = world.state;
  const line = state.lines.find((l) => l.id === lineId);
  if (!line) return null;
  const stopsHere = (stopId: number) => {
    const stop = state.stops.find((s) => s.id === stopId);
    return stop ? { tier: stop.tier as StopTier, otherLines: state.lines.filter((l) => l !== line && l.stopIds.includes(stopId as StopId)).length } : null;
  };
  return checkRoute(lineDraftContext(world), { stopIds: line.stopIds, buses: line.buses, headways: line.headways, model: BUS_MODELS[line.model] }, points.map((p) => toXY(world.city.frame, p)), stopsHere);
}

export function setRoute(
  world: World,
  lineId: LineId,
  points: readonly LngLat[],
): Result<{ priceCents: number; extraBuses: number; refundCents: number }, RouteRefusal | 'no_such_line', { at?: number; limitM?: number; limitSeconds?: number; room?: number; shortCents?: number }> {
  const state = world.state;
  const line = state.lines.find((l) => l.id === lineId);
  const verdict = routeVerdict(world, lineId, points);
  if (!line || !verdict) return refuse('no_such_line');
  if (!verdict.ok) {
    const { at, limitM, limitSeconds, room, shortCents } = verdict;
    return refuse(verdict.reason, Object.fromEntries(Object.entries({ at, limitM, limitSeconds, room, shortCents }).filter(([, v]) => v !== undefined)));
  }
  const { draft, extraBuses, removed, refundCents } = verdict;
  const paid = spendParts(
    state.ledger,
    [
      { kind: 'stops', amountCents: -draft.stopsCents },
      { kind: 'buses', amountCents: -draft.busesCents, lineId },
      { kind: 'stopSales', amountCents: refundCents },
    ],
    toCalendarTime(state.elapsed).day,
  );
  if (!paid.ok) return refuse('insufficient_funds', { shortCents: paid.shortCents });
  line.stopIds = draft.stops.map((pick) => {
    if (pick.kind === 'join') return pick.stopId as StopId;
    const [id, next] = mint(state.nextIds, 'stop');
    state.nextIds = next;
    const [lon, lat] = toLngLat(world.city.frame, pick.at);
    state.stops.push({ id, lon, lat, tier: 1 });
    return id;
  });
  const gone = new Set(removed.map((r) => r.stopId));
  state.stops = state.stops.filter((s) => !gone.has(s.id));
  line.buses += extraBuses;
  recomputeInService(world);
  return ok({ priceCents: draft.priceCents, extraBuses, refundCents });
}
