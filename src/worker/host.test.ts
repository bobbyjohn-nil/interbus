import { describe, expect, it } from 'vitest';
import { bakeSim } from '../../tools/bake/sim.mjs';
import { STEP_SECONDS } from '../sim/config/time';
import { foundingCapitalCents } from '../sim/economy/ledger';
import { busPositionsAt, prepareGeometry } from '../sim/rules/position';
import { busesOut, dayPlan } from '../sim/rules/schedule';
import type { FromWorker, Snapshot, ToWorker } from '../sim/types';
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
    expect(ready.snapshot).toMatchObject({ elapsed: 0, day: 1, hour: 5, minute: 0, speed: 0, cashCents: 47_454_800, lines: [] });
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
    host.handle({ type: 'speed', speed: 3 });
    for (let t = 0; t <= 1000; t += 50) host.tick(t);
    expect(last('snapshot')!.snapshot.elapsed).toBe(SPEEDS[3]); // one real second at 600x: ten game-minutes
    host.tick(1000 + 60_000); // a minute in a background tab
    const leap = (MAX_SLICE_MS / 1000) * SPEEDS[3];
    expect(last('snapshot')!.snapshot.elapsed - SPEEDS[3]).toBeLessThanOrEqual(leap);
    expect(last('snapshot')!.snapshot.elapsed % STEP_SECONDS).toBe(0);
  });

  it('runs 1x in real time, a game second a second, and draws the part-step so buses glide (D25)', () => {
    const { host, last } = started();
    host.handle({ type: 'speed', speed: 1 });
    for (let t = 0; t <= 30_000; t += 50) host.tick(t);
    expect(last('snapshot')!.snapshot.elapsed).toBe(30); // 30 real seconds at 1x; 18,000 on the old ladder's "1x"
    host.tick(30_200); // a fifth of a second more: the drawn clock moves, the sim's waits for a whole step
    const s = last('snapshot')!.snapshot;
    expect(s.elapsed).toBe(30);
    expect(s.secondOfDay).toBeCloseTo(5 * 3_600 + 30.2, 6);
  });

  it('saves at least every 30 real seconds while time runs, though the game hour has not turned (D25)', () => {
    const { host, saves } = started();
    host.handle({ type: 'speed', speed: 1 });
    const before = saves().length;
    for (let t = 0; t <= 29_000; t += 1_000) host.tick(t);
    expect(saves().length).toBe(before);
    host.tick(31_000);
    expect(saves().length).toBe(before + 1);
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
    // Its costs, the depot's $300 and four Signs' $4 each (D25).
    expect(last('snapshot')!.snapshot.costsPerDayCents).toBe(line.forecastCents.running + line.forecastCents.wages + line.forecastCents.deadhead + 30_000 + 1_600);
    host.handle({ type: 'speed', speed: 5 });
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

  it('answers a home probe with the people within a walk, and a job probe with the jobs (D25)', () => {
    const { host, last } = started();
    host.handle({ type: 'probe', id: 7, at: [-71.0857, 42.3424], kind: 'home' }); // Symphony
    const probe = last('probe')!;
    expect(probe.id).toBe(7);
    expect(probe.within).toBeGreaterThan(3_000);
    expect(probe.within).toBeLessThan(30_000);
    host.handle({ type: 'probe', id: 8, at: [-71.0775, 42.3499], kind: 'job' }); // Copley
    const jobs = last('probe')!;
    expect(jobs.id).toBe(8);
    expect(jobs.within).toBeGreaterThan(5_000);
    expect(jobs.within).not.toBe(probe.within);
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
    expect(last('snapshot')!.snapshot.cashCents).toBe(47_454_800 - 15_000_000);
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
    expect(draft.draft.routeM).toBeGreaterThan(3_200);
    expect(draft.draft.people).toBeGreaterThan(5_000);
    expect(draft.draft.route.length).toBeGreaterThan(10);
    host.handle({ type: 'create-line', clicks });
    const line = last('snapshot')!.snapshot.lines[0]!;
    expect(line).toMatchObject({ name: 'Line 1', buses: 2, headways: { peak: 1_200, offpeak: 1_200, overnight: null } });
    expect(line.cycle).toBeGreaterThan(1_400); // 1,457 s; over 1,500 until buses drove one-way streets both ways (2026-10-14)
    expect(last('snapshot')!.snapshot.cashCents).toBe(47_454_800 - 15_000_000 - 20_600_000);
    // Finance (the M3 spec, item 6; D25): the depot, the line's stops and its buses, each a row of its own kind.
    const bought = (kind: string) => last('snapshot')!.snapshot.finance.rows.find((r) => r.kind === kind);
    expect([bought('depots'), bought('stops'), bought('buses')]).toMatchObject([
      { todayCents: -15_000_000, forecastCents: null },
      { todayCents: -1_600_000, forecastCents: null },
      { todayCents: -19_000_000, forecastCents: null },
    ]);
    // Every 7½ minutes at peak needs two more Sparrows: $190k against $118,548, the rest on the credit line (D10).
    host.handle({ type: 'set-headways', lineId: line.id, headways: { peak: 450, offpeak: 1_200, overnight: null } });
    expect(last('snapshot')!.snapshot).toMatchObject({ cashCents: -7_145_200, lines: [{ buses: 4 }], floor: null });
  });

  it('places a stop on its own, edits a route through it on the editor’s card and Set route, and takes down only a lone stop (D25)', () => {
    const { host, last } = started();
    host.handle({ type: 'place-depot', at: depotSpot(last('ready')!.depotLand as [number, number][][]) });
    const huntington: [number, number] = [-71.0903, 42.33995]; // between Symphony and the MFA, over 250 m from each
    host.handle({ type: 'stop-site', id: 5, at: huntington });
    expect(last('stop-site')).toMatchObject({ id: 5, site: { ok: true, priceCents: 400_000 } });
    host.handle({ type: 'place-stop', at: huntington });
    const lone = last('snapshot')!.snapshot.stops[0]!;
    expect(lone).toMatchObject({ lineIds: [], quiet: false, loss: false });
    host.handle({ type: 'create-line', clicks: CLICKS });
    const line = last('snapshot')!.snapshot.lines[0]!;
    const symphony = line.stopIds[1]!;
    host.handle({ type: 'stop-site', id: 6, at: CLICKS[1]! });
    expect(last('stop-site')).toMatchObject({ id: 6, site: { ok: false, reason: 'stop_near', limitM: 250, stopId: symphony } });
    // The editor's card: Symphony swapped for the lone stop, nothing bought, Symphony down for $2k back.
    const route: [number, number][] = [CLICKS[0]!, lone.at as [number, number], CLICKS[2]!, CLICKS[3]!];
    host.handle({ type: 'line-draft', id: 7, clicks: route, route: line.id });
    expect(last('line-draft')!.draft).toMatchObject({ newStops: 0, priceCents: 0, refusal: null, edit: { removed: [symphony], refundCents: 200_000 } });
    const cash = last('snapshot')!.snapshot.cashCents;
    host.handle({ type: 'set-route', lineId: line.id, points: route });
    const after = last('snapshot')!.snapshot;
    expect(after.lines[0]!.stopIds).toEqual([line.stopIds[0], lone.id, line.stopIds[2], line.stopIds[3]]);
    expect(after.stops.some((s) => s.id === symphony)).toBe(false);
    expect(after.cashCents).toBe(cash + 200_000);
    host.handle({ type: 'take-down-stop', stopId: lone.id });
    expect(last('refused')).toEqual({ type: 'refused', command: 'take-down-stop', reason: 'stop_in_use', limit: 1 });
    host.handle({ type: 'line-draft', id: 8, clicks: route, route: line.id });
    expect(last('line-draft')!.draft.refusal).toEqual({ reason: 'no_change' });
  });

  it('prices a model change on the line card’s rule: the starter cannot yet afford Metro 40s, and the Goliath is locked (the M3 spec, item 2)', () => {
    const { host, last } = started();
    host.handle({ type: 'place-depot', at: depotSpot(last('ready')!.depotLand as [number, number][][]) });
    host.handle({ type: 'create-line', clicks: CLICKS });
    const line = last('snapshot')!.snapshot.lines[0]!;
    host.handle({ type: 'set-model', lineId: line.id, model: 'goliath' });
    expect(last('refused')).toEqual({ type: 'refused', command: 'set-model', reason: 'model_locked' });
    // Two Metro 40s are $520k against $95k back for the Sparrows; $118,548 is left after the starter, and $150k of credit (D10).
    host.handle({ type: 'set-model', lineId: line.id, model: 'metro40' });
    expect(last('refused')).toEqual({ type: 'refused', command: 'set-model', reason: 'insufficient_funds', shortCents: 52_000_000 - 9_500_000 - 11_854_800 - 15_000_000 });
    expect(last('snapshot')!.snapshot.lines[0]).toMatchObject({ model: 'sparrow', buses: 2 });
  });

  it('sets a line’s fare on the card’s rule and answers its fare band (the M3 spec, item 4)', () => {
    const { host, last } = started();
    host.handle({ type: 'place-depot', at: depotSpot(last('ready')!.depotLand as [number, number][][]) });
    host.handle({ type: 'create-line', clicks: CLICKS });
    const line = last('snapshot')!.snapshot.lines[0]!;
    expect(line.fareCents).toBe(225);
    host.handle({ type: 'fare-band', id: 7, lineId: line.id });
    expect(last('fare-band')).toMatchObject({ id: 7, lineId: line.id, band: { bestCents: 175, fromCents: 175, toCents: 200 } });
    host.handle({ type: 'set-fare', lineId: line.id, fareCents: 230 });
    expect(last('refused')).toEqual({ type: 'refused', command: 'set-fare', reason: 'fare_not_a_step', limit: 25 });
    host.handle({ type: 'set-fare', lineId: line.id, fareCents: 175 });
    const cheaper = last('snapshot')!.snapshot;
    expect(cheaper.lines[0]).toMatchObject({ fareCents: 175 });
    expect(cheaper.lines[0]!.ridersPerDay).toBeGreaterThan(line.ridersPerDay);
    expect(cheaper.linesVersion).toBeGreaterThan(last('ready')!.snapshot.linesVersion);
  });

  it('sends every stop’s day with the lines: boardings, alightings, net and flags (the M3 spec, item 5)', () => {
    const { host, last } = started();
    host.handle({ type: 'place-depot', at: depotSpot(last('ready')!.depotLand as [number, number][][]) });
    host.handle({ type: 'create-line', clicks: CLICKS });
    const { lines, stops } = last('snapshot')!.snapshot;
    expect(stops.map((s) => s.id)).toEqual(lines[0]!.stopIds);
    expect(stops.every((s) => s.lineIds.length === 1 && s.lineIds[0] === lines[0]!.id)).toBe(true);
    expect(stops.reduce((sum, s) => sum + s.boardings, 0)).toBeCloseTo(lines[0]!.ridersPerDay, 6);
    expect(stops.some((s) => s.quiet || s.loss)).toBe(false);
  });

  it('sets a stop’s tier on the stop card’s rule: a Shelter for $12k, an Interchange refused for one line (the M3 spec, item 5)', () => {
    const { host, last } = started();
    host.handle({ type: 'place-depot', at: depotSpot(last('ready')!.depotLand as [number, number][][]) });
    host.handle({ type: 'create-line', clicks: CLICKS });
    const before = last('snapshot')!.snapshot;
    const symphony = before.lines[0]!.stopIds[1]!;
    host.handle({ type: 'set-stop-tier', stopId: symphony, tier: 4 });
    expect(last('refused')).toEqual({ type: 'refused', command: 'set-stop-tier', reason: 'needs_lines', limit: 3 });
    host.handle({ type: 'set-stop-tier', stopId: symphony, tier: 2 });
    const after = last('snapshot')!.snapshot;
    expect(after.stops.find((s) => s.id === symphony)).toMatchObject({ tier: 2 });
    expect(after.cashCents).toBe(before.cashCents - 1_200_000);
    expect(after.lines[0]!.ridersPerDay).toBeGreaterThan(before.lines[0]!.ridersPerDay);
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
    game.host.handle({ type: 'speed', speed: 5 });
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
    host.handle({ type: 'probe', id: 1, at: [-71.0857, 42.3424], kind: 'home' });
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
      game.host.handle({ type: 'speed', speed: 4 });
      for (let t = 0; t <= 5_000; t += 37) game.host.tick(1e6 + t);
    }
    expect(comparable(after.last('snapshot')!.snapshot)).toEqual(comparable(before.last('snapshot')!.snapshot));
    expect(after.last('snapshot')!.snapshot.elapsed).toBeGreaterThan(was.elapsed);
  });

  it('sets aside a save from an older build or another city, starts fresh and says so (D12)', () => {
    const text = played().saves().at(-1)!;
    const older = JSON.stringify({ ...JSON.parse(text), format: 3 });
    const elsewhere = text.replace('"id":"boston"', '"id":"worcester"');
    for (const [save, outcome, key] of [[older, 'older', 'older-3'], [elsewhere, 'other-city', 'other-city']] as const) {
      const game = started(save);
      const store = game.out.findIndex((m) => m.type === 'store');
      expect(game.out[store]).toEqual({
        type: 'store',
        effects: [
          { op: 'write', key: `interbus.backup.boston.${key}`, value: save },
          { op: 'remove', key: KEY },
        ],
      });
      expect(store).toBeLessThan(game.out.findIndex((m) => m.type === 'ready')); // kept before anything replaces it
      expect(game.last('ready')).toMatchObject({ load: outcome, snapshot: { elapsed: 0, company: { name: '' }, lines: [] } });
    }
  });

  // The r1→r2 save test (the M3 spec, item 8), which replaces M2's setting another bake aside. Shown
  // failing (TS-04) with another bake set aside again.
  it('carries a save from another bake of the city onto this one, saved at once under this bake’s name', () => {
    const before = played();
    const text = before.saves().at(-1)!;
    const kept = before.last('snapshot')!.snapshot;
    const game = started(text.replace(CITY.hash, 'f'.repeat(64)));
    expect(game.last('ready')).toMatchObject({ load: 'rebaked', snapshot: { elapsed: kept.elapsed, cashCents: kept.cashCents, company: kept.company } });
    expect(game.last('ready')!.snapshot.stops.map((s) => s.at)).toEqual(kept.stops.map((s) => s.at)); // the same streets, so no stop moved
    expect(game.last('ready')!.snapshot.lines.map((l) => l.ridersPerDay)).toEqual(kept.lines.map((l) => l.ridersPerDay));
    const resaved = JSON.parse(game.saves().at(-1)!) as { data: { city: { hash: string } } };
    expect(resaved.data.city.hash).toBe(CITY.hash);
  });

  it('sets aside a save from another bake whose stops find no street on this one, and says so', () => {
    const text = played().saves().at(-1)!;
    const save = JSON.parse(text.replace(CITY.hash, 'f'.repeat(64))) as { data: { stops: { lon: number; lat: number }[] } };
    Object.assign(save.data.stops[0]!, { lon: -71.0, lat: 42.0 }); // far beyond the map's streets
    const raw = JSON.stringify(save);
    const game = started(raw);
    expect(game.out.find((m) => m.type === 'store')).toEqual({
      type: 'store',
      effects: [
        { op: 'write', key: 'interbus.backup.boston.other-city', value: raw },
        { op: 'remove', key: KEY },
      ],
    });
    expect(game.last('ready')).toMatchObject({ load: 'off-street', snapshot: { elapsed: 0, company: { name: '' }, lines: [] } });
  });
});

