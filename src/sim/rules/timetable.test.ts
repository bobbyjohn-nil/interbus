import { describe, expect, it } from 'vitest';
import { SECONDS_PER_DAY, SECONDS_PER_HOUR } from '../config/time';
import { busesInService, busSecondsBetween, dailyPullOuts, DAY_WINDOWS, departuresBetween, runningHeadwayIn, type Timing } from './timetable';

// The debug line: a 1,539 s cycle (cycle.test.ts), every 20 minutes by day, overnight off, 2 Sparrows.
const DEBUG: Timing = { cycle: 1_539, headways: { peak: 1_200, offpeak: 1_200, overnight: null }, buses: 2 };
const hourly = <T>(f: (from: number, to: number) => T) => Array.from({ length: 24 }, (_, h) => f(h * SECONDS_PER_HOUR, (h + 1) * SECONDS_PER_HOUR));
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

describe('the timetable', () => {
  it('splits the day into period windows that tile it with no gap (D7)', () => {
    expect(DAY_WINDOWS[0]!.from).toBe(0);
    expect(DAY_WINDOWS.at(-1)!.to).toBe(SECONDS_PER_DAY);
    DAY_WINDOWS.slice(1).forEach((w, k) => expect(w.from).toBe(DAY_WINDOWS[k]!.to));
    expect(DAY_WINDOWS.map((w) => `${w.from / 60}-${w.to / 60}:${w.period}`)).toEqual([
      '0-300:overnight',
      '300-390:offpeak',
      '390-570:peak',
      '570-960:offpeak',
      '960-1140:peak',
      '1140-1440:offpeak',
    ]);
  });

  it('leaves each end every running headway from each window start: 58 a day on the debug line', () => {
    // 05:00–06:30 gives 5 (05:00…06:20), 06:30–09:30 9, 09:30–16:00 20, 16:00–19:00 9, 19:00–24:00 15.
    expect(departuresBetween(DEBUG, 0, SECONDS_PER_DAY)).toBe(58);
    expect(departuresBetween(DEBUG, 0, 5 * SECONDS_PER_HOUR)).toBe(0);
    expect(departuresBetween(DEBUG, 5 * SECONDS_PER_HOUR, 5 * SECONDS_PER_HOUR + 1)).toBe(1);
  });

  it('adds up however the day is sliced, so the hours sum to the day (I6)', () => {
    for (const t of [DEBUG, { ...DEBUG, buses: 1 }, { ...DEBUG, headways: { peak: 420, offpeak: 900, overnight: 3_000 }, buses: 3 }]) {
      expect(sum(hourly((a, b) => departuresBetween(t, a, b)))).toBe(departuresBetween(t, 0, SECONDS_PER_DAY));
      expect(sum(hourly((a, b) => busSecondsBetween(t, a, b)))).toBe(busSecondsBetween(t, 0, SECONDS_PER_DAY));
    }
  });

  it('runs a short line every cycle ÷ buses, and pays drivers only for the buses out (V1)', () => {
    const short = { ...DEBUG, buses: 1 };
    expect(runningHeadwayIn(short, 'peak')).toBe(1_539);
    expect(busesInService(short, 'peak')).toBe(1);
    const spare = { ...DEBUG, buses: 5 };
    expect(runningHeadwayIn(spare, 'peak')).toBe(1_200);
    expect(busesInService(spare, 'peak')).toBe(2);
    // 19 service hours × 2 buses.
    expect(busSecondsBetween(spare, 0, SECONDS_PER_DAY)).toBe(19 * 2 * SECONDS_PER_HOUR);
  });

  it('runs nothing in a period that is off or with no buses', () => {
    expect(runningHeadwayIn(DEBUG, 'overnight')).toBeNull();
    expect(busesInService(DEBUG, 'overnight')).toBe(0);
    const none = { ...DEBUG, buses: 0 };
    expect(departuresBetween(none, 0, SECONDS_PER_DAY)).toBe(0);
    expect(busSecondsBetween(none, 0, SECONDS_PER_DAY)).toBe(0);
  });

  it('pulls out each morning the buses that are out by day but not overnight', () => {
    expect(dailyPullOuts(DEBUG)).toBe(2);
    expect(dailyPullOuts({ ...DEBUG, headways: { peak: 600, offpeak: 1_200, overnight: 1_200 }, buses: 3 })).toBe(1);
    expect(dailyPullOuts({ ...DEBUG, buses: 0 })).toBe(0);
  });
});
