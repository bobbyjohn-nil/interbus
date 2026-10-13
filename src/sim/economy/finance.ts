// Finance (the M3 spec, item 6): every ledger row by kind, for today so far, yesterday and this
// quarter so far, beside a whole day's forecast. Capital rows (founding, purchases, refunds, sales)
// are included, so each column adds up to the change in cash over it; V1 and V2 left fixed costs and
// capital out, so their "profit" overstated. Contract, report-card and credit rows join as those
// systems land. The forecast is the inspector's: the modelled riders' fares and subsidy, each line's
// day plan's costs to the cent, and each depot's upkeep; capital has none.
import { DEPOT_UPKEEP_CENTS } from '../config/depots';
import { toCalendarTime } from '../core/calendar';
import { subsidyCents } from '../rules/fare';
import type { World } from '../world';
import { forecastDay } from './costs';
import { ROW_KINDS, type RowKind } from './ledger';

export interface FinanceRow {
  readonly kind: RowKind;
  readonly todayCents: number;
  readonly yesterdayCents: number;
  readonly quarterCents: number;
  /** A whole day's forecast, or null for a capital row, which no day plans. */
  readonly forecastCents: number | null;
}

export interface Finance {
  readonly day: number;
  readonly quarter: number;
  /** The quarter's first day: its column sums that day to today. */
  readonly quarterFirstDay: number;
  /** One row per kind in ROW_KINDS order, every kind there is. */
  readonly rows: readonly FinanceRow[];
}

const CAPITAL: ReadonlySet<RowKind> = new Set(['founding', 'purchase', 'refund', 'sale']);

export function finance(world: World): Finance {
  const { state } = world;
  const t = toCalendarTime(state.elapsed);
  const quarterFirstDay = t.day - t.dayOfQuarter + 1;
  const sums = new Map<RowKind, { today: number; yesterday: number; quarter: number }>(ROW_KINDS.map((k) => [k, { today: 0, yesterday: 0, quarter: 0 }]));
  // Rows are in day order, so the walk stops at the first row before yesterday and this quarter.
  const from = Math.min(t.day - 1, quarterFirstDay);
  for (let r = state.ledger.rows.length - 1; r >= 0; r--) {
    const row = state.ledger.rows[r]!;
    if (row.day < from) break;
    const sum = sums.get(row.kind)!;
    if (row.day === t.day) sum.today += row.amountCents;
    if (row.day === t.day - 1) sum.yesterday += row.amountCents;
    if (row.day >= quarterFirstDay) sum.quarter += row.amountCents;
  }
  const forecast: Partial<Record<RowKind, number>> = { fares: 0, subsidy: 0, running: 0, wages: 0, deadhead: 0, upkeep: -state.depots.length * DEPOT_UPKEEP_CENTS };
  for (const line of state.lines) {
    const riders = Math.floor(world.assignment.lines.get(line.id)?.perDay ?? 0);
    forecast.fares! += riders * line.fareCents;
    forecast.subsidy! += riders * subsidyCents(line.fareCents);
    const service = world.services.get(line.id);
    if (!service) continue;
    const c = forecastDay(service.costs);
    forecast.running! -= c.running;
    forecast.wages! -= c.wages;
    forecast.deadhead! -= c.deadhead;
  }
  return {
    day: t.day,
    quarter: t.quarter,
    quarterFirstDay,
    rows: ROW_KINDS.map((kind) => {
      const s = sums.get(kind)!;
      return { kind, todayCents: s.today, yesterdayCents: s.yesterday, quarterCents: s.quarter, forecastCents: CAPITAL.has(kind) ? null : (forecast[kind] ?? 0) };
    }),
  };
}
