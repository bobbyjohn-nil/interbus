// Create (the M2 spec, item 3): the line rule decides, the ledger pays a New stops row for the new
// stops and a Buses bought row for the buses the founding headway needs (D25), and the line runs from the next hour. The card
// read the same rule, so Create buys exactly what the card said (GD-05, I6).
import { REFERENCE_FARE_CENTS } from '../config/economy';
import { BUS_MODELS, type BusModelId } from '../config/fleet';
import { FOUNDING_HEADWAYS, LINE_COLOURS } from '../config/lines';
import { toCalendarTime } from '../core/calendar';
import { toLngLat, toXY, type LngLat } from '../core/geo';
import { mint, type LineId, type StopId } from '../core/ids';
import { ok, refuse, type Result } from '../core/result';
import { spendParts } from '../economy/ledger';
import { checkLineDraft, type LineRefusal } from '../rules/line';
import type { Headways } from '../rules/periods';
import { lineDraftContext, recompute, type World } from '../world';

export function createLine(
  world: World,
  clicks: readonly LngLat[],
  headways: Headways = FOUNDING_HEADWAYS,
  model: BusModelId = 'sparrow',
): Result<{ lineId: LineId; priceCents: number }, LineRefusal, { at?: number; limitM?: number; limitSeconds?: number; room?: number; shortCents?: number }> {
  const state = world.state;
  const verdict = checkLineDraft(lineDraftContext(world), clicks.map((c) => toXY(world.city.frame, c)), headways, BUS_MODELS[model]);
  if (!verdict.ok) {
    // The card shows the draft; the command's refusal carries only the reason and its numbers.
    const { at, limitM, limitSeconds, room, shortCents } = verdict;
    return refuse(verdict.reason, Object.fromEntries(Object.entries({ at, limitM, limitSeconds, room, shortCents }).filter(([, v]) => v !== undefined)));
  }
  const { draft } = verdict;
  // The id the line will take, for its Buses bought row; minted below, after the stops.
  const [lineIdNext] = mint(state.nextIds, 'line');
  const paid = spendParts(
    state.ledger,
    [
      { kind: 'stops', amountCents: -draft.stopsCents },
      { kind: 'buses', amountCents: -draft.busesCents, lineId: lineIdNext },
    ],
    toCalendarTime(state.elapsed).day,
  );
  if (!paid.ok) return refuse('insufficient_funds', { shortCents: paid.shortCents });
  const stopIds: StopId[] = draft.stops.map((pick) => {
    if (pick.kind === 'join') return pick.stopId as StopId;
    const [id, next] = mint(state.nextIds, 'stop');
    state.nextIds = next;
    const [lon, lat] = toLngLat(world.city.frame, pick.at);
    state.stops.push({ id, lon, lat, tier: 1 });
    return id;
  });
  const [lineId, next] = mint(state.nextIds, 'line');
  if (lineId !== lineIdNext) throw new Error(`createLine: minted ${lineId}, paid for ${lineIdNext}`);
  state.nextIds = next;
  state.lines.push({
    id: lineId,
    name: `Line ${lineId}`,
    colour: LINE_COLOURS[(lineId - 1) % LINE_COLOURS.length]!,
    stopIds,
    fareCents: REFERENCE_FARE_CENTS,
    headways: { ...headways },
    boardedMilli: 0,
    model,
    buses: draft.buses,
  });
  recompute(world);
  return ok({ lineId, priceCents: draft.priceCents });
}
