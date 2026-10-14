// V3's calendar cases (`Intralines_City@dc63602:src/game/clock/calendar.test.ts`), moved to the
// 05:00 founding (D7) and whole seconds.
import { describe, expect, it } from 'vitest';
import { DAYS_PER_QUARTER, QUARTERS_PER_YEAR, SECONDS_PER_DAY, START_SECOND_OF_DAY } from '../config/time';
import { calendarOfDay, dayStart, toCalendarTime, toElapsed } from './calendar';

describe('calendar', () => {
  it('founding is Year 1, Quarter 1, Day 1 at 05:00 (D7)', () => {
    expect(toCalendarTime(0)).toEqual({
      year: 1,
      quarter: 1,
      dayOfQuarter: 1,
      day: 1,
      hour: 5,
      minute: 0,
      second: 0,
      secondOfDay: 5 * 3600,
    });
  });

  it('rolls day 1 over at midnight, 19 hours after founding', () => {
    const lastSecond = 19 * 3600 - 1;
    expect(toCalendarTime(lastSecond)).toMatchObject({ day: 1, hour: 23, minute: 59, second: 59 });
    expect(toCalendarTime(lastSecond + 1)).toMatchObject({ day: 2, dayOfQuarter: 2, hour: 0, minute: 0, second: 0 });
    expect(dayStart(2)).toBe(lastSecond + 1);
  });

  it('rolls the quarter after eight days and the year after four quarters (D25; ten days a quarter before)', () => {
    expect(DAYS_PER_QUARTER).toBe(8);
    const quarter = DAYS_PER_QUARTER * SECONDS_PER_DAY - START_SECOND_OF_DAY;
    expect(toCalendarTime(quarter - 1)).toMatchObject({ quarter: 1, dayOfQuarter: 8, hour: 23 });
    expect(toCalendarTime(quarter)).toMatchObject({ quarter: 2, dayOfQuarter: 1, day: 9, hour: 0 });
    const year = DAYS_PER_QUARTER * QUARTERS_PER_YEAR * SECONDS_PER_DAY - START_SECOND_OF_DAY;
    expect(toCalendarTime(year - 1)).toMatchObject({ year: 1, quarter: 4, dayOfQuarter: 8 });
    expect(toCalendarTime(year)).toMatchObject({ year: 2, quarter: 1, dayOfQuarter: 1, day: 33 });
  });

  it('names a game day by its year, quarter and day of the quarter', () => {
    expect(calendarOfDay(1)).toEqual({ year: 1, quarter: 1, dayOfQuarter: 1 });
    expect(calendarOfDay(9)).toEqual({ year: 1, quarter: 2, dayOfQuarter: 1 });
    expect(calendarOfDay(32)).toEqual({ year: 1, quarter: 4, dayOfQuarter: 8 });
    expect(calendarOfDay(33)).toEqual({ year: 2, quarter: 1, dayOfQuarter: 1 });
    expect(() => calendarOfDay(0)).toThrow(RangeError);
  });

  it('round-trips losslessly', () => {
    for (const s of [0, 1, 59, 68_399, 68_400, 1_234_567, 98_765_432]) expect(toElapsed(toCalendarTime(s))).toBe(s);
    for (let s = 68_390; s < 68_410; s++) expect(toElapsed(toCalendarTime(s))).toBe(s);
  });

  it('takes only whole seconds since founding', () => {
    expect(() => toCalendarTime(0.5)).toThrow(RangeError);
    expect(() => toCalendarTime(-1)).toThrow(RangeError);
  });
});