// I9 (the M3 spec, item 7): every command taken since the last unpause can be taken back, newest
// first, to the cent; once time has run, an undo is refused in words. Shown failing (TS-04) with the
// stack kept across an unpause, as V2's undo was: the undo then rewinds the income earned since.
describe('undo while paused (I9)', () => {
  function foundedWithSaves() {
    const run = started();
    run.host.handle({ type: 'found', name: 'Back Bay Transit', colour: '#2471a3' });
    return run;
  }

  it('takes back every command since the pause, newest first and named, and each save is as it was', () => {
    const { host, last, saves } = foundedWithSaves();
    const [founded] = saves().slice(-1);
    host.handle({ type: 'place-depot', at: depotSpot(last('ready')!.depotLand as [number, number][][]) });
    host.handle({ type: 'create-line', clicks: CLICKS });
    const line = last('snapshot')!.snapshot.lines[0]!;
    host.handle({ type: 'set-fare', lineId: line.id, fareCents: 175 });
    const [afterDepot, afterLine] = saves().slice(-3, -1);
    expect(last('snapshot')!.snapshot.undo).toEqual({ command: 'set-fare', subject: 'Line 1' });
    host.handle({ type: 'undo' });
    expect(saves().at(-1)).toBe(afterLine);
    expect(last('snapshot')!.snapshot.lines[0]!.fareCents).toBe(225);
    expect(last('snapshot')!.snapshot.undo).toEqual({ command: 'create-line', subject: 'Line 1' });
    host.handle({ type: 'undo' });
    expect(saves().at(-1)).toBe(afterDepot);
    expect(last('snapshot')!.snapshot).toMatchObject({ lines: [], cashCents: 47_454_800 - 15_000_000, undo: { command: 'place-depot', subject: 'Depot 1' } });
    host.handle({ type: 'undo' });
    expect(saves().at(-1)).toBe(founded);
    expect(last('snapshot')!.snapshot).toMatchObject({ depots: [], cashCents: 47_454_800, undo: null });
    host.handle({ type: 'undo' });
    expect(last('refused')).toEqual({ type: 'refused', command: 'undo', reason: 'nothing_to_undo' });
  });

  it('refuses an undo once time has run, and keeps what the line earned meanwhile', () => {
    const { host, last } = foundedWithSaves();
    host.handle({ type: 'place-depot', at: depotSpot(last('ready')!.depotLand as [number, number][][]) });
    host.handle({ type: 'create-line', clicks: CLICKS });
    host.handle({ type: 'speed', speed: 5 });
    for (let t = 0; t <= 4_000; t += 50) host.tick(t);
    host.handle({ type: 'speed', speed: 0 });
    const paused = last('snapshot')!.snapshot;
    expect(paused.elapsed).toBeGreaterThan(0);
    expect(paused.undo).toBeNull();
    host.handle({ type: 'undo' });
    expect(last('refused')).toEqual({ type: 'refused', command: 'undo', reason: 'time_has_run' });
    expect(last('snapshot')!.snapshot).toMatchObject({ cashCents: paused.cashCents, elapsed: paused.elapsed, lines: [{ id: paused.lines[0]!.id }] });
  });

  it('keeps no command taken while time runs', () => {
    const { host, last } = foundedWithSaves();
    host.handle({ type: 'speed', speed: 3 });
    host.handle({ type: 'place-depot', at: depotSpot(last('ready')!.depotLand as [number, number][][]) });
    host.handle({ type: 'speed', speed: 0 });
    expect(last('snapshot')!.snapshot.undo).toBeNull();
    host.handle({ type: 'undo' });
    expect(last('refused')).toMatchObject({ reason: 'nothing_to_undo' });
    expect(last('snapshot')!.snapshot.depots).toHaveLength(1);
  });
});

