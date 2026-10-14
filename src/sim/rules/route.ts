// Route edits (the M3 spec, item 14): one predicate each for the card and the command (GD-05).
// - Remove: a line gives up a stop and keeps at least MIN_LINE_STOPS; the streets that joined its
//   neighbours through it still join them, so no route is lost. A stop no other line calls at goes
//   with it and gives back half of what it and its fittings cost, as a Stops sold back row: an edit
//   never leaves a stop standing unnoticed, as V2's orphans did. A stop stands alone only where the
//   player placed it so (D25).
// - Extend: clicks beyond either end become new stops or join standing ones, and the whole line
//   must pass the line rule at its model and headways. It buys the new stops and the buses its
//   longer cycle needs beyond those it has.
// - Insert (the M4 spec, item 4): a click goes into the leg of the line nearest it, within
//   INSERT_REACH_M of the leg's streets, as a new stop or one standing there; the whole line passes
//   the line rule as for an extension, and a detour over DETOUR_WARN_SHARE of the leg warns but never
//   blocks (V2's design, `Intralines_City_dep@archive/intralines-city-v1:Gaming/docs/design/
//   route-editing.md:20-30`).
// - Route (D25): the line's whole list of stops set at once, reordered, added to and taken from, by
//   the same rule as an extension; a stop it leaves comes down as Remove's does.
// - Take down (D25): a stop placed on its own, no line calling there, comes down for half its cost.
import { STOP_COST_CENTS } from '../config/economy';
import type { BusModel } from '../config/fleet';
import { DETOUR_WARN_SHARE, INSERT_REACH_M, MIN_LINE_STOPS } from '../config/lines';
import { STOP_TIER_IDS, STOP_TIERS, type StopTier } from '../config/stops';
import type { XY } from '../core/geo';
import { ok, refuse, type Result } from '../core/result';
import { spendableCents } from './credit';
import { checkLineDraft, type LineDraft, type LineDraftContext, type LineRefusal } from './line';
import type { Headways } from './periods';
import { checkStopSite } from './stop';

export type RemoveStopRefusal = 'not_on_line' | 'line_keeps_two';

/** What a stop and its fittings cost: the Sign every stop starts as, and each step up to its tier. */
export function stopCostCents(tier: StopTier): number {
  return STOP_COST_CENTS + STOP_TIER_IDS.filter((t) => t <= tier).reduce((sum, t) => sum + STOP_TIERS[t].upgradeCents, 0);
}

/** Taking `stopId` off a line: whether it may, and what comes back if no other line calls there. */
export function checkRemoveStop(
  line: { readonly stopIds: readonly number[] },
  stop: { readonly id: number; readonly tier: StopTier },
  otherLinesHere: number,
): Result<{ readonly orphaned: boolean; readonly refundCents: number }, RemoveStopRefusal, { limit?: number }> {
  if (!line.stopIds.includes(stop.id)) return refuse('not_on_line');
  if (line.stopIds.length - 1 < MIN_LINE_STOPS) return refuse('line_keeps_two', { limit: MIN_LINE_STOPS });
  const orphaned = otherLinesHere === 0;
  return ok({ orphaned, refundCents: orphaned ? Math.floor(stopCostCents(stop.tier) / 2) : 0 });
}

export type LineEnd = 'start' | 'end';
export type ExtendRefusal = LineRefusal | 'no_new_stops';

/** An extension as far as it resolves: the whole line's draft, priced at what it adds. */
export interface LineExtension {
  /** The whole line, its stops in running order; `newStops`, `stopsCents`, `busesCents` and `priceCents` are the extension's. */
  readonly draft: LineDraft;
  /** Buses the longer cycle needs beyond those the line has. */
  readonly extraBuses: number;
}

export type ExtendVerdict = Result<
  LineExtension,
  ExtendRefusal,
  LineExtension & { readonly at?: number; readonly limitM?: number; readonly limitSeconds?: number; readonly room?: number; readonly shortCents?: number }
>;

/**
 * A line extended from `end` by `clicks` (frame metres), the first click nearest the line. Each
 * stop of the line joins itself, so the line rule sees the whole line; its room check counts the
 * buses beyond the line's own, and the cash check what the extension costs.
 */
