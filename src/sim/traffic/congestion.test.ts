import { describe, expect, it } from 'vitest';
import { HOURLY_PROFILE } from '../config/demand';
import { classRush, congestionAt, periodCongestion, RUSH } from './congestion';

// Each half-hour's share of a day's trips, as demand/assign.ts spreads them.
const slotTrips = (s: number) => HOURLY_PROFILE[Math.floor(s / 2)]! / 2;

describe('hourly congestion (the M3 spec, item 15)', () => {
  it('averages 1.00 over the day’s trips on every street, so the riders’ calibration stands', () => {
    expect(RUSH).toHaveLength(48);
    for (const rush of [0, 0.18, 0.55, 1.15, 1.35]) {
      const mean = RUSH.reduce((sum, _, s) => sum + congestionAt(rush, s) * slotTrips(s), 0);
      expect(mean).toBeCloseTo(1, 12);
    }
  });

  it('slows the rush hours and speeds the night, more on bigger streets', () => {
    // 17:30, the curve's top, against 03:00.
    expect(congestionAt(1.15, 35)).toBeGreaterThan(congestionAt(0.18, 35));
    expect(congestionAt(0.18, 35)).toBeGreaterThan(1);
    expect(congestionAt(1.15, 6)).toBeLessThan(congestionAt(0.18, 6));
    expect(congestionAt(0.18, 6)).toBeLessThan(1);
  });

  it('gives each period its trips’ mean: primary streets 1.111 at peak, 0.894 off-peak, 0.806 overnight', () => {
    const primary = periodCongestion(1.15);
    expect(primary.peak).toBeCloseTo(1.111, 3);
    expect(primary.offpeak).toBeCloseTo(0.894, 3);
    expect(primary.overnight).toBeCloseTo(0.806, 3);
    expect(periodCongestion(0)).toEqual({ peak: 1, offpeak: 1, overnight: 1 });
  });

  it('reads V2’s weights off OSM’s classes, and every other street as local', () => {
    expect(classRush('motorway')).toBe(1.35);
    expect(classRush('trunk_link')).toBe(1.35);
    expect(classRush('primary')).toBe(1.15);
    expect(classRush('secondary')).toBe(1.15);
    expect(classRush('tertiary')).toBe(0.55);
    expect(classRush('residential')).toBe(0.18);
    expect(classRush('busway')).toBe(0.18);
  });
});
