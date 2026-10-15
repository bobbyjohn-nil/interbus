import { describe, expect, it } from 'vitest';
import type { LineView, LngLatPair } from '../../sim/types';
import { BUS_FLOATS, Fleet } from './fleet';

// The debug line laid straight east (sim/rules/position.test.ts), as the worker would send it.
const LAT = 42.35;
const M_LON = 111_320 * Math.cos((LAT * Math.PI) / 180);
const east = (m: number): LngLatPair => [-71.1 + m / M_LON, LAT];
function line(buses = 2): LineView {
  return {
    id: 1,
    name: 'Line 1',
    colour: '#c0392b',
    stops: [east(0), east(1_339), east(2_425), east(3_535)],
    stopIds: [1, 2, 3, 4],
    route: [east(0), east(1_339), east(2_425), east(3_535)],
    stopAt: [0, 1, 2, 3],
    stopDistM: [0, 1_339, 2_425, 3_535],
    pullOut: [[-71.1, LAT - 0.01], east(0)],
    pullIn: [east(0), [-71.1, LAT - 0.01]],
    plan: { timing: { cycle: 1_539, headways: { peak: 1_200, offpeak: 1_200, overnight: null }, buses }, oneWayS: 529.5, pullOutS: 166, pullInS: 208 },
    ridersPerDay: 750,
    fareCents: 225,
    turnedAwayPerDay: 0,
    fullAtMinute: null,
    headways: { peak: 1_200, offpeak: 1_200, overnight: null },
    cycle: 1_539,
    cycles: { peak: 1_539, offpeak: 1_539, overnight: 1_539 },
    rush: 0,
    worksM: 0,
    settling: null,
    buses,
    model: 'sparrow',
  };
}

describe('the fleet the vehicle layer draws', () => {
  it('draws each line’s buses in its colour at the clock’s second', () => {
    const fleet = new Fleet();
    fleet.setLines([line()]);
    fleet.setClock(12 * 3_600, 0, 1_000);
    const { count, data } = fleet.frame(5_000);
    expect(count).toBe(2);
    expect([...data.subarray(3, 6)].map((v) => Math.round(v * 255))).toEqual([0xc0, 0x39, 0x2b]);
    for (let i = 0; i < count; i++) expect(data[BUS_FLOATS * i + 1]).toBeCloseTo(LAT, 6);
  });

  it('runs the clock on between snapshots at the sim’s rate, never more than a quarter-second ahead', () => {
    const fleet = new Fleet();
    fleet.setLines([line()]);
    fleet.setClock(43_200, 600, 1_000);
    expect(fleet.secondAt(1_100)).toBeCloseTo(43_260, 6);
    expect(fleet.secondAt(9_000)).toBeCloseTo(43_350, 6);
    fleet.setClock(86_390, 600, 0);
    expect(fleet.secondAt(100)).toBeCloseTo(50, 6); // past midnight, into the next day
  });

  it('asks for frames only while the clock runs and a line has buses (I14)', () => {
    const fleet = new Fleet();
    fleet.setLines([line()]);
    fleet.setClock(43_200, 0, 0);
    expect(fleet.running).toBe(false);
    fleet.setClock(43_200, 600, 0);
    expect(fleet.running).toBe(true);
    fleet.setLines([line(0)]);
    expect(fleet.running).toBe(false);
    expect(fleet.frame(0).count).toBe(0);
  });
});
