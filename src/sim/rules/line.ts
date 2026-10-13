// A line draft's verdict, a headway change's and a model change's (the M2 spec, items 2–4; the M3
// spec, item 2): one predicate each for the card and the command (GD-05). A depot comes first (V1),
// then the stops, the streets between them, the headways, room at the depots and the cash. Every
// count comes from the one cycle function (K07) at the line's model's speed, so the card's "needs 2
// Sparrows" is what Create buys and what the timetable runs.
import { DEPOT_CAPACITY } from '../config/depots';
import { STOP_COST_CENTS } from '../config/economy';
import { RESALE_PERMILLE, SPARROW, type BusModel } from '../config/fleet';

/** The models the cards offer, read from the config rows the commands use. */
export { BUS_MODELS, MODEL_IDS, type BusModel, type BusModelId } from '../config/fleet';
import { MIN_LINE_STOPS } from '../config/lines';
import type { XY } from '../core/geo';
import { ok, refuse, type Result } from '../core/result';
import { busesNeeded, cycleSeconds } from './cycle';
import { checkHeadways, type HeadwayRefusal, type Headways } from './periods';
import { spendableCents } from './credit';
import { checkStopSite, type StopPick, type StopSiteContext } from './stop';

/** What the fleet rules read: depots built, buses owned across every line, and cash. */
export interface FleetContext {
  readonly depots: number;
  readonly busesOwned: number;
  readonly cashCents: number;
}

export interface LineDraftContext extends StopSiteContext, FleetContext {
  /** Street metres from one stop to the next as the line drives it, or null if no street joins them. */
  readonly legM: (from: XY, to: XY) => number | null;
}

/** A draft as far as it resolves: the card shows it even when the verdict is a refusal. */
export interface LineDraft {
  readonly stops: readonly StopPick[];
  /** Street metres from the first stop to each stop. */
  readonly stopDistM: readonly number[];
  readonly routeM: number;
  readonly cycle: number;
  readonly buses: number;
  readonly newStops: number;
  readonly stopsCents: number;
  readonly busesCents: number;
  readonly priceCents: number;
}

export type LineRefusal = 'needs_depot' | 'model_locked' | 'no_street_near' | 'stop_twice' | 'no_route' | 'too_few_stops' | HeadwayRefusal | 'depot_full' | 'insufficient_funds';
export type LineVerdict = Result<
  { readonly draft: LineDraft },
  LineRefusal,
  { readonly draft: LineDraft; readonly at?: number; readonly limitM?: number; readonly limitSeconds?: number; readonly room?: number; readonly shortCents?: number }
>;

/** Buses the depots still have room for. */
export const depotRoom = (ctx: FleetContext): number => ctx.depots * DEPOT_CAPACITY - ctx.busesOwned;