// Save slots, export and import (the M3 spec, item 8). Shown failing (TS-04) with the live save
// written before the import is read, as V1 did (`Intralines@7af45b1:src/game/store.ts:1883-1901`):
// a file the game cannot read then costs the player their autosave.
describe('save slots, export and import', () => {
  /** A host with a page's store: its store effects carried out and its read-keys answered, in order. */
  function withStore(now?: () => number) {
    const store = new Map<string, string>();
    const out: FromWorker[] = [];
    const host = createHost((m) => out.push(m), now);
    let seen = 0;
    const pump = () => {
      while (seen < out.length) {
        const m = out[seen++]!;
        if (m.type === 'store') for (const e of m.effects) void (e.op === 'write' ? store.set(e.key, e.value) : store.delete(e.key));
        else if (m.type === 'read-keys') host.handle({ type: 'key-texts', id: m.id, texts: m.keys.map((k) => store.get(k) ?? null) });
      }
    };
    const send = (m: ToWorker) => {
      host.handle(m);
      pump();
    };
    send({ type: 'init', simText: baked.text, city: CITY, seed: 1, build: BUILD });
    send({ type: 'save-text', text: null });
    const last = <T extends FromWorker['type']>(type: T) => out.filter((m) => m.type === type).at(-1) as Extract<FromWorker, { type: T }> | undefined;
    send({ type: 'found', name: 'Back Bay Transit', colour: '#2471a3' });
    send({ type: 'place-depot', at: depotSpot(last('ready')!.depotLand as [number, number][][]) });
    return { send, last, store };
  }

  it('saves into a slot, lists what each slot holds, and loads it back over the game and its autosave', () => {
    const { send, last, store } = withStore();
    send({ type: 'save-slot', slot: 1 });
    expect(store.has('interbus.slot.boston.1')).toBe(true);
    expect(last('slots')!.slots).toEqual([
      { slot: 1, about: { day: 1, hour: 5, minute: 0, company: 'Back Bay Transit', cashCents: 32_454_800, lines: 0, buses: 0, savedAt: null }, readable: true },
      { slot: 2, about: null, readable: true },
      { slot: 3, about: null, readable: true },
    ]);
    send({ type: 'create-line', clicks: CLICKS });
    expect(last('snapshot')!.snapshot.lines).toHaveLength(1);
    send({ type: 'load-slot', slot: 1 });
    expect(last('loaded')).toEqual({ type: 'loaded', from: 'slot', load: 'ok' });
    expect(last('snapshot')!.snapshot).toMatchObject({ lines: [], cashCents: 32_454_800, speed: 0, undo: null });
    expect(store.get(KEY)).toBe(store.get('interbus.slot.boston.1'));
    send({ type: 'load-slot', slot: 2 });
    expect(last('refused')).toEqual({ type: 'refused', command: 'load-slot', reason: 'empty_slot' });
  });

  // The save list (the M5 spec, item 4). Shown failing (TS-04) with the slot written without the
  // page's clock, with delete-slot ignored, and with the set-aside keys left unread.
  it('names each slot’s buses and when it was saved, and deletes a slot', () => {
    const at = Date.UTC(2026, 9, 13, 20, 41);
    const { send, last, store } = withStore(() => at);
    send({ type: 'create-line', clicks: CLICKS });
    send({ type: 'save-slot', slot: 2 });
    expect(last('slots')!.slots[1]).toMatchObject({ slot: 2, about: { lines: 1, buses: 2, savedAt: at }, readable: true });
    expect(JSON.parse(store.get(KEY)!).savedAt).toBe(at); // the autosave is stamped too
    send({ type: 'delete-slot', slot: 2 });
    expect(store.has('interbus.slot.boston.2')).toBe(false);
    expect(last('slots')!.slots[1]).toEqual({ slot: 2, about: null, readable: true });
    send({ type: 'delete-slot', slot: 7 });
    expect(last('refused')).toEqual({ type: 'refused', command: 'delete-slot', reason: 'no_such_slot' });
  });

  it('lists a save set aside by a new build, hands it over as a file, and deletes it', () => {
    const { send, last, store } = withStore();
    send({ type: 'slots' });
    expect(last('slots')!.setAside).toEqual([]);
    store.set('interbus.backup.boston.older', '{"format":1}');
    send({ type: 'slots' });
    expect(last('slots')!.setAside).toEqual(['older']);
    send({ type: 'export-set-aside', why: 'older' });
    expect(last('export')).toEqual({ type: 'export', name: 'interbus-boston-set-aside-older.json', text: '{"format":1}' });
    send({ type: 'delete-set-aside', why: 'older' });
    expect(store.has('interbus.backup.boston.older')).toBe(false);
    expect(last('slots')!.setAside).toEqual([]);
  });

  // Home's New game (the M5 spec, item 3). Shown failing (TS-04) with the new game left unsaved: a
  // reload then brought the old company back.
  it('starts an unnamed company in place of this one, saved at once, its slots kept', () => {
    const { send, last, store } = withStore();
    send({ type: 'create-line', clicks: CLICKS });
    send({ type: 'save-slot', slot: 1 });
    send({ type: 'new-game' });
    expect(last('snapshot')!.snapshot).toMatchObject({ company: { name: '' }, lines: [], depots: [], day: 1 });
    expect(JSON.parse(store.get(KEY)!).data.company.name).toBe('');
    expect(store.has('interbus.slot.boston.1')).toBe(true);
    expect(last('loaded')).toEqual({ type: 'loaded', from: 'new', load: 'none' });
    send({ type: 'found', name: 'Kenmore Lines', colour: '#2471a3' });
    expect(last('snapshot')!.snapshot.company.name).toBe('Kenmore Lines');
  });

  it('exports this game as a file that imports back to the same game', () => {
    const { send, last, store } = withStore();
    send({ type: 'export' });
    const file = last('export')!;
    expect(file.name).toBe('interbus-boston-day-1.json');
    expect(file.text).toBe(store.get(KEY));
    send({ type: 'create-line', clicks: CLICKS });
    send({ type: 'import', text: file.text });
    expect(last('loaded')).toEqual({ type: 'loaded', from: 'file', load: 'ok' });
    expect(last('snapshot')!.snapshot).toMatchObject({ lines: [], depots: [{}], cashCents: 32_454_800 });
  });

  it('refuses a file it cannot read, or one from a newer build, and keeps the game and its autosave', () => {
    const { send, last, store } = withStore();
    const live = store.get(KEY);
    send({ type: 'import', text: 'not a save' });
    expect(last('refused')).toEqual({ type: 'refused', command: 'import', reason: 'save_unreadable' });
    send({ type: 'import', text: JSON.stringify({ ...JSON.parse(live!), format: 99 }) });
    expect(last('refused')).toEqual({ type: 'refused', command: 'import', reason: 'save_newer' });
    expect(store.get(KEY)).toBe(live);
    expect(last('snapshot')!.snapshot).toMatchObject({ depots: [{}], cashCents: 32_454_800 });
  });
});

