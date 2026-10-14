// simStep(): the only door that advances time (PLAN §6, AR-09). Each call moves the clock one fixed
// step; advance() moves it over the steps that do nothing else at once. At every game-hour boundary each line banks the hour's paid boardings (a change onto it pays
// nothing: the trip paid its first line, EC-04) as ledger rows, fares and
// the city's subsidy at that fare (rules/fare.ts), in whole boardings and whole cents, and the hour's costs (running, wages,
// deadhead; economy/costs.ts), and each depot its upkeep; at 24:00 the day closes, its rows merge
// by kind and line, and they are the day card (I1). A quarter's last day closes with its report card
// (economy/reportCard.ts), whose payout or fine is one of that day's rows. A day that closes owing
// pays the lender's interest, and a close below the credit floor counts toward the end (D10). Held
// contracts are checked at each service hour's end and graded at the close, which then rolls the
// next day's offers (economy/contracts.ts) and may roll an event for the day after (events/roll.ts);
// a close where an event starts or ends times every line's round trip and assigns the riders again. Each close awards the
// medals its card and the trips carried earn (rules/medal.ts), once each, and starts the day's count again.
import { SECONDS_PER_DAY, SECONDS_PER_HOUR, START_SECOND_OF_DAY, STEP_SECONDS } from './config/time';
import { toCalendarTime } from './core/calendar';
import { DEPOT_UPKEEP_PER_HOUR_CENTS, lineCostsInHour } from './economy/costs';
import { checkHour, closeContracts, rollOffers, type ContractOutcome } from './economy/contracts';
import { closeDay, post, rowsOfDay, type LedgerRow } from './economy/ledger';
import { gradeQuarter, type ReportCard } from './economy/reportCard';
import { rollEvent } from './events/roll';
import { DAYS_PER_QUARTER } from './config/time';
import { INTEREST_PER_DAY_PPM } from './config/economy';
import { belowFloor } from './rules/credit';
import { medalsEarned } from './rules/medal';
import type { MedalId } from './config/medals';
import { subsidyCents } from './rules/fare';
import type { CityEvent } from './state';
import { recomputeInService, settle, type World } from './world';

export type SimEvent = {
  readonly kind: 'day-closed';
  readonly day: number;
  readonly rows: readonly LedgerRow[];
  readonly cashBeforeCents: number;
  readonly cashAfterCents: number;
  /** The quarter's report card, on its last day's close; null on other days. */
  readonly card: ReportCard | null;
  /** Contracts paid or lapsed at this close. */
  readonly contracts: readonly ContractOutcome[];
  /** The event rolled at this close, which starts the day after the one just begun, and the event whose last day was the day just closed. */
  readonly rolled: CityEvent | null;
  readonly ended: CityEvent | null;
  /** An event started or ended at this close, so every line's round trip was timed and its riders assigned again, or a line settled onto its own day plan. */
  readonly retimed: boolean;
  /** Medals awarded at this close, bronze first (rules/medal.ts). */
  readonly medals: readonly MedalId[];
  /** The trips carried on the day just closed. */
  readonly trips: number;
};

/** Posts the hour that just ended: its paid boardings as fare and subsidy rows, its costs, each depot's upkeep. */
function bankHour(world: World, hour: number, day: number): void {
  for (const line of world.state.lines) {
    const demand = world.assignment.lines.get(line.id);
    if (!demand) continue;
    const milli = Math.round((demand.paidBySlot[2 * hour]! + demand.paidBySlot[2 * hour + 1]!) * 1000);
    const before = line.boardedMilli;
    line.boardedMilli += milli;
    const boardings = Math.floor(line.boardedMilli / 1000) - Math.floor(before / 1000);
    if (boardings <= 0) continue;
    world.state.tripsCarried += boardings;
    world.state.tripsToday += boardings;
    post(world.state.ledger, { day, kind: 'fares', amountCents: boardings * line.fareCents, lineId: line.id });
    post(world.state.ledger, { day, kind: 'subsidy', amountCents: boardings * subsidyCents(line.fareCents), lineId: line.id });
  }
  for (const [lineId, service] of world.services) {
    const costs = lineCostsInHour(service.costs, hour, day);
    for (const kind of ['running', 'wages', 'deadhead'] as const) {
      if (costs[kind] > 0) post(world.state.ledger, { day, kind, amountCents: -costs[kind], lineId });
    }
  }
  if (world.state.depots.length > 0) post(world.state.ledger, { day, kind: 'upkeep', amountCents: -world.state.depots.length * DEPOT_UPKEEP_PER_HOUR_CENTS });
}

