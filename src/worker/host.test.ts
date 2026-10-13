import { describe, expect, it } from 'vitest';
import { bakeSim } from '../../tools/bake/sim.mjs';
import { STEP_SECONDS } from '../sim/config/time';
import type { FromWorker } from '../sim/types';
import { createHost, MAX_SLICE_MS, SPEEDS } from './host';

const baked = bakeSim('boston', 'mini-boston');
const CITY = { id: 'boston', revision: 'mini-boston', hash: baked.sha256 };

function started() {
  const out: FromWorker[] = [];
  const host = createHost((m) => out.push(m));
  host.handle({ type: 'init', simText: baked.text, city: CITY, seed: 1 });
  return { host, out, last: <T extends FromWorker['type']>(type: T) => out.filter((m) => m.type === type).at(-1) as Extract<FromWorker, { type: T }> | undefined };
}

describe('the sim host', () => {
  it('starts paused at 05:00 on day 1 with the dots of every home and job', () => {
    const { last } = started();
    const ready = last('ready')!;
    expect(ready.snapshot).toMatchObject({ elapsed: 0, day: 1, hour: 5, minute: 0, speed: 0, cashCents: 42_720_000, lines: [] });
    expect(ready.dots.homes.reduce((s, d) => s + d[2], 0)).toBe(105_620);
    expect(ready.dots.jobs.reduce((s, d) => s + d[2], 0)).toBe(186_144);
  });

  it('runs no steps and sends no frames while paused (I14)', () => {
    const { host, out } = started();
    const before = out.length;
    for (let t = 0; t < 5000; t += 50) host.tick(t);
    expect(out.length).toBe(before);
  });

  it('advances at the chosen speed, never more than a quarter-second of real time per tick', () => {
    const { host, last } = started();
    host.handle({ type: 'speed', speed: 1 });
    for (let t = 0; t <= 1000; t += 50) host.tick(t);
    expect(last('snapshot')!.snapshot.elapsed).toBe(SPEEDS[1]); // one real second: ten game-minutes
    host.tick(1000 + 60_000); // a minute in a background tab
    const leap = (MAX_SLICE_MS / 1000) * SPEEDS[1];
    expect(last('snapshot')!.snapshot.elapsed - SPEEDS[1]).toBeLessThanOrEqual(leap);
    expect(last('snapshot')!.snapshot.elapsed % STEP_SECONDS).toBe(0);
  });

  it('runs the debug line, and the day card at 24:00 adds up (the M1 exit check, headless)', () => {
    const { host, out, last } = started();
    host.handle({ type: 'add-debug-line' });
    expect(last('snapshot')!.snapshot.lines[0]).toMatchObject({ name: 'Debug line' });
    expect(last('snapshot')!.snapshot.linesVersion).toBe(last('ready')!.snapshot.linesVersion + 1);
    expect(last('snapshot')!.snapshot.lines[0]!.route.length).toBeGreaterThan(10);
    host.handle({ type: 'speed', speed: 3 });
    for (let t = 0; out.every((m) => m.type !== 'day-card'); t += 250) host.tick(t);
    const card = last('day-card')!.card;
    expect(card.day).toBe(1);
    expect(card.rows.some((r) => r.kind === 'fares' && r.amountCents > 0)).toBe(true);
    expect(card.rows.reduce((s, r) => s + r.amountCents, 0)).toBe(card.cashAfterCents - card.cashBeforeCents);
  });

  it('refuses a second debug line, and answers a probe with the people within a walk', () => {
    const { host, last } = started();
    host.handle({ type: 'add-debug-line' });
    host.handle({ type: 'add-debug-line' });
    expect(last('refused')).toEqual({ type: 'refused', command: 'add-debug-line', reason: 'already_running' });
    host.handle({ type: 'probe', id: 7, at: [-71.0857, 42.3424] }); // Symphony
    const probe = last('probe')!;
    expect(probe.id).toBe(7);
    expect(probe.people).toBeGreaterThan(3_000);
    expect(probe.people).toBeLessThan(30_000);
  });

  it('refuses a broken sim file in words', () => {
    const out: FromWorker[] = [];
    createHost((m) => out.push(m)).handle({ type: 'init', simText: '{"format":9}', city: CITY, seed: 1 });
    expect(out).toEqual([{ type: 'failed', problem: 'format 9, not 1' }]);
  });
});
