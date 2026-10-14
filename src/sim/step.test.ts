// advance() moves the clock over the steps between hour boundaries at once (step.ts): the world it
// leaves, and what it returns, are the same as stepping one second at a time.
import { describe, expect, it } from 'vitest';
import { addDebugLine } from './commands/debugLine';
import { SECONDS_PER_DAY, STEP_SECONDS } from './config/time';
import { advance, simStep, type SimEvent } from './step';
import { gameWithDepot } from './testing';
import type { World } from './world';

function running(): World {
  const world = gameWithDepot(5);
  if (!addDebugLine(world).ok) throw new Error('no debug line');
  return world;
}

describe('advance', () => {
  it('leaves the same world and the same day closes as one step at a time, over boundaries and odd lengths', () => {
    // Two days and a few odd seconds: from 05:00 over two midnights and the hours between, in pieces
    // that start and end off the hour, one of them exactly an hour and one a single step.
    const pieces = [1, 3_599, 3_600, 7_201, 59, SECONDS_PER_DAY, 20 * 3_600 + 17, STEP_SECONDS];
    const byStep = running();
    const stepped: SimEvent[] = [];
    const total = pieces.reduce((s, p) => s + p, 0);
    for (let s = 0; s < total; s += STEP_SECONDS) stepped.push(...simStep(byStep));
    const byAdvance = running();
    const advanced = pieces.flatMap((p) => advance(byAdvance, p));
    expect(byAdvance.state.elapsed).toBe(total);
    expect(advanced.map((e) => e.day)).toEqual([1, 2]);
    expect(advanced).toEqual(stepped);
    expect(JSON.stringify(byAdvance.state)).toBe(JSON.stringify(byStep.state));
  });

  it('refuses a part of a step and a negative length', () => {
    const world = running();
    expect(() => advance(world, -1)).toThrow(RangeError);
    expect(() => advance(world, 0.5)).toThrow(RangeError);
    expect(advance(world, 0)).toEqual([]);
    expect(world.state.elapsed).toBe(0);
  });
});
