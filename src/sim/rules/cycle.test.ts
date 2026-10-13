import { describe, expect, it } from 'vitest';
import { SPARROW } from '../config/fleet';
import { busesForHeadway, busesNeeded, cycleSeconds, cyclesOf, runningHeadway } from './cycle';

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

  it('times each period’s round trip at its traffic: the debug line’s is 1,641 s at peak, 1,442 off-peak and 1,362 overnight (item 15)', () => {
    // Its streets take 1.072 of the rush (planLine, 2026-10-13); only the drive changes, never the dwells or layovers.
    expect(cyclesOf(3_535, 4, SPARROW.kmh, 1.072)).toEqual({ peak: 1_641, offpeak: 1_442, overnight: 1_362 });
    expect(cyclesOf(3_535, 4, SPARROW.kmh, 0)).toEqual({ peak: 1_539, offpeak: 1_539, overnight: 1_539 });
  });

  it('counts buses for round trips by period on the longest over the shortest headway: the peak’s own when the peak is slowest and busiest', () => {
    const cycles = { peak: 2_000, offpeak: 1_700, overnight: 1_500 };
    expect(busesNeeded(cycles, { peak: 600, offpeak: 1_200, overnight: null })).toBe(4);
    // A busier off-peak than a slower peak: its trips meet the peak's still out, so it counts the peak's round trip.
    expect(busesNeeded(cycles, { peak: 1_200, offpeak: 600, overnight: null })).toBe(4);
    // One round trip all day counts as it did.
    const same = { peak: 1_539, offpeak: 1_539, overnight: 1_539 };
    for (const h of [{ peak: 600, offpeak: 1_200, overnight: null }, { peak: 1_200, offpeak: 1_200, overnight: 3_600 }]) expect(busesNeeded(same, h)).toBe(busesNeeded(1_539, h));
  });

  it('stretches the headway when a line is short of buses, and never shortens it', () => {
    expect(runningHeadway(debugCycle, 600, 3)).toBe(600);
    expect(runningHeadway(debugCycle, 600, 2)).toBe(770);
    expect(runningHeadway(debugCycle, 1_800, 4)).toBe(1_800);
    expect(runningHeadway(debugCycle, 600, 0)).toBeNull();
  });
});
