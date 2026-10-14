// Extend a line from either end (the M3 spec, item 14): the route rule decides on the whole line,
// the ledger pays New stops and Buses bought rows for the new stops and the buses its longer cycle needs, and the
// line runs on its new stops from the recompute. The card read the same rule (GD-05, I6).
import { BUS_MODELS } from '../config/fleet';
import { toCalendarTime } from '../core/calendar';
import { toLngLat, toXY, type LngLat } from '../core/geo';
import { mint, type LineId, type StopId } from '../core/ids';
import { ok, refuse, type Result } from '../core/result';
import { spendParts } from '../economy/ledger';
import { checkExtend, type ExtendRefusal, type LineEnd } from '../rules/route';
import { lineDraftContext, recomputeInService, type World } from '../world';

export function extendLine(
  world: World,
  lineId: LineId,
  end: LineEnd,
  clicks: readonly LngLat[],
): Result<{ priceCents: number; extraBuses: number }, ExtendRefusal | 'no_such_line', { at?: number; limitM?: number; limitSeconds?: number; room?: number; shortCents?: number }> {
  const state = world.state;
  const line = state.lines.find((l) => l.id === lineId);
  if (!line) return refuse('no_such_line');
  const at = (id: StopId) => {
    const stop = state.stops.find((s) => s.id === id)!;
    return toXY(world.city.frame, [stop.lon, stop.lat]);
  };
  const verdict = checkExtend(
    lineDraftContext(world),
    { stops: line.stopIds.map(at), buses: line.buses, headways: line.headways, model: BUS_MODELS[line.model] },
    end,
    clicks.map((c) => toXY(world.city.frame, c)),
  );
  if (!verdict.ok) {
    const { at: where, limitM, limitSeconds, room, shortCents } = verdict;
    return refuse(verdict.reason, Object.fromEntries(Object.entries({ at: where, limitM, limitSeconds, room, shortCents }).filter(([, v]) => v !== undefined)));
  }
  const { draft, extraBuses } = verdict;
  const paid = spendParts(
    state.ledger,
    [
      { kind: 'stops', amountCents: -draft.stopsCents },
      { kind: 'buses', amountCents: -draft.busesCents, lineId },
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
  line.buses += extraBuses;
  recomputeInService(world);
  return ok({ priceCents: draft.priceCents, extraBuses });
}
