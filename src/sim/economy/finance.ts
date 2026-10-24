// Finance (the M3 spec, item 6; D25): every ledger row by kind, for today so far, yesterday and this
// quarter so far, beside a day's forecast. Capital rows (buses, stops and depots bought and sold)
// are included, so each column adds up to the change in cash over it; V1 and V2 left fixed costs and
// capital out, so their "profit" overstated. The starting cash sits on Day 0, before every column.
// The forecast is the inspector's: the modelled paid riders' fares and subsidy, each line's day plan's
// costs to the cent, each depot's and stop's upkeep, and a day's interest while cash is below zero;
// capital, contracts and the report card have none (sim/rules/money.ts). A line's costs are today's as
// the day banks them, so on the day it is drawn they count from its first drive out, and its fares and
// subsidy from the hour it was drawn: the whole of that clock hour, as step.ts banks riders by the hour.
import { DEPOT_UPKEEP_CENTS } from '../config/depots';
import { DAYS_PER_QUARTER } from '../config/time';
import { toCalendarTime } from '../core/calendar';
import { interestCents } from '../rules/credit';
import { subsidyCents } from '../rules/fare';
import { isOperating, ROW_GROUP } from '../rules/money';
import type { Line } from '../state';
import { drawnAt, type World } from '../world';
import { forecastDay, stopsUpkeepCents, type LineCosts } from './costs';
import { ROW_KINDS, type RowKind } from './ledger';

export interface FinanceRow {
  readonly kind: RowKind;
  readonly todayCents: number;
  readonly yesterdayCents: number;
  readonly quarterCents: number;
  /** A day's forecast (a line drawn today from the hour it was drawn), or null for a row no day plans: capital, a contract's reward, the report card, the opening. */
  readonly forecastCents: number | null;
}

/** One day on Finance's chart: what came in, what running cost, what was bought or sold, and the cash at its close (today's so far). */
export interface FinanceDay {
  readonly day: number;
  /** Fares, subsidy, contract rewards and a grant: money in, positive. */
  readonly inCents: number;
  /** Running costs, and a fine: money out, negative. */
  readonly outCents: number;
  /** Buying and building, less what was sold back: usually negative. */
  readonly capitalCents: number;
  readonly cashCents: number;
}

/** One line's own money: yesterday's (rows that name it), what its riders paid and what running it cost, and its income and costs in the day's forecast. */
export interface FinanceLine {
  readonly id: number;
  readonly yesterdayInCents: number;
  readonly yesterdayOutCents: number;
  /** Its riders' fares and subsidy: its share of the forecast column's fares and subsidy rows, on the day it was drawn from the hour it was drawn (paidRidersOn). */
  readonly incomeCents: number;
  /** A day's costs (on the day it was drawn, from its first drive out), positive: its share of the forecast column's running, wages and deadhead rows, worked out with them. */
  readonly forecastCents: LineCosts;
}

/** The chart shows the last two quarters' days at most: the ledger keeps them in full and folds older days (ledger.ts DAYS_KEPT, which ledger.test.ts holds no shorter than this). */
export const CHART_DAYS = 2 * DAYS_PER_QUARTER;

export interface Finance {
  readonly day: number;
  readonly quarter: number;
  /** The quarter's first day: its column sums that day to today. */
  readonly quarterFirstDay: number;
  /** The starting cash, posted on Day 0 before any column's days. */
  readonly openingCents: number;
  /** The chart's days, oldest first: up to CHART_DAYS, today the last, so far. */
  readonly days: readonly FinanceDay[];
  /** Each line's own money, in the order the lines were made. */
  readonly lines: readonly FinanceLine[];
  /** One row per kind in ROW_KINDS order, every kind there is. */
  readonly rows: readonly FinanceRow[];
}

/** A day's running costs as the forecast column has them (a line drawn today from its first drive out), interest included: the Costs/day chip, so the two never disagree. */
export function runningCostsCents(f: Pick<Finance, 'rows'>): number {
  return -f.rows.reduce((sum, r) => sum + (ROW_GROUP[r.kind] === 'running' ? (r.forecastCents ?? 0) : 0), 0);
}

/**
 * A line's modelled paid riders on game day `day`, whole, as its hours bank them (step.ts): a whole
 * day's, but on the day it was drawn only from the hour it was drawn, the whole of that clock hour,
 * since bankHour banks an hour's riders at its end; its costs that day count from its first drive out
 * (it keeps the version before the draw, which ran no bus, until the day's close: world.ts).
 */
function paidRidersOn(world: Pick<World, 'assignment'>, line: Pick<Line, 'id' | 'earlier'>, day: number): number {
  const demand = world.assignment.lines.get(line.id);
  if (!demand) return 0;
  const drawn = drawnAt(line);
  const at = drawn === null ? null : toCalendarTime(drawn);
  if (!at || at.day !== day) return Math.floor(demand.paidPerDay);
  return Math.floor(demand.paidBySlot.subarray(2 * at.hour).reduce((sum, paid) => sum + paid, 0));
}

