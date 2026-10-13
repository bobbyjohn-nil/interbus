import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { SECONDS_PER_DAY, SECONDS_PER_HOUR } from '../config/time';
import { busesNeeded } from './cycle';
import { busesOut, dayDepartures, dayPlan, hourOfPlan, type PlanInputs } from './schedule';
import type { Timing } from './timetable';

// The debug line: a 1,539 s cycle, every 20 minutes by day, overnight off, 2 Sparrows; its depot
// 1.2 km from the first stop (166 s at 26 km/h) and 1.5 km back (208 s).
const DEBUG: Timing = { cycle: 1_539, headways: { peak: 1_200, offpeak: 1_200, overnight: null }, buses: 2 };
const inputs = (timing: Timing, over: Partial<PlanInputs> = {}): PlanInputs => ({ timing, oneWayS: timing.cycle / 2 - 240, pullOutS: 166, pullInS: 208, ...over });
const at = (h: number, m = 0) => h * SECONDS_PER_HOUR + m * 60;
const hours = (plan: ReturnType<typeof dayPlan>) => Array.from({ length: 24 }, (_, h) => hourOfPlan(plan, h * SECONDS_PER_HOUR, (h + 1) * SECONDS_PER_HOUR));

describe('departures', () => {
  it('leave every 20 minutes from 05:00 to 23:40: 57 a day', () => {
    const d = dayDepartures(DEBUG);
    expect(d).toHaveLength(57);
    expect([d[0], d[1], d.at(-1)]).toEqual([at(5), at(5, 20), at(23, 40)]);
  });

  it('start a shorter peak on time, and keep each period’s own headway (V3 used round trip ÷ buses)', () => {
    const d = dayDepartures({ ...DEBUG, headways: { peak: 600, offpeak: 3_600, overnight: null }, buses: 3 });
    expect(d.slice(0, 4)).toEqual([at(5), at(6), at(6, 30), at(6, 40)]);
    // The peak's last spacing carries into off-peak (09:20, 09:30), then every hour.
    expect(d).toContain(at(9, 30));
    expect(d).toContain(at(10, 30));
    expect(d).not.toContain(at(9, 40));
  });

  it('never leave closer than the line’s buses allow, across every window change', () => {
    const d = dayDepartures({ ...DEBUG, headways: { peak: 1_800, offpeak: 600, overnight: null }, buses: 1 });
    for (let k = 1; k < d.length; k++) expect(d[k]! - d[k - 1]!).toBeGreaterThanOrEqual(1_539);
  });

  it('run all day, with no pull-out at dawn, when overnight runs', () => {
    const plan = dayPlan(inputs({ ...DEBUG, headways: { peak: 1_200, offpeak: 1_200, overnight: 2_400 } }));
    expect(dayDepartures(plan.inputs.timing)[0]).toBe(0);
    expect(hours(plan).reduce((n, h) => n + h.pullOuts, 0)).toBe(0);
  });
});

describe('the day plan (I6)', () => {
  const plan = dayPlan(inputs(DEBUG));

  it('runs every 20 minutes with the two Sparrows the cycle needs, each pulled out once and home once', () => {
    expect(busesOut(plan)).toBe(2);
    const day = hours(plan);
    expect(day.reduce((n, h) => n + h.pullOuts, 0)).toBe(2);
    expect(day.reduce((n, h) => n + h.pullIns, 0)).toBe(2);
    // Each departure runs out and back: 114 legs.
    expect(day.reduce((n, h) => n + h.legs, 0)).toBe(114);
  });

  it('loops each bus in exactly its cycle: no departure before its last round trip is done', () => {
    for (const s of plan.stints) {
      for (let k = 1; k < s.trips.length; k++) expect(s.trips[k]! - s.trips[k - 1]!).toBeGreaterThanOrEqual(DEBUG.cycle);
      expect(s.lastArrival).toBeCloseTo(s.trips.at(-1)! + DEBUG.cycle - 240, 6);
      expect(s.arriveDepot).toBeCloseTo(s.lastArrival + 208, 6);
      expect(s.leaveDepot).toBe(s.trips[0]! - 166);
    }
  });

  it('sends a bus home when it would wait over an hour, and back out for the next peak', () => {
    const peaky = dayPlan(inputs({ ...DEBUG, headways: { peak: 600, offpeak: 3_600, overnight: null }, buses: 3 }));
    const day = hours(peaky);
    expect(busesOut(peaky)).toBe(3);
    // Two extra Sparrows for each peak, plus the one that runs all day.
    expect(day.reduce((n, h) => n + h.pullOuts, 0)).toBe(5);
    expect(day[12]!.pullOuts + day[13]!.pullOuts).toBe(0);
  });

  it('never needs more buses than the line owns, nor more than its headways need (property, 300 timings)', () => {
    const rng = createRng(4);
    const minutes = [5, 6, 8, 10, 12, 15, 20, 30, 45, 60];
    for (let i = 0; i < 300; i++) {
      const offpeak = rng.pick(minutes) * 60;
      const headways = { peak: rng.pick(minutes) * 60, offpeak, overnight: rng.next() < 0.3 ? Math.max(offpeak, rng.pick(minutes) * 60) : null };
      const cycle = rng.int(600, 6_000);
      const owned = rng.int(1, 8);
      const timing = { cycle, headways, buses: owned };
      const plan = dayPlan(inputs(timing, { pullOutS: rng.int(0, 900), pullInS: rng.int(0, 900) }));
      expect(busesOut(plan), JSON.stringify(timing)).toBeLessThanOrEqual(Math.min(owned, busesNeeded(cycle, headways)));
    }
  });

  it('adds up however the day is sliced', () => {
    const whole = hourOfPlan(plan, 0, SECONDS_PER_DAY);
    const day = hours(plan);
    expect(day.reduce((n, h) => n + h.legs, 0)).toBe(whole.legs);
    expect(day.reduce((n, h) => n + h.serviceS, 0)).toBeCloseTo(whole.serviceS, 6);
  });
});