// The failure floor through the worker (the M3 spec, item 10; exit check 4): the countdown in the
// snapshot, time stopped once the run ends, and Restart this quarter from the save written as the
// quarter began: at founding for quarter 1, at a quarter's close, or when a slot or file was loaded.
describe('the failure floor', () => {
  function founded() {
    const store = new Map<string, string>();
    const out: FromWorker[] = [];
    const host = createHost((m) => out.push(m));
    let seen = 0;
    const send = (m: ToWorker) => {
      host.handle(m);
      while (seen < out.length) {
        const n = out[seen++]!;
        if (n.type === 'store') for (const e of n.effects) void (e.op === 'write' ? store.set(e.key, e.value) : store.delete(e.key));
        else if (n.type === 'read-keys') host.handle({ type: 'key-texts', id: n.id, texts: n.keys.map((k) => store.get(k) ?? null) });
      }
    };
    send({ type: 'init', simText: baked.text, city: CITY, seed: 1, build: BUILD });
    send({ type: 'save-text', text: null });
    send({ type: 'found', name: 'Back Bay Transit', colour: '#2471a3' });
    const last = <T extends FromWorker['type']>(type: T) => out.filter((m) => m.type === type).at(-1) as Extract<FromWorker, { type: T }> | undefined;
    /** This game, owing $200k, with `closes` day closes below the floor behind it, as a save file; `elapsed` moves its clock. */
    const owing = (closes: number, elapsed = 0) => {
      const save = JSON.parse(store.get(KEY)!) as {
        data: { clock: { elapsed: number }; closesBelowFloor: number; ledger: { day: number; kind: string; amountCents: number; lineId: null }[] };
      };
      save.data.clock.elapsed = elapsed;
      save.data.closesBelowFloor = closes;
      save.data.ledger.push({ day: 1, kind: 'buses', amountCents: -(foundingCapitalCents() + 20_000_000), lineId: null });
      return JSON.stringify(save);
    };
    return { send, last, store, owing, host };
  }

  it('counts down from five closes once cash is below −$150k', () => {
    const { send, last, owing } = founded();
    expect(last('snapshot')!.snapshot.floor).toBeNull();
    send({ type: 'import', text: owing(0) });
    expect(last('snapshot')!.snapshot.floor).toEqual({ closesLeft: 5, ended: false });
    send({ type: 'import', text: owing(3) });
    expect(last('snapshot')!.snapshot.floor).toEqual({ closesLeft: 2, ended: false });
  });

  it('restarts quarter 1 from its founding', () => {
    const { send, last } = founded();
    send({ type: 'place-depot', at: depotSpot(last('ready')!.depotLand as [number, number][][]) });
    send({ type: 'restart-quarter' });
    expect(last('loaded')).toEqual({ type: 'loaded', from: 'quarter', load: 'ok' });
    expect(last('snapshot')!.snapshot).toMatchObject({ elapsed: 0, cashCents: 47_454_800, depots: [], company: { name: 'Back Bay Transit' } });
  });

  it('ends the run on the fifth close: time stops, and Restart this quarter reopens where the game was loaded', () => {
    const { send, last, owing, host } = founded();
    send({ type: 'import', text: owing(4) });
    send({ type: 'speed', speed: 5 });
    for (let t = 0; !last('snapshot')!.snapshot.floor?.ended && t < 600_000; t += 250) host.tick(t);
    const ended = last('snapshot')!.snapshot;
    expect(ended).toMatchObject({ speed: 0, floor: { closesLeft: 0, ended: true } });
    send({ type: 'speed', speed: 3 });
    expect(last('refused')).toEqual({ type: 'refused', command: 'speed', reason: 'run_ended' });
    send({ type: 'restart-quarter' });
    expect(last('loaded')).toEqual({ type: 'loaded', from: 'quarter', load: 'ok' });
    expect(last('snapshot')!.snapshot).toMatchObject({ elapsed: 0, cashCents: -20_000_000, floor: { closesLeft: 1, ended: false } });
  });

  it('never keeps an ended game as the quarter to restart: not when the run ends on the quarter’s last close, nor when one is loaded', () => {
    const { send, last, owing, host } = founded();
    // Day 8 at 23:50, the quarter's last close ten minutes off, with four closes below behind it.
    const lastEvening = 7 * 86_400 + 18 * 3_600 + 50 * 60;
    send({ type: 'import', text: owing(4, lastEvening) });
    send({ type: 'speed', speed: 5 });
    for (let t = 0; !last('snapshot')!.snapshot.floor?.ended && t < 60_000; t += 250) host.tick(t);
    expect(last('day-card')!.card.report).not.toBeNull();
    expect(last('snapshot')!.snapshot.floor).toEqual({ closesLeft: 0, ended: true });
    send({ type: 'restart-quarter' });
    expect(last('snapshot')!.snapshot).toMatchObject({ elapsed: lastEvening, floor: { closesLeft: 1, ended: false } });

    send({ type: 'import', text: owing(5) });
    expect(last('snapshot')!.snapshot.floor).toEqual({ closesLeft: 0, ended: true });
    send({ type: 'restart-quarter' });
    expect(last('snapshot')!.snapshot).toMatchObject({ elapsed: lastEvening, floor: { closesLeft: 1, ended: false } });
  });
});

