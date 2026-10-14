// Display copy for numbers (V3's format.ts moved out of the sim, which never formats). Integer
// maths on cents, so -150 cents reads -$1.50, never V3's rounded "-$1".
import { calendarOfDay } from '../sim/rules/calendar';
import { BRONZE_OVERALL, GOLD_GRADE_MIN, GOLD_OVERALL, GOLD_TRIPS_PER_DAY, SILVER_TRIPS, type MedalId } from '../sim/rules/medal';
import { SPEED_RATES } from '../sim/rules/speed';
import type { Speed } from '../sim/types';

/** "$313,200" for whole-dollar chips; "$1,234.56" with `cents`. */
export function usd(amountCents: number, options: { cents?: boolean } = {}): string {
  const sign = amountCents < 0 ? '-' : '';
  const abs = Math.abs(Math.trunc(amountCents));
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

/** "every 20 min" from a headway in seconds. */
export function every(seconds: number): string {
  return `every ${Number.isInteger(seconds / 60) ? seconds / 60 : (seconds / 60).toFixed(1)} min`;
}

/** A contract's ask in words (sim/config/contracts.ts): "every 15 min" for HEADWAY, "400 boardings a day" for RIDERSHIP. */
export function askText(kind: 'headway' | 'ridership', ask: number): string {
  return kind === 'headway' ? every(ask) : `${ask.toLocaleString('en-US')} boardings a day`;
}

/** Today's figure against it, the same way; or why there is none. */
export function figureText(kind: 'headway' | 'ridership', figure: number | null): string {
  if (figure === null) return kind === 'headway' ? 'no bus within a walk' : 'no stop within a walk';
  return kind === 'headway' ? every(Math.round(figure)) : `${Math.floor(figure).toLocaleString('en-US')} boardings a day`;
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
  if (rate <= 60) return clock(hour, minute);
  return clock(hour, rate <= 600 ? minute - (minute % 10) : 0);
}

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
  4: 'Half an hour a second',
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

/** The day card's names for ledger rows. */
export const ROW_NAMES: Readonly<Record<string, string>> = {
  founding: 'Founding capital',
  fares: 'Fares',
  subsidy: 'City subsidy',
  purchase: 'Purchases',
  refund: 'Refunds',
  sale: 'Sales',
  running: 'Running (per km)',
  wages: 'Driver wages',
  deadhead: 'Deadhead',
  upkeep: 'Depot upkeep',
  interest: 'Interest',
  contract: 'Contracts',
  card: 'Report card',
};

/** "2 Sparrows", "1 Metro 40": a count of buses of one model. */
export function busCount(n: number, model: string): string {
  return `${n} ${n === 1 ? model : `${model}s`}`;
}

/** A city event's notice on the day card (the M4 spec, item 2): rolled for tomorrow, or over. */
export function eventNewsText(e: { readonly kind: 'roadworks' | 'festival' | 'snow'; readonly street: string; readonly days: number; readonly news: 'tomorrow' | 'over' }): string {
  const forDays = `for ${e.days} ${e.days === 1 ? 'day' : 'days'}`;
  if (e.kind === 'festival') {
    const near = e.street ? ` near ${e.street}` : '';
    return e.news === 'tomorrow' ? `A festival${near} tomorrow, ${forDays}: more riders to and from there` : `The festival${near} is over`;
  }
  if (e.kind === 'snow') return e.news === 'tomorrow' ? `Snow tomorrow, ${forDays}: every bus drives slower` : 'The snow is over';
  return e.news === 'tomorrow' ? `Roadworks on ${e.street} tomorrow, ${forDays}` : `Roadworks on ${e.street} are over`;
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
  return `${MEDAL_NAMES[m]} medal: ${medalBarText(m)}${m === 'silver' ? '. The Goliath is for sale' : ''}`;
}

/** A round trip on the line card: whole minutes, or minutes and seconds where a few seconds matter. */
export function duration(seconds: number, exact = false): string {
  const s = Math.round(seconds);
  if (!exact) return `${Math.round(s / 60)} min`;
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`;
}
