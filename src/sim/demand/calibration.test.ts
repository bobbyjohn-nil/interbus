// calib.tripScale on the fixture (PLAN §3; docs/specs/m1-first-dollar.md): prices stay V1's and demand
// scales, so the debug line carries 600–1,000 boardings a day, beside V1's starter line at 1,058
// (EC-11). The value lives in cities/boston/city.json; this test measures the line and holds it to
// the band, so a demand change that moves it fails here first.
import { describe, expect, it } from 'vitest';
import { bakeSim } from '../../../tools/bake/sim.mjs';
import { addDebugLine } from '../commands/debugLine';
import { loadCity } from '../city/simfile';
import { newGame } from '../state';
import { createWorld } from '../world';

const loaded = loadCity(bakeSim('boston', 'mini-boston').text);
if (!loaded.ok) throw new Error(loaded.problem);
const city = loaded.city;

function debugLine(scalePermille: number): { boarded: number; offered: number } {
  const world = createWorld({ ...city, tripScalePermille: scalePermille }, newGame({ id: 'boston', revision: 'mini-boston', hash: '-' }, { name: 'x', colour: '#000000' }, 1));
  addDebugLine(world);
  const demand = [...world.assignment.lines.values()][0]!;
  return { boarded: demand.perDay, offered: demand.perDay + demand.shedPerDay };
}

describe('calib.tripScale on mini-Boston', () => {
  it('puts the debug line at 600–1,000 boardings a day, none turned away', () => {
    const { boarded, offered } = debugLine(city.tripScalePermille);
    expect(city.tripScalePermille).toBe(111);
    expect(boarded).toBeGreaterThanOrEqual(600);
    expect(boarded).toBeLessThanOrEqual(1000);
    expect(offered).toBe(boarded);
  });

  // Full buses cap boardings, so the riders the line is offered, before crowding, are what scales.
  it('scales riders in proportion, so the calibration is one division', () => {
    const one = debugLine(1000).offered;
    expect(debugLine(500).offered / one).toBeCloseTo(0.5, 10);
    expect(one).toBeGreaterThan(5000); // 5,732.0 measured 2026-10-13 with V2's waits (EC-08); 7,164.6 with V1's
  });
});