export function finance(world: World): Finance {
  const { state } = world;
  const t = toCalendarTime(state.elapsed);
  const quarterFirstDay = t.day - t.dayOfQuarter + 1;
  const sums = new Map<RowKind, { today: number; yesterday: number; quarter: number }>(ROW_KINDS.map((k) => [k, { today: 0, yesterday: 0, quarter: 0 }]));
  const firstChartDay = Math.max(1, t.day - CHART_DAYS + 1);
  const days = new Map<number, { in: number; out: number; capital: number }>();
  for (let d = firstChartDay; d <= t.day; d++) days.set(d, { in: 0, out: 0, capital: 0 });
  const lineSums = new Map<number, { in: number; out: number }>(state.lines.map((l) => [l.id, { in: 0, out: 0 }]));
  // Rows are in day order, so the walk stops at the first row before yesterday, this quarter and the chart.
  const from = Math.min(t.day - 1, quarterFirstDay, firstChartDay);
  for (let r = state.ledger.rows.length - 1; r >= 0; r--) {
    const row = state.ledger.rows[r]!;
    if (row.day < from) break;
    const sum = sums.get(row.kind)!;
    if (row.day === t.day) sum.today += row.amountCents;
    if (row.day === t.day - 1) sum.yesterday += row.amountCents;
    if (row.day >= quarterFirstDay) sum.quarter += row.amountCents;
    const group = ROW_GROUP[row.kind];
    const day = days.get(row.day);
    if (day) {
      if (group === 'capital') day.capital += row.amountCents;
      else if (group === 'income' || (group === 'reward' && row.amountCents > 0)) day.in += row.amountCents;
      else if (group === 'running' || group === 'reward') day.out += row.amountCents;
    }
    const line = row.day === t.day - 1 && row.lineId !== undefined ? lineSums.get(row.lineId) : undefined;
    if (line) {
      if (group === 'income') line.in += row.amountCents;
      else if (group === 'running') line.out += row.amountCents;
    }
  }
  // Each day's closing cash, back from today's: a day's rows are its change in cash (I1).
  const chart: FinanceDay[] = [];
  let cash = state.ledger.cashCents;
  for (let d = t.day; d >= firstChartDay; d--) {
    const day = days.get(d)!;
    chart.unshift({ day: d, inCents: day.in, outCents: day.out, capitalCents: day.capital, cashCents: cash });
    cash -= day.in + day.out + day.capital;
  }
  const interest = interestCents(state.ledger.cashCents);
  const forecast: Partial<Record<RowKind, number>> = {
    fares: 0,
    subsidy: 0,
    running: 0,
    wages: 0,
    deadhead: 0,
    upkeep: -state.depots.length * DEPOT_UPKEEP_CENTS,
    stopUpkeep: -stopsUpkeepCents(state.stops),
    // As the close charges it (step.ts), on what is owed now.
    interest: interest > 0 ? -interest : 0,
  };
  const lineCosts = new Map<number, LineCosts>();
  const lineIncome = new Map<number, number>();
  for (const line of state.lines) {
    const riders = paidRidersOn(world, line, t.day);
    const [fares, subsidy] = [riders * line.fareCents, riders * subsidyCents(line.fareCents)];
    forecast.fares! += fares;
    forecast.subsidy! += subsidy;
    lineIncome.set(line.id, fares + subsidy);
    const service = world.services.get(line.id);
    if (!service) continue;
    // Today's, so a line settling after a change bills each leg at the version it runs on, as the day will bank it.
    const c = forecastDay(service.costs, 0, t.day);
    lineCosts.set(line.id, c);
    forecast.running! -= c.running;
    forecast.wages! -= c.wages;
    forecast.deadhead! -= c.deadhead;
  }
  return {
    day: t.day,
    quarter: t.quarter,
    quarterFirstDay,
    openingCents: state.ledger.rows.find((r) => r.kind === 'founding')?.amountCents ?? 0,
    days: chart,
    lines: state.lines.map((l) => {
      const s = lineSums.get(l.id)!;
      return { id: l.id, yesterdayInCents: s.in, yesterdayOutCents: s.out, incomeCents: lineIncome.get(l.id)!, forecastCents: lineCosts.get(l.id) ?? { running: 0, wages: 0, deadhead: 0 } };
    }),
    rows: ROW_KINDS.map((kind) => {
      const s = sums.get(kind)!;
      return { kind, todayCents: s.today, yesterdayCents: s.yesterday, quarterCents: s.quarter, forecastCents: isOperating(kind) ? (forecast[kind] ?? 0) : null };
    }),
  };
}
