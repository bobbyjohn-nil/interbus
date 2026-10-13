import { describe, expect, it } from 'vitest';
import { bakeSim } from '../../tools/bake/sim.mjs';
import { STEP_SECONDS } from '../sim/config/time';
import { busPositionsAt, prepareGeometry } from '../sim/rules/position';
import { busesOut, dayPlan } from '../sim/rules/schedule';
import type { FromWorker, Snapshot } from '../sim/types';
import { createHost, MAX_SLICE_MS, SPEEDS } from './host';

const baked = bakeSim('boston', 'mini-boston');
const CITY = { id: 'boston', revision: 'mini-boston', hash: baked.sha256 };
const BUILD = { sha: 'c0ffee0'.padEnd(40, '0'), version: '0.0.0' };
const KEY = 'interbus.save.boston';

/** A host started on the fixture from `save` (the page's answer to read-save). */
function started(save: string | null = null) {
  const out: FromWorker[] = [];
  const host = createHost((m) => out.push(m));
  host.handle({ type: 'init', simText: baked.text, city: CITY, seed: 1, build: BUILD });
  host.handle({ type: 'save-text', text: save });
  const last = <T extends FromWorker['type']>(type: T) => out.filter((m) => m.type === type).at(-1) as Extract<FromWorker, { type: T }> | undefined;
  /** Every save the host handed the page, oldest first. */
  const saves = () => out.flatMap((m) => (m.type === 'store' ? m.effects : [])).flatMap((e) => (e.op === 'write' && e.key === KEY ? [e.value] : []));
  return { host, out, last, saves };
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
    // The debug line nets about $1,400 a day: both closed days were in profit (the checklist's step 4).
    expect(last('snapshot')!.snapshot.profitableDays).toBe(2);
  });

  it('founds the company once, by name and colour, and the day card counts its first profitable day', () => {
    const { host, last } = started();
    expect(last('ready')!.snapshot.company.name).toBe('');
    host.handle({ type: 'found', name: 'Back Bay Transit', colour: '#2471a3' });
    expect(last('snapshot')!.snapshot.company).toEqual({ name: 'Back Bay Transit', colour: '#2471a3' });
    host.handle({ type: 'found', name: 'Again', colour: '#2471a3' });
    expect(last('refused')).toEqual({ type: 'refused', command: 'found', reason: 'already_founded' });
    expect(last('snapshot')!.snapshot.profitableDays).toBe(0);
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
    createHost((m) => out.push(m)).handle({ type: 'init', simText: '{"format":9}', city: CITY, seed: 1, build: BUILD });
    expect(out).toEqual([{ type: 'failed', problem: 'format 9, not 1' }]);
  });
});

describe('saves through the page’s store (the M2 spec, item 9; the exit check’s reload)', () => {
  /** A founded company with the debug line, run to its first day card and paused. */
  function played() {
    const game = started();
    game.host.handle({ type: 'found', name: 'Back Bay Transit', colour: '#2471a3' });
    game.host.handle({ type: 'place-depot', at: depotSpot(game.last('ready')!.depotLand as [number, number][][]) });
    game.host.handle({ type: 'create-line', clicks: CLICKS });
    game.host.handle({ type: 'speed', speed: 3 });
    let t = 0;
    for (; !game.last('day-card'); t += 250) game.host.tick(t);
    for (const end = t + 1_000; t < end; t += 37) game.host.tick(t); // into day 2, uneven ticks as a real timer's, ending mid-step
    game.host.handle({ type: 'speed', speed: 0 });
    return game;
  }
  /** A snapshot as a player sees it: linesVersion only counts the page's redraws. */
  const comparable = (s: Snapshot) => ({ ...s, linesVersion: 0 });

  it('asks for its save by key before it starts, and a new game is not saved until founded', () => {
    const out: FromWorker[] = [];
    const host = createHost((m) => out.push(m));
    host.handle({ type: 'init', simText: baked.text, city: CITY, seed: 1, build: BUILD });
    expect(out).toEqual([{ type: 'read-save', key: KEY }]);
    host.handle({ type: 'probe', id: 1, at: [-71.0857, 42.3424] });
    expect(out.at(-1)).toEqual({ type: 'refused', command: 'probe', reason: 'not_started' });
    host.handle({ type: 'save-text', text: null });
    expect(out.at(-1)).toMatchObject({ type: 'ready', load: 'none' });
    expect(out.some((m) => m.type === 'store')).toBe(false);
  });

  it('saves after each command, at each pause and every game hour', () => {
    const game = played();
    // Found, depot, line, speed 3: four; then one per game hour to past 05:00 on day 2; and the pause.
    const hours = Math.floor(game.last('snapshot')!.snapshot.elapsed / 3_600);
    expect(game.saves().length).toBe(4 + hours + 1);
    expect(game.saves().at(-1)).toContain('"Back Bay Transit"');
  });

  it('carries on from a reload exactly where it was paused, and runs on the same as if never saved (I8)', () => {
    const before = played();
    const after = started(before.saves().at(-1)!);
    expect(after.last('ready')!.load).toBe('ok');
    const was = before.last('snapshot')!.snapshot;
    expect(was.day).toBe(2);
    expect(comparable(after.last('ready')!.snapshot)).toEqual(comparable(was));
    for (const game of [before, after]) {
      game.host.handle({ type: 'speed', speed: 2 });
      for (let t = 0; t <= 5_000; t += 37) game.host.tick(1e6 + t);
    }
    expect(comparable(after.last('snapshot')!.snapshot)).toEqual(comparable(before.last('snapshot')!.snapshot));
    expect(after.last('snapshot')!.snapshot.elapsed).toBeGreaterThan(was.elapsed);
  });

  it('sets aside a save from an older build or another bake of the city, starts fresh and says so (D12)', () => {
    const text = played().saves().at(-1)!;
    const older = JSON.stringify({ ...JSON.parse(text), format: 3 });
    const rebaked = text.replace(CITY.hash, 'f'.repeat(64));
    for (const [save, outcome] of [[older, 'older'], [rebaked, 'other-city']] as const) {
      const game = started(save);
      const store = game.out.findIndex((m) => m.type === 'store');
      expect(game.out[store]).toEqual({
        type: 'store',
        effects: [
          { op: 'write', key: `interbus.backup.boston.${outcome}`, value: save },
          { op: 'remove', key: KEY },
        ],
      });
      expect(store).toBeLessThan(game.out.findIndex((m) => m.type === 'ready')); // kept before anything replaces it
      expect(game.last('ready')).toMatchObject({ load: outcome, snapshot: { elapsed: 0, company: { name: '' }, lines: [] } });
    }
  });
});
