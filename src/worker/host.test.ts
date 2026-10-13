import { describe, expect, it } from 'vitest';
import { bakeSim } from '../../tools/bake/sim.mjs';
import { STEP_SECONDS } from '../sim/config/time';
import { busPositionsAt, prepareGeometry } from '../sim/rules/position';
import { busesOut, dayPlan } from '../sim/rules/schedule';
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

/** Copley to Longwood (the debug line's four stops), as the line tool's clicks. */
const CLICKS: [number, number][] = [[-71.077, 42.3499], [-71.0857, 42.3424], [-71.095, 42.3375], [-71.1035, 42.336]];

/** A point inside the fixture's largest parcel of depot land: halfway from its first corner to the middle of its corners. */
function depotSpot(land: readonly (readonly [number, number])[][]): [number, number] {
  const ring = [...land].sort((a, b) => b.length - a.length)[0]!;
  const mid = ring.reduce(([x, y], p) => [x + p[0] / ring.length, y + p[1] / ring.length], [0, 0]);
  return [(ring[0]![0] + mid[0]!) / 2, (ring[0]![1] + mid[1]!) / 2];
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

  it('runs a line from its depot, and the day card at 24:00 adds up and meets the forecast (M1 and M2, headless)', () => {
    const { host, out, last } = started();
    host.handle({ type: 'place-depot', at: depotSpot(last('ready')!.depotLand as [number, number][][]) });
    host.handle({ type: 'create-line', clicks: CLICKS });
    expect(last('snapshot')!.snapshot.lines[0]).toMatchObject({ name: 'Line 1', buses: 2 });
    expect(last('snapshot')!.snapshot.linesVersion).toBe(last('ready')!.snapshot.linesVersion + 2);
    expect(last('snapshot')!.snapshot.lines[0]!.route.length).toBeGreaterThan(10);
    const line = last('snapshot')!.snapshot.lines[0]!;
    expect(line.forecastCents.deadhead).toBeGreaterThan(0);
    // The page rebuilds the plan the costs bill from the view, and draws its buses on these streets (I6).
    const plan = dayPlan(line.plan);
    expect(busesOut(plan)).toBe(2);
    expect(line.stopAt).toHaveLength(4);
    expect(line.pullOut.at(-1)).toEqual(line.route[0]);
    expect(line.pullIn[0]).toEqual(line.route[0]);
    expect(busPositionsAt(plan, prepareGeometry(line), 12 * 3_600, new Float64Array(24))).toBe(2);
    expect(last('snapshot')!.snapshot.costsPerDayCents).toBe(line.forecastCents.running + line.forecastCents.wages + line.forecastCents.deadhead + 30_000);
    host.handle({ type: 'speed', speed: 3 });
    const cards = () => out.filter((m) => m.type === 'day-card');
    for (let t = 0; cards().length < 2; t += 250) host.tick(t);
    for (const { card } of cards() as Extract<FromWorker, { type: 'day-card' }>[]) {
      expect(card.rows.some((r) => r.kind === 'fares' && r.amountCents > 0)).toBe(true);
      expect(card.rows.reduce((s, r) => s + r.amountCents, 0)).toBe(card.cashAfterCents - card.cashBeforeCents);
    }
    // Day 2 is a whole day: every cost row is the forecast, to the cent (I6). Day 1 opened at 05:00,
    // after the first bus had left the depot.
    const card = last('day-card')!.card;
    expect(card.day).toBe(2);
    const sum = (...kinds: string[]) => card.rows.filter((r) => kinds.includes(r.kind)).reduce((s, r) => s + r.amountCents, 0);
    expect(sum('running')).toBe(-line.forecastCents.running);
    expect(sum('wages')).toBe(-line.forecastCents.wages);
    expect(sum('deadhead')).toBe(-line.forecastCents.deadhead);
    expect(sum('upkeep')).toBe(-30_000);
  });

  it('answers a probe with the people within a walk', () => {
    const { host, last } = started();
    host.handle({ type: 'probe', id: 7, at: [-71.0857, 42.3424] }); // Symphony
    const probe = last('probe')!;
    expect(probe.id).toBe(7);
    expect(probe.people).toBeGreaterThan(3_000);
    expect(probe.people).toBeLessThan(30_000);
  });

  it('sends depot land, answers the depot card with the rule, and places a depot (M2 item 2)', () => {
    const { host, last } = started();
    const land = last('ready')!.depotLand;
    expect(land).toHaveLength(3);
    const at = depotSpot(land as [number, number][][]);
    host.handle({ type: 'depot-site', id: 3, at });
    expect(last('depot-site')).toMatchObject({ id: 3, site: { ok: true, priceCents: 15_000_000 } });
    host.handle({ type: 'place-depot', at });
    expect(last('snapshot')!.snapshot.depots).toEqual([{ id: 1, at }]);
    expect(last('snapshot')!.snapshot.cashCents).toBe(42_720_000 - 15_000_000);
    expect(last('snapshot')!.snapshot.costsPerDayCents).toBe(30_000); // $300 a day of upkeep
    host.handle({ type: 'create-line', clicks: CLICKS });
    expect(last('snapshot')!.snapshot.lines[0]!.forecastCents.deadhead).toBeGreaterThan(0);
    host.handle({ type: 'depot-site', id: 4, at });
    expect(last('depot-site')).toMatchObject({ id: 4, site: { ok: false, reason: 'too_close_to_depot', limitM: 120 } });
    host.handle({ type: 'place-depot', at: [-71.0776, 42.3496] }); // Copley Square
    expect(last('refused')).toEqual({ type: 'refused', command: 'place-depot', reason: 'not_depot_land' });
  });

  it('answers the line tool: the draft card, Create and a headway change (M2 items 3 and 4)', () => {
    const { host, last } = started();
    const clicks = CLICKS;
    host.handle({ type: 'line-draft', id: 1, clicks });
    expect(last('line-draft')!.draft.refusal).toEqual({ reason: 'needs_depot' });
    host.handle({ type: 'place-depot', at: depotSpot(last('ready')!.depotLand as [number, number][][]) });
    host.handle({ type: 'line-draft', id: 2, clicks });
    const draft = last('line-draft')!;
    expect(draft.id).toBe(2);
    expect(draft.draft).toMatchObject({ buses: 2, newStops: 4, priceCents: 20_600_000, refusal: null });
    expect(draft.draft.routeM).toBeGreaterThan(3_400);
    expect(draft.draft.people).toBeGreaterThan(5_000);
    expect(draft.draft.route.length).toBeGreaterThan(10);
    host.handle({ type: 'create-line', clicks });
    const line = last('snapshot')!.snapshot.lines[0]!;
    expect(line).toMatchObject({ name: 'Line 1', buses: 2, headways: { peak: 1_200, offpeak: 1_200, overnight: null } });
    expect(line.cycle).toBeGreaterThan(1_500);
    expect(last('snapshot')!.snapshot.cashCents).toBe(42_720_000 - 15_000_000 - 20_600_000);
    host.handle({ type: 'set-headways', lineId: line.id, headways: { peak: 600, offpeak: 1_200, overnight: null } });
    expect(last('refused')).toEqual({ type: 'refused', command: 'set-headways', reason: 'insufficient_funds', shortCents: 2_380_000 });
  });

  it('refuses a broken sim file in words', () => {
    const out: FromWorker[] = [];
    createHost((m) => out.push(m)).handle({ type: 'init', simText: '{"format":9}', city: CITY, seed: 1 });
    expect(out).toEqual([{ type: 'failed', problem: 'format 9, not 1' }]);
  });
});