describe('HEADWAY contracts (the M3 spec, item 11)', () => {
  it('offers three at founding, shows today’s figure against each ask, and takes one with a click that undo puts back', () => {
    const { host, last, saves } = started();
    host.handle({ type: 'found', name: 'Back Bay Transit', colour: '#2471a3' });
    const offers = last('snapshot')!.snapshot.contracts;
    expect(offers.map((c) => c.landmark).sort()).toEqual(['Copley Square', 'Kenmore', 'Longwood']);
    expect(offers.every((c) => !c.held && c.figure === null && !c.met && c.reachM === 650)).toBe(true);
    host.handle({ type: 'place-depot', at: depotSpot(last('ready')!.depotLand as [number, number][][]) });
    host.handle({ type: 'create-line', clicks: CLICKS });
    const longwood = last('snapshot')!.snapshot.contracts.find((c) => c.landmark === 'Longwood')!;
    // The line every 20 minutes calls at Longwood: a bus every 20 minutes, and a few riders boarding there.
    if (longwood.kind === 'headway') expect(longwood.figure).toBe(1_200);
    else expect(longwood.figure).toBeGreaterThan(0);
    const before = saves().at(-1);
    host.handle({ type: 'accept-contract', contractId: longwood.id });
    const taken = last('snapshot')!.snapshot;
    expect(taken.contracts.find((c) => c.id === longwood.id)).toMatchObject({ held: true, daysMet: 0, daysLeft: 16 });
    expect(taken.contractTaken).toBe(true);
    expect(taken.undo).toEqual({ command: 'accept-contract', subject: 'Longwood' });
    host.handle({ type: 'accept-contract', contractId: longwood.id });
    expect(last('refused')).toEqual({ type: 'refused', command: 'accept-contract', reason: 'already_held' });
    host.handle({ type: 'undo' });
    expect(saves().at(-1)).toBe(before);
    expect(last('snapshot')!.snapshot).toMatchObject({ contractTaken: false });
    expect(last('snapshot')!.snapshot.contracts.find((c) => c.id === longwood.id)!.held).toBe(false);
  });
});

