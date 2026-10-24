// Display copy for numbers (V3's format.ts moved out of the sim, which never formats). Integer
// maths on cents, so -150 cents reads -$1.50, never V3's rounded "-$1".
import { calendarOfDay } from '../sim/rules/calendar';
import { contractMet, HEADWAY_HAIR_S } from '../sim/rules/contract';
import { BRONZE_OVERALL, GOLD_GRADE_MIN, GOLD_OVERALL, GOLD_TRIPS_PER_DAY, SILVER_TRIPS, type MedalId } from '../sim/rules/medal';
import { SPEED_RATES } from '../sim/rules/speed';
import type { RowGroup, RowKind } from '../sim/rules/money';
import type { Period } from '../sim/rules/periods';
import type { Speed } from '../sim/types';

/** "$313,200" for whole-dollar chips; "$1,234.56" with `cents`. */
export function usd(amountCents: number, options: { cents?: boolean } = {}): string {
  const abs = Math.abs(Math.trunc(amountCents));
  // No "-$0": a few cents out reads $0, as a few cents in does.
  const sign = amountCents < 0 && (options.cents ? abs : Math.floor(abs / 100)) > 0 ? '-' : '';
  const dollars = Math.floor(abs / 100).toLocaleString('en-US');
  return options.cents ? `${sign}$${dollars}.${String(abs % 100).padStart(2, '0')}` : `${sign}$${dollars}`;
}

/** "$190k" for a card's prices: whole thousands, or one decimal ("$23.8k") when that is exact; below $1,000, whole dollars. */
export function usdK(amountCents: number): string {
  const dollars = Math.trunc(amountCents / 100);
  if (Math.abs(dollars) < 1_000 || amountCents % 100 !== 0) return usd(amountCents);
  const tenths = dollars / 100;
  if (Number.isInteger(tenths / 10)) return `${dollars < 0 ? '-' : ''}$${Math.abs(dollars / 1_000).toLocaleString('en-US')}k`;
  return Number.isInteger(tenths) ? `${dollars < 0 ? '-' : ''}$${Math.abs(tenths / 10).toFixed(1)}k` : usd(amountCents);
}

/** "3.5 km" from metres, one decimal. */
export function km(metres: number): string {
  return `${(metres / 1_000).toFixed(1)} km`;
}

/** A phrase that starts a line, with its first letter a capital: "Every 20 min" from every()'s "every 20 min" (D25's copy convention). */
export function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "every 20 min" from a headway in seconds, to sit mid-sentence; capitalise() it to start a line. */
export function every(seconds: number): string {
  return `every ${Number.isInteger(seconds / 60) ? seconds / 60 : (seconds / 60).toFixed(1)} min`;
}

/** A contract's ask in words (sim/config/contracts.ts): "every 15 min" for HEADWAY, "400 boardings a day" for RIDERSHIP. */
export function askText(kind: 'headway' | 'ridership', ask: number): string {
  return kind === 'headway' ? every(ask) : `${ask.toLocaleString('en-US')} boardings a day`;
}

/**
 * Today's figure against it, the same way; or why there is none. Rounded toward the verdict its
 * colour shows (contractMet, GD-05), so a figure short of the ask never reads as the ask: RIDERSHIP's
 * boardings down, HEADWAY's seconds up when short (past the rule's hair, a float's noise) and to the
 * nearest when met, asks being whole seconds; to the second within a minute of the ask or where one
 * decimal would read as a whole minute ("every 10 min 1 s", never "every 10 min" or "every 10.0 min").
 */
export function figureText(kind: 'headway' | 'ridership', figure: number | null, ask: number): string {
  if (figure === null) return kind === 'headway' ? 'no bus within a walk' : 'no stop within a walk';
  if (kind === 'ridership') return `${Math.floor(figure).toLocaleString('en-US')} boardings a day`;
  const s = contractMet(kind, figure, ask) ? Math.round(figure) : Math.ceil(figure - HEADWAY_HAIR_S);
  const exact = s % 60 !== 0 && (Math.abs(s - ask) < 60 || Number.isInteger(Number((s / 60).toFixed(1))));
  return exact ? `every ${duration(s, true)}` : every(s);
}