/** The draft a list of clicks (frame metres) makes, and whether Create may buy it with `headways`. */
export function checkLineDraft(ctx: LineDraftContext, clicks: readonly XY[], headways: Headways, model: BusModel = SPARROW): LineVerdict {
  const stops: StopPick[] = [];
  const ids: number[] = [];
  const stopDistM: number[] = [];
  const placed: { id: number; at: XY }[] = [];
  let problem: { reason: 'no_street_near' | 'stop_twice' | 'no_route'; at: number; limitM?: number } | null = null;
  for (let k = 0; k < clicks.length; k++) {
    // A draft's own new stops can be joined too, under negative ids, so a click beside one is that stop again.
    const site = checkStopSite({ nearestNode: ctx.nearestNode, stops: [...ctx.stops, ...placed] }, clicks[k]!);
    if (!site.ok) {
      problem = { reason: site.reason, at: k, limitM: site.limitM };
      break;
    }
    const pick: StopPick = site.kind === 'join' ? { kind: 'join', stopId: site.stopId, at: site.at, distM: site.distM } : { kind: 'new', node: site.node, at: site.at, distM: site.distM };
    const id = pick.kind === 'join' ? pick.stopId : -(placed.length + 1);
    if (ids.includes(id)) {
      problem = { reason: 'stop_twice', at: k };
      break;
    }
    const leg = stops.length ? ctx.legM(stops[stops.length - 1]!.at, pick.at) : 0;
    if (leg === null) {
      problem = { reason: 'no_route', at: k };
      break;
    }
    stopDistM.push((stopDistM[stopDistM.length - 1] ?? 0) + leg);
    stops.push(pick);
    ids.push(id);
    if (pick.kind === 'new') placed.push({ id, at: pick.at });
  }
  const routeM = stopDistM[stopDistM.length - 1] ?? 0;
  const enough = stops.length >= MIN_LINE_STOPS;
  const cycle = enough ? cycleSeconds(routeM, stops.length, model.kmh) : 0;
  const headwaysOk = checkHeadways(headways);
  const buses = enough && headwaysOk.ok ? busesNeeded(cycle, headways) : 0;
  const newStops = stops.filter((s) => s.kind === 'new').length;
  const stopsCents = newStops * STOP_COST_CENTS;
  const busesCents = buses * model.priceCents;
  const draft: LineDraft = { stops, stopDistM, routeM, cycle, buses, newStops, stopsCents, busesCents, priceCents: stopsCents + busesCents };

  if (ctx.depots === 0) return refuse('needs_depot', { draft });
  if (model.locked) return refuse('model_locked', { draft });
  if (problem) return refuse(problem.reason, { draft, at: problem.at, ...(problem.limitM === undefined ? {} : { limitM: problem.limitM }) });
  if (!enough) return refuse('too_few_stops', { draft });
  if (!headwaysOk.ok) return refuse(headwaysOk.reason, { draft, ...(headwaysOk.limitSeconds === undefined ? {} : { limitSeconds: headwaysOk.limitSeconds }) });
  const room = depotRoom(ctx);
  if (buses > room) return refuse('depot_full', { draft, room });
  if (draft.priceCents > spendableCents(ctx.cashCents)) return refuse('insufficient_funds', { draft, shortCents: draft.priceCents - spendableCents(ctx.cashCents) });
  return ok({ draft });
}

export type HeadwayChangeRefusal = HeadwayRefusal | 'depot_full' | 'insufficient_funds';

/** A headway change on a line with `cycle` and `buses` of `model`: the buses it needs, how many to buy, and their price. */
export function checkHeadwayChange(
  ctx: FleetContext,
  line: { readonly cycle: number; readonly buses: number; readonly model: BusModel },
  headways: Headways,
): Result<{ needed: number; extra: number; priceCents: number }, HeadwayChangeRefusal, { limitSeconds?: number; room?: number; shortCents?: number }> {
  const valid = checkHeadways(headways);
  if (!valid.ok) return valid;
  const needed = busesNeeded(line.cycle, headways);
  const extra = Math.max(0, needed - line.buses);
  const room = depotRoom(ctx);
  if (extra > room) return refuse('depot_full', { room });
  const priceCents = extra * line.model.priceCents;
  if (priceCents > spendableCents(ctx.cashCents)) return refuse('insufficient_funds', { shortCents: priceCents - spendableCents(ctx.cashCents) });
  return ok({ needed, extra, priceCents });
}

export type ModelChangeRefusal = 'same_model' | 'model_locked' | 'depot_full' | 'insufficient_funds';

/**
 * A line changing model (the M3 spec, item 2): it sells every bus it has at half price (V1's resale,
 * no wear) and buys what its headways need of the new model on its new cycle. Room at the depots and
 * the cash are checked on the net, since the old buses leave as the new ones come.
 */
export function checkModelChange(
  ctx: FleetContext,
  line: { readonly routeM: number; readonly stops: number; readonly buses: number; readonly model: BusModel; readonly headways: Headways },
  to: BusModel,
): Result<{ needed: number; buyCents: number; saleCents: number }, ModelChangeRefusal, { room?: number; shortCents?: number }> {
  if (to.id === line.model.id) return refuse('same_model');
  if (to.locked) return refuse('model_locked');
  const needed = busesNeeded(cycleSeconds(line.routeM, line.stops, to.kmh), line.headways);
  const room = depotRoom(ctx) + line.buses;
  if (needed > room) return refuse('depot_full', { room });
  const buyCents = needed * to.priceCents;
  const saleCents = Math.floor((line.buses * line.model.priceCents * RESALE_PERMILLE) / 1000);
  const netCents = buyCents - saleCents;
  if (netCents > spendableCents(ctx.cashCents)) return refuse('insufficient_funds', { shortCents: netCents - spendableCents(ctx.cashCents) });
  return ok({ needed, buyCents, saleCents });
}
