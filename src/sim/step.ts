// simStep(): the only door that advances time (PLAN §6, AR-09). Each call moves the clock one fixed
// step. At every game-hour boundary each line banks the hour's boardings as ledger rows, fares and
// the city's subsidy at that fare (rules/fare.ts), in whole boardings and whole cents, and the hour's costs (running, wages,
// deadhead; economy/costs.ts), and each depot its upkeep; at 24:00 the day closes, its rows merge
// by kind and line, and they are the day card (I1). A quarter's last day closes with its report card
// (economy/reportCard.ts), whose payout or fine is one of that day's rows. A day that closes owing
// pays the lender's interest, and a close below the credit floor counts toward the end (D10).
import { SECONDS_PER_DAY, SECONDS_PER_HOUR, START_SECOND_OF_DAY, STEP_SECONDS } from './config/time';
import { toCalendarTime } from './core/calendar';
import { DEPOT_UPKEEP_PER_HOUR_CENTS, lineCostsInHour } from './economy/costs';
import { closeDay, post, rowsOfDay, type LedgerRow } from './economy/ledger';
import { gradeQuarter, type ReportCard } from './economy/reportCard';
import { DAYS_PER_QUARTER } from './config/time';
import { INTEREST_PER_DAY_PPM } from './config/economy';
import { belowFloor } from './rules/credit';
import { subsidyCents } from './rules/fare';
import type { World } from './world';

export type SimEvent = {
  readonly kind: 'day-closed';
  readonly day: number;
  readonly rows: readonly LedgerRow[];
  readonly cashBeforeCents: number;
  readonly cashAfterCents: number;
  /** The quarter's report card, on its last day's close; null on other days. */
  readonly card: ReportCard | null;
};

/** Posts the hour that just ended: its boardings as fare and subsidy rows, its costs, each depot's upkeep. */
function bankHour(world: World, hour: number, day: number): void {
  for (const line of world.state.lines) {
    const demand = world.assignment.lines.get(line.id);
    if (!demand) continue;
    const milli = Math.round((demand.bySlot[2 * hour]! + demand.bySlot[2 * hour + 1]!) * 1000);
    const before = line.boardedMilli;
    line.boardedMilli += milli;
    const boardings = Math.floor(line.boardedMilli / 1000) - Math.floor(before / 1000);
    if (boardings <= 0) continue;
    post(world.state.ledger, { day, kind: 'fares', amountCents: boardings * line.fareCents, lineId: line.id });
    post(world.state.ledger, { day, kind: 'subsidy', amountCents: boardings * subsidyCents(line.fareCents), lineId: line.id });
  }
  for (const [lineId, service] of world.services) {
    const costs = lineCostsInHour(service.costs, hour);
    for (const kind of ['running', 'wages', 'deadhead'] as const) {
      if (costs[kind] > 0) post(world.state.ledger, { day, kind, amountCents: -costs[kind], lineId });
    }
  }
  if (world.state.depots.length > 0) post(world.state.ledger, { day, kind: 'upkeep', amountCents: -world.state.depots.length * DEPOT_UPKEEP_PER_HOUR_CENTS });
}

export function simStep(world: World): SimEvent[] {
  const state = world.state;
  state.elapsed += STEP_SECONDS;
  const sinceMidnightOfDay1 = START_SECOND_OF_DAY + state.elapsed;
  if (sinceMidnightOfDay1 % SECONDS_PER_HOUR !== 0) return [];
  // The hour that just ended, and the day it belongs to.
  const ended = toCalendarTime(state.elapsed - 1);
  bankHour(world, ended.hour, ended.day);
  if (sinceMidnightOfDay1 % SECONDS_PER_DAY !== 0) return [];
  const card = ended.dayOfQuarter === DAYS_PER_QUARTER ? gradeQuarter(world, ended.quarter, ended.day) : null;
  if (card && card.payoutCents !== 0) post(state.ledger, { day: ended.day, kind: 'card', amountCents: card.payoutCents });
  if (state.ledger.cashCents < 0) {
    const interest = Math.round((-state.ledger.cashCents * INTEREST_PER_DAY_PPM) / 1_000_000);
    if (interest > 0) post(state.ledger, { day: ended.day, kind: 'interest', amountCents: -interest });
  }
  state.closesBelowFloor = belowFloor(state.ledger.cashCents) ? state.closesBelowFloor + 1 : 0;
  closeDay(state.ledger, ended.day);
  const rows = rowsOfDay(state.ledger, ended.day);
  const cashAfterCents = state.ledger.cashCents;
  return [{ kind: 'day-closed', day: ended.day, rows, cashBeforeCents: cashAfterCents - rows.reduce((s, r) => s + r.amountCents, 0), cashAfterCents, card }];
}

/** Whole steps covering `seconds` (a multiple of the step). */
export function advance(world: World, seconds: number): SimEvent[] {
  if (!Number.isSafeInteger(seconds) || seconds < 0 || seconds % STEP_SECONDS !== 0) throw new RangeError(`advance by whole steps of ${STEP_SECONDS} s, got ${seconds}`);
  const events: SimEvent[] = [];
  for (let s = 0; s < seconds; s += STEP_SECONDS) events.push(...simStep(world));
  return events;
}
