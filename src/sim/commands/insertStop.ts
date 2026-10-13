// Insert a stop into a running line (the M4 spec, item 4): the click goes into the leg of the line
// nearest it, as a new stop or one standing there; the ledger pays one Purchases row for a new stop
// and any bus the longer round trip needs, and every trip under way finishes on the route it began
// on (world.ts recomputeInService). One command, so one undo puts it all back (I9). The card read
// the same rule (GD-05).
import { BUS_MODELS } from '../config/fleet';
import { toCalendarTime } from '../core/calendar';
import { toLngLat, toXY, type LngLat } from '../core/geo';
import { mint, type LineId, type StopId } from '../core/ids';
import { ok, refuse, type Result } from '../core/result';
import { spend } from '../economy/ledger';
import { checkInsert, type InsertRefusal } from '../rules/route';
import { lineDraftContext, recomputeInService, type World } from '../world';

export function insertStop(
  world: World,
  lineId: LineId,
  at: LngLat,
): Result<{ priceCents: number; extraBuses: number; stopId: StopId }, InsertRefusal | 'no_such_line', { at?: number; limitM?: number; limitSeconds?: number; room?: number; shortCents?: number }> {
  const state = world.state;
  const line = state.lines.find((l) => l.id === lineId);
  if (!line) return refuse('no_such_line');
  const xy = (id: StopId) => {
    const stop = state.stops.find((s) => s.id === id)!;
    return toXY(world.city.frame, [stop.lon, stop.lat]);
  };
  const verdict = checkInsert(lineDraftContext(world), { stops: line.stopIds.map(xy), buses: line.buses, headways: line.headways, model: BUS_MODELS[line.model] }, toXY(world.city.frame, at));
  if (!verdict.ok) {
    const { at: where, limitM, limitSeconds, room, shortCents } = verdict;
    return refuse(verdict.reason, Object.fromEntries(Object.entries({ at: where, limitM, limitSeconds, room, shortCents }).filter(([, v]) => v !== undefined)));
  }
  const { draft, extraBuses, leg } = verdict;
  if (draft.priceCents > 0) {
    const paid = spend(state.ledger, draft.priceCents, toCalendarTime(state.elapsed).day);
    if (!paid.ok) return refuse('insufficient_funds', { shortCents: paid.shortCents });
  }
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
  return ok({ priceCents: draft.priceCents, extraBuses, stopId: line.stopIds[leg + 1]! });
}