/** "≈9,000": two significant figures, for counts the sim models rather than knows. */
export function about(n: number): string {
  if (n <= 0) return '0';
  const step = 10 ** Math.max(0, Math.floor(Math.log10(n)) - 1);
  return `≈${(Math.round(n / step) * step).toLocaleString('en-US')}`;
}

export function clock(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/**
 * The clock as the top bar shows it at a speed (game seconds a second): the exact minute up to 60x, the
 * ten minutes at 600x and the hour above, so the digits change about once a second or slower and can
 * be read (D25).
 */
export function clockText(hour: number, minute: number, rate: number): string {
  return clock(hour, shownMinute(minute, rate));
}

/** The minute the clock shows at a speed: the exact minute up to 60x, the ten minutes at 600x and the hour above (clockText). */
export function shownMinute(minute: number, rate: number): number {
  if (rate <= 60) return minute;
  return rate <= 600 ? minute - (minute % 10) : 0;
}

/** D7's periods as the clock chip names them (D13: the time of day never rests on the map's tint). */
export const PERIOD_NAMES: Readonly<Record<Period, string>> = { peak: 'Peak', offpeak: 'Off-peak', overnight: 'Overnight' };

/** "Year 1, Q2, Day 4": a game day (from 1, since founding) as the calendar reads it, eight days to a quarter (D25). */
export function dateText(day: number): string {
  const { year, quarter, dayOfQuarter } = calendarOfDay(day);
  return `Year ${year}, Q${quarter}, Day ${dayOfQuarter}`;
}

/** "Year 1, Q2": the quarter a game day falls in. */
export function quarterText(day: number): string {
  const { year, quarter } = calendarOfDay(day);
  return `Year ${year}, Q${quarter}`;
}

/** "600×": a speed as a multiple of real time. */
export function speedText(speed: Exclude<Speed, 0>): string {
  return `${SPEED_RATES[speed].toLocaleString('en-US')}×`;
}

/** What a speed means, for its menu: "Real time", "10 minutes a second". */
export const SPEED_HINTS: Readonly<Record<Exclude<Speed, 0>, string>> = {
  1: 'Real time',
  2: 'A minute a second',
  3: '10 minutes a second',
  4: '45 minutes a second',
  5: 'An hour and a half a second',
};

const SAVED_THIS_YEAR = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const SAVED_ANOTHER_YEAR = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/**
 * When a save was written, by the player's own clock and time zone (the M5 spec, item 4): "saved
 * Oct 13, 20:41", with the year only when it is not this one.
 */
export function savedWhen(ms: number, nowMs: number = Date.now()): string {
  const sameYear = new Date(ms).getFullYear() === new Date(nowMs).getFullYear();
  return `saved ${(sameYear ? SAVED_THIS_YEAR : SAVED_ANOTHER_YEAR).format(ms)}`;
}

/** Ledger rows' names on the day card and in Finance, in plain words (D25: "better labeling with more information about where the money is going"). */
export const ROW_NAMES: Readonly<Record<RowKind, string>> = {
  founding: 'Starting cash',
  fares: 'Fares',
  subsidy: 'City subsidy',
  contract: 'Contract rewards',
  card: 'City grant or fine',
  running: 'Bus fuel and maintenance',
  wages: 'Driver wages',
  deadhead: 'To and from the depot',
  upkeep: 'Depot upkeep',
  stopUpkeep: 'Stop upkeep',
  interest: 'Loan interest',
  buses: 'Buses bought',
  busSales: 'Buses sold',
  stops: 'New stops',
  stopUpgrades: 'Stop upgrades',
  stopSales: 'Stops sold back',
  depots: 'Depots',
};

/** A row's name, by its kind as the worker sends it. */
export function rowName(kind: string): string {
  return (ROW_NAMES as Readonly<Record<string, string | undefined>>)[kind] ?? kind;
}

/** What a ledger row's name leaves out, as its tooltip. */
export const ROW_HINTS: Partial<Readonly<Record<RowKind, string>>> = {
  running: 'Fuel, wear and maintenance for every kilometer a bus drives',
  deadhead: 'Buses driving out of the depot before their first trip and back after their last',
  upkeep: 'Each depot’s upkeep, a day',
  stopUpkeep: 'Each stop’s upkeep, a day: a thousandth of what it cost to build',
  interest: 'The lender’s interest while cash is below zero',
  card: 'The quarter’s report card: the city pays a grant or charges a fine',
};

/** The groups Finance lists rows under, in order (sim/rules/money.ts). */
export const GROUP_NAMES: Readonly<Record<Exclude<RowGroup, 'opening'>, string>> = {
  income: 'Money in',
  reward: 'Rewards',
  running: 'Running costs',
  capital: 'Buying and building',
};

/** "2 Sparrows", "1 Metro 40": a count of buses of one model. */
export function busCount(n: number, model: string): string {
  return `${n} ${n === 1 ? model : `${model}s`}`;
}

/** "2 more Sparrows", "1 more Metro 40": buses of one model on top of those a line has. */
export function moreBuses(n: number, model: string): string {
  return `${n} more ${n === 1 ? model : `${model}s`}`;
}

/**
 * A street's name as the game's sentences give it, after D25's copy convention: OpenStreetMap's, as the bake keeps it, with a
 * curly apostrophe for its straight one (Monsignor O’Brien Highway), a state or US route's number as Massachusetts names it (MA
 * 2A is Route 2A, US 1 is Route 1) and an interstate's with its hyphen (I-93; DECISIONS, Measured, 2026-10-23). Inner Boston's
 * 3,535 names held 25 that broke the convention (the systems audit's twelfth round), and 7 edges named I 93.
 */
export function streetName(name: string): string {
  const route = /^(?:US|MA) (\d+[A-Z]?)$/.exec(name);
  if (route) return `Route ${route[1]}`;
  const interstate = /^I (\d+)$/.exec(name);
  return interstate ? `I-${interstate[1]}` : name.replace(/'/g, '’');
}

/** "Q2 Day 4": a game day as the clock chip names it, the year left to the title. */
export function dayText(day: number): string {
  const { quarter, dayOfQuarter } = calendarOfDay(day);
  return `Q${quarter} Day ${dayOfQuarter}`;
}

/**
 * A city event's notice on the day card (the M4 spec, item 2): rolled at the close, from the day it starts, or over. Rolled at a
 * close it starts the day after the next, and "tomorrow" on the closed day's card read as the next day: the works were still to
 * come all that day (the systems audit's seventeenth round). So it names its day, as the map's marker reads "tomorrow" the day
 * before.
 */
export function eventNewsText(e: { readonly kind: 'roadworks' | 'festival' | 'snow'; readonly street: string; readonly startDay: number; readonly days: number; readonly news: 'tomorrow' | 'over' }): string {
  const when = `from ${dayText(e.startDay)}, for ${e.days} ${e.days === 1 ? 'day' : 'days'}`;
  const street = streetName(e.street);
  if (e.kind === 'festival') {
    const near = street ? ` near ${street}` : '';
    return e.news === 'tomorrow' ? `A festival${near} ${when}: more riders to and from there` : `The festival${near} is over`;
  }
  if (e.kind === 'snow') return e.news === 'tomorrow' ? `Snow ${when}: every bus drives slower` : 'The snow is over';
  return e.news === 'tomorrow' ? `Roadworks on ${street} ${when}` : `Roadworks on ${street} are over`;
}

export const MEDAL_NAMES: Readonly<Record<MedalId, string>> = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold' };

/** What earns a medal (the M4 spec, item 3), read from the bars the close uses. */
export function medalBarText(m: MedalId): string {
  if (m === 'bronze') return `a quarter graded ${BRONZE_OVERALL} or better`;
  if (m === 'silver') return `${SILVER_TRIPS.toLocaleString('en-US')} trips carried`;
  return `a quarter graded ${GOLD_OVERALL} or better, no grade under ${GOLD_GRADE_MIN}, on a day of ${GOLD_TRIPS_PER_DAY.toLocaleString('en-US')} trips`;
}

/** A medal's notice on the day card: what earned it, and what silver unlocks. */
export function medalNewsText(m: MedalId): string {
  return `${MEDAL_NAMES[m]} medal: ${medalBarText(m)}${m === 'silver' ? ' · the Goliath is for sale' : ''}`;
}

/** A round trip on the line card: whole minutes, or minutes and seconds where a few seconds matter. */
export function duration(seconds: number, exact = false): string {
  const s = Math.round(seconds);
  if (!exact) return `${Math.round(s / 60)} min`;
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`;
}
