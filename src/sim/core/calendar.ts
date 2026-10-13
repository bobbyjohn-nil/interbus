// Ported from V3 (`Intralines_City@dc63602:src/game/clock/calendar.ts`, S05): pure conversion
// between the clock's one number and the calendar, which is derived and never stored. Changed on
// the way in: the clock counts whole game-seconds since founding instead of fractional minutes, and
// founding is 05:00 (D7) instead of 06:00. Formatting is display copy and lives in src/ui.
import {
  DAYS_PER_QUARTER,
  QUARTERS_PER_YEAR,
  SECONDS_PER_DAY,
  SECONDS_PER_HOUR,
  SECONDS_PER_MINUTE,
  START_SECOND_OF_DAY,
} from '../config/time';

const DAYS_PER_YEAR = DAYS_PER_QUARTER * QUARTERS_PER_YEAR;

export interface CalendarTime {
  readonly year: number;
  readonly quarter: number;
  readonly dayOfQuarter: number;
  /** Game days since founding, from 1: the founding day is day 1. */
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
  readonly secondOfDay: number;
}

function assertClock(elapsed: number): void {
  if (!Number.isSafeInteger(elapsed) || elapsed < 0) throw new RangeError(`clock must be whole seconds ≥ 0, got ${elapsed}`);
}

/** `elapsed` is whole game-seconds since founding, which happened at 05:00 on day 1. */
export function toCalendarTime(elapsed: number): CalendarTime {
  assertClock(elapsed);
  const sinceMidnightOfDay1 = START_SECOND_OF_DAY + elapsed;
  const dayIndex = Math.floor(sinceMidnightOfDay1 / SECONDS_PER_DAY);
  const secondOfDay = sinceMidnightOfDay1 - dayIndex * SECONDS_PER_DAY;
  const yearIndex = Math.floor(dayIndex / DAYS_PER_YEAR);
  const dayInYear = dayIndex - yearIndex * DAYS_PER_YEAR;
  const quarterIndex = Math.floor(dayInYear / DAYS_PER_QUARTER);
  const hour = Math.floor(secondOfDay / SECONDS_PER_HOUR);
  const minute = Math.floor((secondOfDay - hour * SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  return {
    year: yearIndex + 1,
    quarter: quarterIndex + 1,
    dayOfQuarter: dayInYear - quarterIndex * DAYS_PER_QUARTER + 1,
    day: dayIndex + 1,
    hour,
    minute,
    second: secondOfDay - hour * SECONDS_PER_HOUR - minute * SECONDS_PER_MINUTE,
    secondOfDay,
  };
}

/** The inverse of `toCalendarTime`; lossless (calendar.test.ts). */
export function toElapsed(calendar: Pick<CalendarTime, 'day' | 'secondOfDay'>): number {
  return (calendar.day - 1) * SECONDS_PER_DAY + calendar.secondOfDay - START_SECOND_OF_DAY;
}

/** Whole game-seconds from founding to the start (00:00) of `day`; day 1's start is before founding. */
export function dayStart(day: number): number {
  return (day - 1) * SECONDS_PER_DAY - START_SECOND_OF_DAY;
}
