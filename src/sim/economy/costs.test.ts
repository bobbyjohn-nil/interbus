import { describe, expect, it } from 'vitest';
import { DEPOT_UPKEEP_CENTS } from '../config/depots';
import { SPARROW } from '../config/fleet';
import { DEPOT_UPKEEP_PER_HOUR_CENTS, forecastDay, lineCostsInHour, PULL_IN_HOUR, PULL_OUT_HOUR, type LineCostInputs } from './costs';

// The debug line (timetable.test.ts) parked 1.2 km from its first stop and 1.5 km from its last.
const DEBUG: LineCostInputs = {
  timing: { cycle: 1_539, headways: { peak: 1_200, offpeak: 1_200, overnight: null }, buses: 2 },
  routeM: 3_535,
  model: SPARROW,
  pullOutM: 1_200,
  pullInM: 1_500,
};

describe('a line’s costs, hour by hour (the M2 spec, item 5)', () => {
  it('runs each departure the length of the line at $0.90/km, both ways', () => {
    // 3.535 km × 90 ¢ = 318 ¢ a trip; 05:00, 05:20 and 05:40 from each end.
    expect(lineCostsInHour(DEBUG, 5).running).toBe(2 * 3 * 318);
    // 58 departures from each end a day.
    expect(forecastDay(DEBUG).running).toBe(2 * 58 * 318);
  });

  it('pays $26 an hour for each bus in service, not each bus owned', () => {
    expect(lineCostsInHour(DEBUG, 5).wages).toBe(2 * 2_600);
    expect(forecastDay(DEBUG).wages).toBe(19 * 2 * 2_600);
    expect(forecastDay({ ...DEBUG, timing: { ...DEBUG.timing, buses: 4 } }).wages).toBe(19 * 2 * 2_600);
  });

  it('charges the deadhead once each way per bus, at the km and wage rates (V3 never wired it)', () => {
    // Out 1.2 km: 108 ¢ + 166 s of driver = 120 ¢; back 1.5 km: 135 ¢ + 208 s = 150 ¢.
    expect(lineCostsInHour(DEBUG, PULL_OUT_HOUR).deadhead).toBe(2 * (108 + 120));
    expect(lineCostsInHour(DEBUG, PULL_IN_HOUR).deadhead).toBe(2 * (135 + 150));
    expect(forecastDay(DEBUG).deadhead).toBe(2 * (108 + 120 + 135 + 150));
    expect(forecastDay({ ...DEBUG, pullOutM: 0, pullInM: 0 }).deadhead).toBe(0);
  });

  it('costs nothing in the hours it does not run, and nothing with no buses', () => {
    for (let h = 0; h < 5; h++) expect(lineCostsInHour(DEBUG, h)).toEqual({ running: 0, wages: 0, deadhead: 0 });
    expect(forecastDay({ ...DEBUG, timing: { ...DEBUG.timing, buses: 0 } })).toEqual({ running: 0, wages: 0, deadhead: 0 });
  });

  it('forecasts the rest of a day as the sum of its hours, to the cent (I1, I6)', () => {
    let left = forecastDay(DEBUG);
    for (let h = 0; h < 24; h++) {
      expect(forecastDay(DEBUG, h)).toEqual(left);
      const c = lineCostsInHour(DEBUG, h);
      left = { running: left.running - c.running, wages: left.wages - c.wages, deadhead: left.deadhead - c.deadhead };
    }
    expect(left).toEqual({ running: 0, wages: 0, deadhead: 0 });
    // $368.88 running, $988.00 wages, $10.26 deadhead: $1,367.14 a day.
    const day = forecastDay(DEBUG);
    expect(day.running + day.wages + day.deadhead).toBe(136_714);
  });

  it('spreads a depot’s $300 a day over 24 whole-cent hours', () => {
    expect(Number.isSafeInteger(DEPOT_UPKEEP_PER_HOUR_CENTS)).toBe(true);
    expect(24 * DEPOT_UPKEEP_PER_HOUR_CENTS).toBe(DEPOT_UPKEEP_CENTS);
  });
});