export function checkExtend(
  ctx: LineDraftContext,
  line: { readonly stops: readonly XY[]; readonly buses: number; readonly headways: Headways; readonly model: BusModel },
  end: LineEnd,
  clicks: readonly XY[],
): ExtendVerdict {
  const all = end === 'end' ? [...line.stops, ...clicks] : [...[...clicks].reverse(), ...line.stops];
  const whole = checkLineDraft({ ...ctx, busesOwned: ctx.busesOwned - line.buses, cashCents: Number.MAX_SAFE_INTEGER }, all, line.headways, line.model);
  const extraBuses = Math.max(0, whole.draft.buses - line.buses);
  const busesCents = extraBuses * line.model.priceCents;
  const draft: LineDraft = { ...whole.draft, busesCents, priceCents: whole.draft.stopsCents + busesCents };
  const extension = { draft, extraBuses };
  if (!whole.ok) {
    const { at, limitM, limitSeconds, room } = whole;
    return refuse(whole.reason, { ...extension, ...Object.fromEntries(Object.entries({ at, limitM, limitSeconds, room }).filter(([, v]) => v !== undefined)) });
  }
  if (clicks.length === 0) return refuse('no_new_stops', extension);
  if (draft.priceCents > spendableCents(ctx.cashCents)) return refuse('insufficient_funds', { ...extension, shortCents: draft.priceCents - spendableCents(ctx.cashCents) });
  return ok(extension);
}

export type InsertRefusal = LineRefusal | 'no_leg_near';

/** An insertion as far as it resolves: the whole line as an extension reads it, the leg it goes into and the detour it makes. */
export interface LineInsertion extends LineExtension {
  /** The leg between stops[leg] and stops[leg + 1] of the line as it was; -1 with none near. */
  readonly leg: number;
  /** Street metres the stop adds to its leg, and that as a share of the leg; over DETOUR_WARN_SHARE the card warns. */
  readonly detourM: number;
  readonly detourShare: number;
  readonly warn: boolean;
}

export type InsertVerdict = Result<
  LineInsertion,
  InsertRefusal,
  LineInsertion & { readonly at?: number; readonly limitM?: number; readonly limitSeconds?: number; readonly room?: number; readonly shortCents?: number }
>;

/** The distance from `p` to the nearest point of a line of points. */
function distanceToPath(path: readonly XY[], p: XY): number {
  let best = Infinity;
  for (let i = 0; i < path.length; i++) {
    const a = path[i]!;
    const b = path[i + 1] ?? a;
    const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
    const len2 = dx * dx + dy * dy;
    const t = len2 > 0 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2)) : 0;
    best = Math.min(best, Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy)));
  }
  return best;
}

/** A stop inserted at `click` (frame metres) into the leg of the line nearest it. */
export function checkInsert(
  ctx: LineDraftContext,
  line: { readonly stops: readonly XY[]; readonly buses: number; readonly headways: Headways; readonly model: BusModel },
  click: XY,
): InsertVerdict {
  let leg = -1;
  let nearest = Infinity;
  for (let i = 0; i + 1 < line.stops.length; i++) {
    const path = ctx.legPath?.(line.stops[i]!, line.stops[i + 1]!) ?? null;
    const d = path ? distanceToPath(path, click) : Infinity;
    if (d < nearest) [leg, nearest] = [i, d];
  }
  const near = leg >= 0 && nearest <= INSERT_REACH_M;
  const all = near ? [...line.stops.slice(0, leg + 1), click, ...line.stops.slice(leg + 1)] : [...line.stops];
  const whole = checkLineDraft({ ...ctx, busesOwned: ctx.busesOwned - line.buses, cashCents: Number.MAX_SAFE_INTEGER }, all, line.headways, line.model);
  const extraBuses = Math.max(0, whole.draft.buses - line.buses);
  const busesCents = extraBuses * line.model.priceCents;
  const draft: LineDraft = { ...whole.draft, busesCents, priceCents: whole.draft.stopsCents + busesCents };
  // The detour: the leg through the new stop against the leg as it was.
  const stop = near ? whole.draft.stops[leg + 1]?.at : undefined;
  const [a, b] = near ? [line.stops[leg]!, line.stops[leg + 1]!] : [null, null];
  const before = a && b ? (ctx.leg(a, b)?.m ?? 0) : 0;
  const via = a && b && stop ? (ctx.leg(a, stop)?.m ?? 0) + (ctx.leg(stop, b)?.m ?? 0) : before;
  const detourM = Math.max(0, via - before);
  const detourShare = before > 0 ? detourM / before : 0;
  const insertion: LineInsertion = { draft, extraBuses, leg: near ? leg : -1, detourM, detourShare, warn: detourShare > DETOUR_WARN_SHARE };
  if (!near) return refuse('no_leg_near', { ...insertion, limitM: INSERT_REACH_M });
  if (!whole.ok) {
    const { at, limitM, limitSeconds, room } = whole;
    return refuse(whole.reason, { ...insertion, ...Object.fromEntries(Object.entries({ at, limitM, limitSeconds, room }).filter(([, v]) => v !== undefined)) });
  }
  if (draft.priceCents > spendableCents(ctx.cashCents)) return refuse('insufficient_funds', { ...insertion, shortCents: draft.priceCents - spendableCents(ctx.cashCents) });
  return ok(insertion);
}

