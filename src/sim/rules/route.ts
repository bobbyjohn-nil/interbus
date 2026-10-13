// Route edits (the M3 spec, item 14): one predicate each for the card and the command (GD-05).
// - Remove: a line gives up a stop and keeps at least MIN_LINE_STOPS; the streets that joined its
//   neighbours through it still join them, so no route is lost. A stop no other line calls at goes
//   with it and gives back half of what it and its fittings cost, as a Refunds row: no stop stands
//   without a line, as V2's orphans did.
// - Extend: clicks beyond either end become new stops or join standing ones, and the whole line
//   must pass the line rule at its model and headways. It buys the new stops and the buses its
//   longer cycle needs beyond those it has.
// Insert waits for M4.
import { STOP_COST_CENTS } from '../config/economy';
import type { BusModel } from '../config/fleet';
import { MIN_LINE_STOPS } from '../config/lines';
import { STOP_TIER_IDS, STOP_TIERS, type StopTier } from '../config/stops';
import type { XY } from '../core/geo';
import { ok, refuse, type Result } from '../core/result';
import { spendableCents } from './credit';
import { checkLineDraft, type LineDraft, type LineDraftContext, type LineRefusal } from './line';
import type { Headways } from './periods';

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
