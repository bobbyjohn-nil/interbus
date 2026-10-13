import { describe, expect, it } from 'vitest';
import { SPARROW } from '../config/fleet';
import { busesForHeadway, busesNeeded, cycleSeconds, runningHeadway } from './cycle';

describe('the one cycle function (K07)', () => {
  // The debug line: Copley, Symphony, the MFA and Longwood, 3,535 m by street (planLine, 2026-10-13).
  const debugCycle = cycleSeconds(3_535, 4, SPARROW.kmh);

  it('times a round trip as the drive both ways, a dwell at each middle stop and a layover at each end', () => {
    // 2 × (3.535 km at 26 km/h = 489.5 s + 2 × 20 s) + 2 × 240 s = 1,539 s, 25.65 min.
    expect(debugCycle).toBe(1_539);
    expect(cycleSeconds(0, 2, SPARROW.kmh)).toBe(480);
  });

  it('counts the buses a headway needs: two Sparrows every 20 minutes, one every 30', () => {
    expect(busesForHeadway(debugCycle, 1_200)).toBe(2);
    expect(busesForHeadway(debugCycle, 1_800)).toBe(1);
    expect(busesForHeadway(debugCycle, 1_539)).toBe(1);
    expect(busesForHeadway(debugCycle, 1_538)).toBe(2);
  });

  it('needs the most any running period needs, and nothing for a period off (D7)', () => {
    expect(busesNeeded(debugCycle, { peak: 600, offpeak: 1_200, overnight: null })).toBe(3);
    expect(busesNeeded(debugCycle, { peak: 1_200, offpeak: 1_200, overnight: 3_600 })).toBe(2);
  });

  it('stretches the headway when a line is short of buses, and never shortens it', () => {
    expect(runningHeadway(debugCycle, 600, 3)).toBe(600);
    expect(runningHeadway(debugCycle, 600, 2)).toBe(770);
    expect(runningHeadway(debugCycle, 1_800, 4)).toBe(1_800);
    expect(runningHeadway(debugCycle, 600, 0)).toBeNull();
  });
});