export type TakeDownRefusal = 'stop_in_use';

/** A stop no line calls at, taken down: half of what it and its fittings cost comes back, as when the last line leaves it. */
export function checkTakeDownStop(stop: { readonly tier: StopTier }, linesHere: number): Result<{ readonly refundCents: number }, TakeDownRefusal, { limit?: number }> {
  if (linesHere > 0) return refuse('stop_in_use', { limit: linesHere });
  return ok({ refundCents: Math.floor(stopCostCents(stop.tier) / 2) });
}

export type RouteRefusal = LineRefusal | 'no_change';

/** A route edit as far as it resolves: the whole line as it would run, what it adds, and the stops it leaves behind. */
export interface RouteEdit extends LineExtension {
  /** The line's stops the edit leaves that no other line calls at: each comes down, half its cost back. */
  readonly removed: readonly { readonly stopId: number; readonly refundCents: number }[];
  readonly refundCents: number;
}

export type RouteVerdict = Result<
  RouteEdit,
  RouteRefusal,
  RouteEdit & { readonly at?: number; readonly limitM?: number; readonly limitSeconds?: number; readonly room?: number; readonly shortCents?: number }
>;

/**
 * A line's whole route set at once (D25: "an expanded menu there you can reorder, add, and remove
 * stops"): `points` (frame metres) in running order, each the place of a stop standing, which joins
 * it, or a click for a new one. The whole line passes the line rule at its model and headways, as
 * an extension does; it buys the new stops and any bus the longer cycle needs, keeps the buses a
 * shorter one leaves spare, and a stop it leaves that no other line calls at comes down, half its
 * cost back, as Remove does. The cash check is on what it costs less what comes back.
 */
export function checkRoute(
  ctx: LineDraftContext,
  line: {
    readonly stopIds: readonly number[];
    readonly buses: number;
    readonly headways: Headways;
    readonly model: BusModel;
  },
  points: readonly XY[],
  stopsHere: (stopId: number) => { readonly tier: StopTier; readonly otherLines: number } | null,
): RouteVerdict {
  const whole = checkLineDraft({ ...ctx, busesOwned: ctx.busesOwned - line.buses, cashCents: Number.MAX_SAFE_INTEGER }, points, line.headways, line.model);
  const extraBuses = Math.max(0, whole.draft.buses - line.buses);
  const busesCents = extraBuses * line.model.priceCents;
  const draft: LineDraft = { ...whole.draft, busesCents, priceCents: whole.draft.stopsCents + busesCents };
  // The draft stops at the first point refused; a stop standing at a point after it is still kept, so only the stops the route leaves out come down.
  const kept = new Set(whole.draft.stops.flatMap((s) => (s.kind === 'join' ? [s.stopId] : [])));
  for (const p of points.slice(whole.draft.stops.length)) {
    const site = checkStopSite(ctx, p);
    if (site.ok && site.kind === 'join') kept.add(site.stopId);
  }
  const removed = line.stopIds.flatMap((stopId) => {
    const here = kept.has(stopId) ? null : stopsHere(stopId);
    return here && here.otherLines === 0 ? [{ stopId, refundCents: Math.floor(stopCostCents(here.tier) / 2) }] : [];
  });
  const refundCents = removed.reduce((s, r) => s + r.refundCents, 0);
  const edit: RouteEdit = { draft, extraBuses, removed, refundCents };
  if (!whole.ok) {
    const { at, limitM, limitSeconds, room } = whole;
    return refuse(whole.reason, { ...edit, ...Object.fromEntries(Object.entries({ at, limitM, limitSeconds, room }).filter(([, v]) => v !== undefined)) });
  }
  const same = whole.draft.stops.length === line.stopIds.length && whole.draft.stops.every((s, k) => s.kind === 'join' && s.stopId === line.stopIds[k]);
  if (same) return refuse('no_change', edit);
  const net = draft.priceCents - refundCents;
  if (net > spendableCents(ctx.cashCents)) return refuse('insufficient_funds', { ...edit, shortCents: net - spendableCents(ctx.cashCents) });
  return ok(edit);
}
