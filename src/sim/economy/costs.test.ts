import { describe, expect, it } from 'vitest';
import { DEPOT_UPKEEP_CENTS } from '../config/depots';
import { SPARROW } from '../config/fleet';
import { dayPlan } from '../rules/schedule';
import type { Timing } from '../rules/timetable';
import { DEPOT_UPKEEP_PER_HOUR_CENTS, driveSeconds, forecastDay, lineCostsInHour, type LineCostInputs } from './costs';

// The debug line (schedule.test.ts) parked 1.2 km from its first stop and 1.5 km back.
const TIMING: Timing = { cycle: 1_539, headways: { peak: 1_200, offpeak: 1_200, overnight: null }, buses: 2 };
function line(timing = TIMING, pullOutM = 1_200, pullInM = 1_500): LineCostInputs {
  const plan = dayPlan({ timing, oneWayS: timing.cycle / 2 - 240, pullOutS: driveSeconds(pullOutM, SPARROW), pullInS: driveSeconds(pullInM, SPARROW) });
  return { plan, routeM: 3_535, model: SPARROW, pullOutM, pullInM };
}
const DEBUG = line();

describe('a line’s costs, hour by hour, from its day plan (the M2 spec, item 5)', () => {
  it('runs each leg the length of the line at $0.90/km: 57 departures out and back', () => {
    // 3.535 km × 90 ¢ = 318 ¢ a leg. Hour 5 holds the runs out at 05:00, 05:20 and 05:40 and back at
    // 05:12:49, 05:32:49 and 05:52:49 (half a 1,539 s cycle later).
    expect(lineCostsInHour(DEBUG, 5).running).toBe(6 * 318);
    expect(forecastDay(DEBUG).running).toBe(114 * 318);
  });

  it('pays $26 an hour for each bus from its first departure to its last arrival, not for each bus owned', () => {
    // Bus 1: 05:00 to 24:01:39 (68,499 s); bus 2: 05:20 to 23:41:39 (66,099 s): 37.39 hours.
    const wages = forecastDay(DEBUG).wages;
    expect(Math.abs(wages - (134_598 * 2_600) / 3_600)).toBeLessThan(12); // 24 hourly roundings
    expect(forecastDay(line({ ...TIMING, buses: 4 })).wages).toBe(wages);
  });

  it('charges the deadhead once each way per bus, at the km and wage rates (V3 never wired it)', () => {
    // Out 1.2 km: 108 ¢ + 166 s of driver = 120 ¢; back 1.5 km: 135 ¢ + 208 s = 150 ¢. Bus 1 leaves at 04:57.
    expect(lineCostsInHour(DEBUG, 4).deadhead).toBe(108 + 120);
    expect(forecastDay(DEBUG).deadhead).toBe(2 * (108 + 120 + 135 + 150));
    expect(forecastDay(line(TIMING, 0, 0)).deadhead).toBe(0);
  });

  it('costs nothing in the hours nothing runs, and nothing with no buses', () => {
    for (const h of [1, 2, 3]) expect(lineCostsInHour(DEBUG, h)).toEqual({ running: 0, wages: 0, deadhead: 0 });
    expect(forecastDay(line({ ...TIMING, buses: 0 }))).toEqual({ running: 0, wages: 0, deadhead: 0 });
  });

  it('forecasts the rest of a day as the sum of its hours, to the cent (I1, I6)', () => {
    let left = forecastDay(DEBUG);
    for (let h = 0; h < 24; h++) {
      expect(forecastDay(DEBUG, h)).toEqual(left);
      const c = lineCostsInHour(DEBUG, h);
      left = { running: left.running - c.running, wages: left.wages - c.wages, deadhead: left.deadhead - c.deadhead };
    }
    expect(left).toEqual({ running: 0, wages: 0, deadhead: 0 });
  });

  it('spreads a depot’s $300 a day over 24 whole-cent hours', () => {
    expect(Number.isSafeInteger(DEPOT_UPKEEP_PER_HOUR_CENTS)).toBe(true);
    expect(24 * DEPOT_UPKEEP_PER_HOUR_CENTS).toBe(DEPOT_UPKEEP_CENTS);
  });
});
