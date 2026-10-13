// Riders scan every line at a stop (I5; K23, V2): of the lines serving a trip they take the first
// bus among those worth waiting for, so each carries its share of their combined frequency. Shown
// failing (TS-04) with the quickest line alone taking every rider, as M1–M3 did until step 11: of
// six lines along the same four stops, the first took them all and the other five boarded nobody.
import { describe, expect, it } from 'vitest';
import { addDebugLine } from '../commands/debugLine';
import { mint } from '../core/ids';
import { gameWithDepot } from '../testing';
import { recompute } from '../world';
import { commonLines, perceivedWaitMin, waitMin } from './assign';

describe('commonLines', () => {
  const run = (base: number[], headway: number[]) => {
    const share = new Float64Array(base.length);
    const minutes = commonLines(base, headway, base.length, share, new Int32Array(base.length));
    return { minutes, share: [...share] };
  };

  it('gives one line its own minutes and wait', () => {
    expect(run([20], [1_200])).toEqual({ minutes: 20 + perceivedWaitMin(waitMin(1_200)), share: [1] });
  });

  it('splits two equal lines evenly, at the wait of their combined headway', () => {
    const { minutes, share } = run([20, 20], [1_200, 1_200]);
    expect(share).toEqual([0.5, 0.5]);
    expect(minutes).toBeCloseTo(20 + perceivedWaitMin(waitMin(600)), 12);
  });

  it('splits by frequency, and leaves out a line too slow to wait for', () => {
    const { share } = run([20, 21], [600, 1_800]); // every 10 and every 30 minutes, a minute apart
    expect(share[0]).toBeCloseTo(0.75, 12);
    expect(share[1]).toBeCloseTo(0.25, 12);
    expect(run([20, 60], [600, 600]).share).toEqual([1, 0]); // 40 minutes slower: never worth the bus
    expect(run([20, 15], [600, Infinity]).share).toEqual([1, 0]); // the quicker one does not run
  });
});

describe('a hub (I5)', () => {
  it('boards riders on every one of six lines along the same stops, a sixth each', () => {
    const world = gameWithDepot();
    addDebugLine(world);
    const template = world.state.lines[0]!;
    const one = [...world.assignment.lines.values()][0]!.perDay;
    for (let k = 1; k < 6; k++) {
      const [id, next] = mint(world.state.nextIds, 'line');
      world.state.nextIds = next;
      world.state.lines.push({ ...template, id, name: `Line ${id}`, stopIds: [...template.stopIds], boardedMilli: 0 });
    }
    recompute(world);
    const riders = [...world.assignment.lines.values()].map((d) => d.perDay);
    expect(riders).toHaveLength(6);
    riders.forEach((r, k) => expect(r, `line ${k + 1}'s riders a day`).toBeGreaterThan(0));
    for (const r of riders) expect(r / riders[0]!).toBeCloseTo(1, 9);
    // Six times the buses come six times as often, so more ride than on one line, but not six times as many.
    const total = riders.reduce((s, r) => s + r, 0);
    expect(total).toBeGreaterThan(one);
    expect(total).toBeLessThan(2 * one);
  });
});