describe('city events (the M4 spec, item 2)', () => {
  it('shows roadworks hatched the day they are rolled and solid while on, says so on the day card, and the line card’s round trip grows only while they are on', () => {
    const { host, last, out } = started();
    host.handle({ type: 'found', name: 'Back Bay Transit', colour: '#2471a3' });
    host.handle({ type: 'place-depot', at: depotSpot(last('ready')!.depotLand as [number, number][][]) });
    host.handle({ type: 'create-line', clicks: CLICKS });
    const calm = last('snapshot')!.snapshot.lines[0]!.cycles;
    // Day n closes at 24:00, 19 hours after founding's 05:00 and whole days after that.
    const closeOf = (n: number) => 68_400 + (n - 1) * 86_400;
    const now = () => {
      host.handle({ type: 'speed', speed: 0 });
      return last('snapshot')!.snapshot;
    };
    const news = (what: 'tomorrow' | 'over') => out.flatMap((m) => (m.type === 'day-card' ? m.card.events.filter((e) => e.news === what).map((e) => ({ day: m.card.day, ...e })) : []));
    let day = 1;
    for (; day <= 60 && news('tomorrow').length === 0; day++) host.advanceTo(closeOf(day));
    const rolled = news('tomorrow')[0];
    if (!rolled) throw new Error('no roadworks in 60 days');
    const pending = now();
    expect(pending.event).toMatchObject({ kind: 'roadworks', phase: 'pending', street: rolled.street, daysLeft: rolled.days });
    expect(pending.event!.path.length).toBeGreaterThan(0);
    expect(pending.lines[0]!.cycles).toEqual(calm);
    host.advanceTo(closeOf(day++));
    const on = now();
    expect(on.event).toMatchObject({ phase: 'on', daysLeft: rolled.days });
    expect(on.lines[0]!.worksM).toBeGreaterThan(0);
    expect(on.lines[0]!.cycles.peak).toBeGreaterThan(calm.peak);
    for (let n = 0; n < rolled.days; n++) host.advanceTo(closeOf(day++));
    expect(news('over')).toEqual([{ ...rolled, news: 'over', day: day - 1 }]);
    const over = now();
    expect(over.event).toBeNull();
    expect(over.lines[0]!.cycles).toEqual(calm);
  });
});
