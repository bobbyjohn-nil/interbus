import { describe, expect, it } from 'vitest';
import { SECONDS_PER_DAY } from '../config/time';
import { DAY_WINDOWS, runningHeadwayIn, type Timing } from './timetable';

// The debug line: a 1,539 s cycle (cycle.test.ts), every 20 minutes by day, overnight off, 2 Sparrows.
const DEBUG: Timing = { cycle: 1_539, headways: { peak: 1_200, offpeak: 1_200, overnight: null }, buses: 2 };

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

  it('runs a short line every cycle ÷ buses, a spare bus changes nothing, and an off period or no buses runs nothing (V1)', () => {
    expect(runningHeadwayIn({ ...DEBUG, buses: 1 }, 'peak')).toBe(1_539);
    expect(runningHeadwayIn({ ...DEBUG, buses: 5 }, 'peak')).toBe(1_200);
    expect(runningHeadwayIn(DEBUG, 'overnight')).toBeNull();
    expect(runningHeadwayIn({ ...DEBUG, buses: 0 }, 'peak')).toBeNull();
  });
});
