// A fare weighed against the ride it buys (V2's elasticity, EC-09; the M3 spec, item 4): (3 km ÷
// ride)^1.5, within 0.15–1.6. Shown failing (TS-04): with V1's flat fare minutes, a 3.5 km ride keeps
// 0.763 of its riders when the fare goes from $2.25 to $3.00 and a 1.3 km hop 0.507, 1.5 times as
// many; with V2's, 0.810 against 0.376, 2.2 times.
import { describe, expect, it } from 'vitest';
import { bakeSim } from '../../../tools/bake/sim.mjs';
import { addDebugLine } from '../commands/debugLine';
import { loadCity } from '../city/simfile';
import { newGame } from '../state';
import { createWorld, planLine } from '../world';
import { assign, fareSensitivity, type LinePlan } from './assign';

const loaded = loadCity(bakeSim('boston', 'mini-boston').text);
if (!loaded.ok) throw new Error(loaded.problem);
const world = createWorld(loaded.city, newGame({ id: 'boston', revision: 'mini-boston', hash: '-' }, { name: 'x', colour: '#000000' }, 1));
addDebugLine(world);
const debug = planLine(world, world.state.lines[0]!)!;
/** The debug line cut down to two of its stops. */
const twoStops = (a: number, b: number): LinePlan => ({ ...debug, stops: [debug.stops[a]!, debug.stops[b]!], stopDistM: [0, debug.stopDistM[b]! - debug.stopDistM[a]!] });
const kept = (plan: LinePlan) => {
  const riders = (fareCents: number) => assign(world.city, world.commuters, [{ ...plan, fareCents }]).lines.get(plan.id)!.perDay;
  return riders(300) / riders(225);
};

describe('the fare against the ride', () => {
  it('bites hardest on a short ride and least on a long one', () => {
    expect(fareSensitivity(3)).toBe(1);
    expect(fareSensitivity(1)).toBe(1.6); // (3 ÷ 1)^1.5 = 5.2, held at 1.6
    expect(fareSensitivity(6)).toBeCloseTo(0.354, 3);
    expect(fareSensitivity(20)).toBe(0.15);
    expect(fareSensitivity(0)).toBe(1.6);
  });

  it('keeps more than 1.8 times the share of riders on a 3.5 km ride as on a 1.3 km hop when the fare rises', () => {
    const hop = kept(twoStops(0, 1));
    const ride = kept(twoStops(0, 3));
    expect(debug.stopDistM[1]).toBeLessThan(1_400);
    expect(debug.stopDistM[3]).toBeGreaterThan(3_500);
    expect(ride / hop).toBeGreaterThan(1.8);
  });

  it('leaves riders as they were at $2.25, whatever the ride', () => {
    const plain = assign(world.city, world.commuters, [debug]).lines.get(debug.id)!.perDay;
    // 614.4 before item 15's rush hour slowed its peak rides and sped its midday ones.
    expect(plain).toBeCloseTo(610.5, 1);
  });
});