/** What a step between hour boundaries returns: nothing, without a new array each second. */
const QUIET: readonly SimEvent[] = Object.freeze([]);

export function simStep(world: World): readonly SimEvent[] {
  const state = world.state;
  state.elapsed += STEP_SECONDS;
  const sinceMidnightOfDay1 = START_SECOND_OF_DAY + state.elapsed;
  if (sinceMidnightOfDay1 % SECONDS_PER_HOUR !== 0) return QUIET;
  // The hour that just ended, and the day it belongs to.
  const ended = toCalendarTime(state.elapsed - 1);
  bankHour(world, ended.hour, ended.day);
  checkHour(world, ended.hour);
  if (sinceMidnightOfDay1 % SECONDS_PER_DAY !== 0) return QUIET;
  const card = ended.dayOfQuarter === DAYS_PER_QUARTER ? gradeQuarter(world, ended.quarter, ended.day) : null;
  if (card && card.payoutCents !== 0) post(state.ledger, { day: ended.day, kind: 'card', amountCents: card.payoutCents });
  const contracts = closeContracts(world, ended.day);
  const trips = state.tripsToday;
  const medals = medalsEarned(state.medals, { card, tripsCarried: state.tripsCarried, tripsToday: trips });
  for (const m of medals) state.medals = { ...state.medals, [m]: ended.day };
  state.tripsToday = 0;
  if (state.ledger.cashCents < 0) {
    const interest = Math.round((-state.ledger.cashCents * INTEREST_PER_DAY_PPM) / 1_000_000);
    if (interest > 0) post(state.ledger, { day: ended.day, kind: 'interest', amountCents: -interest });
  }
  state.closesBelowFloor = belowFloor(state.ledger.cashCents) ? state.closesBelowFloor + 1 : 0;
  closeDay(state.ledger, ended.day);
  const rows = rowsOfDay(state.ledger, ended.day);
  const cashAfterCents = state.ledger.cashCents;
  rollOffers(world, ended.day + 1);
  const last = state.event;
  const endedEvent = last && last.endDay === ended.day ? last : null;
  const retimed = last !== null && (last.startDay === ended.day + 1 || endedEvent !== null);
  const rolled = rollEvent(world, ended.day + 1);
  // Lines settled onto their own day plans let go of their earlier versions; an event starting or
  // ending (roadworks or snow slow the buses, a festival draws riders) times every line and assigns the
  // riders again, a trip under way finishing as it began (the M4 spec, item 4).
  const settled = settle(world);
  if (retimed) recomputeInService(world);
  return [{ kind: 'day-closed', day: ended.day, rows, cashBeforeCents: cashAfterCents - rows.reduce((s, r) => s + r.amountCents, 0), cashAfterCents, card, contracts, rolled, ended: endedEvent, retimed: retimed || settled, medals, trips }];
}

/**
 * Whole steps covering `seconds` (a multiple of the step), with what they return. A step short of an
 * hour boundary only moves the clock, so the clock moves over those at once and simStep runs the step
 * that reaches each boundary: the same world as stepping one by one (step.test.ts), without 86,400
 * calls a day since the step became one second (D25; 400 test days took 3.3 s instead of 0.7 s).
 */
export function advance(world: World, seconds: number): SimEvent[] {
  if (!Number.isSafeInteger(seconds) || seconds < 0 || seconds % STEP_SECONDS !== 0) throw new RangeError(`advance by whole steps of ${STEP_SECONDS} s, got ${seconds}`);
  const events: SimEvent[] = [];
  for (let left = seconds; left > 0; left -= STEP_SECONDS) {
    const toHour = SECONDS_PER_HOUR - ((START_SECOND_OF_DAY + world.state.elapsed) % SECONDS_PER_HOUR);
    const quiet = Math.min(left, toHour) - STEP_SECONDS;
    world.state.elapsed += quiet;
    left -= quiet;
    events.push(...simStep(world));
  }
  return events;
}
