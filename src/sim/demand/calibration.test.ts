// calib.tripScale on the fixture (PLAN §3; docs/specs/current.md): prices stay V1's and demand
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

function debugLineRiders(scalePermille: number): number {
  const world = createWorld({ ...city, tripScalePermille: scalePermille }, newGame({ id: 'boston', revision: 'mini-boston', hash: '-' }, { name: 'x', colour: '#000000' }, 1));
  addDebugLine(world);
  return [...world.assignment.lines.values()][0]!.perDay;
}

describe('calib.tripScale on mini-Boston', () => {
  it('puts the debug line at 600–1,000 boardings a day', () => {
    const riders = debugLineRiders(city.tripScalePermille);
    expect(city.tripScalePermille).toBe(111);
    expect(riders).toBeGreaterThanOrEqual(600);
    expect(riders).toBeLessThanOrEqual(1000);
  });

  it('scales riders in proportion, so the calibration is one division', () => {
    const one = debugLineRiders(1000);
    expect(debugLineRiders(500) / one).toBeCloseTo(0.5, 10);
    expect(one).toBeGreaterThan(7000); // 7,200.7 measured 2026-10-13
  });
});
