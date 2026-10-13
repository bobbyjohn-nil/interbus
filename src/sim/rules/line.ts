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
import { busesNeeded, cycleSeconds, cyclesOf, slowedM, type Cycles } from './cycle';
import { checkHeadways, type HeadwayRefusal, type Headways } from './periods';
import { spendableCents } from './credit';
import { checkStopSite, type StopPick, type StopSiteContext } from './stop';
import { modelLocked, type Medals } from './medal';

/** What the fleet rules read: depots built, buses owned across every line, cash and the medals held. */
export interface FleetContext {
  readonly depots: number;
  readonly busesOwned: number;
  readonly cashCents: number;
  /** The medals held, which unlock bus models (rules/medal.ts). */
  readonly medals: Medals;
}

/** A leg as the line drives it: street metres, those metres weighted by how much of the rush each street takes, and those through roadworks today. */
export interface Leg {
  readonly m: number;
  readonly rushM: number;
  readonly worksM: number;
}

export interface LineDraftContext extends StopSiteContext, FleetContext {
  /** The street from one stop to the next as the line drives it, or null if no street joins them. */
  readonly leg: (from: XY, to: XY) => Leg | null;
  /** That street as a line of points, for finding the leg a click points at (rules/route.ts checkInsert). */
  readonly legPath?: (from: XY, to: XY) => readonly XY[] | null;
}

/** A draft as far as it resolves: the card shows it even when the verdict is a refusal. */
export interface LineDraft {
  readonly stops: readonly StopPick[];
  /** Street metres from the first stop to each stop. */
  readonly stopDistM: readonly number[];
  readonly routeM: number;
  /** The round trip at the day's average traffic, and in each period (rules/cycle.ts). */
  readonly cycle: number;
  readonly cycles: Cycles;
  /** How much of the rush the route's streets take (traffic/congestion.ts). */
  readonly rush: number;
  /** Metres of the route through roadworks today, driven at ROADWORKS_SPEED (rules/cycle.ts slowedM). */
  readonly worksM: number;
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
  let rushM = 0;
  let worksM = 0;
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
    const leg = stops.length ? ctx.leg(stops[stops.length - 1]!.at, pick.at) : { m: 0, rushM: 0, worksM: 0 };
    if (leg === null) {
      problem = { reason: 'no_route', at: k };
      break;
    }
    stopDistM.push((stopDistM[stopDistM.length - 1] ?? 0) + leg.m);
    rushM += leg.rushM;
    worksM += leg.worksM;
    stops.push(pick);
    ids.push(id);
    if (pick.kind === 'new') placed.push({ id, at: pick.at });
  }
  const routeM = stopDistM[stopDistM.length - 1] ?? 0;
  const enough = stops.length >= MIN_LINE_STOPS;
  const rush = routeM > 0 ? rushM / routeM : 0;
  const cycle = enough ? cycleSeconds(slowedM(routeM, worksM), stops.length, model.kmh) : 0;
  const cycles = enough ? cyclesOf(slowedM(routeM, worksM), stops.length, model.kmh, rush) : { peak: 0, offpeak: 0, overnight: 0 };
  const headwaysOk = checkHeadways(headways);
  const buses = enough && headwaysOk.ok ? busesNeeded(cycles, headways) : 0;
  const newStops = stops.filter((s) => s.kind === 'new').length;
  const stopsCents = newStops * STOP_COST_CENTS;
  const busesCents = buses * model.priceCents;
  const draft: LineDraft = { stops, stopDistM, routeM, cycle, cycles, rush, worksM, buses, newStops, stopsCents, busesCents, priceCents: stopsCents + busesCents };

  if (ctx.depots === 0) return refuse('needs_depot', { draft });
  if (modelLocked(model, ctx.medals)) return refuse('model_locked', { draft });
  if (problem) return refuse(problem.reason, { draft, at: problem.at, ...(problem.limitM === undefined ? {} : { limitM: problem.limitM }) });
  if (!enough) return refuse('too_few_stops', { draft });
  if (!headwaysOk.ok) return refuse(headwaysOk.reason, { draft, ...(headwaysOk.limitSeconds === undefined ? {} : { limitSeconds: headwaysOk.limitSeconds }) });
  const room = depotRoom(ctx);
  if (buses > room) return refuse('depot_full', { draft, room });
  if (draft.priceCents > spendableCents(ctx.cashCents)) return refuse('insufficient_funds', { draft, shortCents: draft.priceCents - spendableCents(ctx.cashCents) });
  return ok({ draft });
}

export type HeadwayChangeRefusal = HeadwayRefusal | 'depot_full' | 'insufficient_funds';

/** A headway change on a line with round trips `cycles` (or one `cycle` all day) and `buses` of `model`: the buses it needs, how many to buy, and their price. */
export function checkHeadwayChange(
  ctx: FleetContext,
  line: { readonly cycle: number; readonly cycles?: Cycles | undefined; readonly buses: number; readonly model: BusModel },
  headways: Headways,
): Result<{ needed: number; extra: number; priceCents: number }, HeadwayChangeRefusal, { limitSeconds?: number; room?: number; shortCents?: number }> {
  const valid = checkHeadways(headways);
  if (!valid.ok) return valid;
  const needed = busesNeeded(line.cycles ?? line.cycle, headways);
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
  line: { readonly routeM: number; readonly stops: number; readonly rush?: number; readonly worksM?: number; readonly buses: number; readonly model: BusModel; readonly headways: Headways },
  to: BusModel,
): Result<{ needed: number; buyCents: number; saleCents: number }, ModelChangeRefusal, { room?: number; shortCents?: number }> {
  if (to.id === line.model.id) return refuse('same_model');
  if (modelLocked(to, ctx.medals)) return refuse('model_locked');
  const needed = busesNeeded(cyclesOf(slowedM(line.routeM, line.worksM ?? 0), line.stops, to.kmh, line.rush ?? 0), line.headways);
  const room = depotRoom(ctx) + line.buses;
  if (needed > room) return refuse('depot_full', { room });
  const buyCents = needed * to.priceCents;
  const saleCents = Math.floor((line.buses * line.model.priceCents * RESALE_PERMILLE) / 1000);
  const netCents = buyCents - saleCents;
  if (netCents > spendableCents(ctx.cashCents)) return refuse('insufficient_funds', { shortCents: netCents - spendableCents(ctx.cashCents) });
  return ok({ needed, buyCents, saleCents });
}
