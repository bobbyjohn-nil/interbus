import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { bakeSim } from '../../tools/bake/sim.mjs';
import { STEP_SECONDS } from '../sim/config/time';
import { foundingCapitalCents } from '../sim/economy/ledger';
import { busPositionsAt, prepareGeometry } from '../sim/rules/position';
import { busesOut, dayPlan } from '../sim/rules/schedule';
import { IMPORT_COUNTER_LIMIT, SAVE_FORMAT } from '../sim/save/save';
import { KENMORE } from '../sim/testing';
import type { FromWorker, Snapshot, ToWorker } from '../sim/types';
import type { Sim } from '../ui/game/useSim';
import { Finance } from '../ui/shell/Finance';
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

/** A point inside the fixture's largest parcel of depot land (or the next largest, with `parcel` 1 and up): halfway from its first corner to the middle of its corners. */
function depotSpot(land: readonly (readonly [number, number])[][], parcel = 0): [number, number] {
  const ring = [...land].sort((a, b) => b.length - a.length)[parcel]!;
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

  it('changes nothing for the speed already running: a held key’s repeats keep the clock, and save and record nothing', () => {
    // Two games 3 real seconds at 5,400x in the worker's 50 ms ticks: 5 pressed once, and 5 held, its repeats every 33 ms
    // (about 30 a second, a common rate). Shown failing (TS-04) on abb5f2f, where each repeat dropped the clock's slice and
    // saved: the held game moved 0 game seconds, against 16,200, with 92 saves against 6 and 91 speed commands recorded.
    const [once, held] = [started(), started()];
    for (const game of [once, held]) {
      game.host.handle({ type: 'found', name: 'Back Bay Transit', colour: '#2471a3' });
      game.host.handle({ type: 'speed', speed: 5 });
    }
    for (let t = 0, next = 33; t <= 3_000; t++) {
      if (t === next) {
        held.host.handle({ type: 'speed', speed: 5 });
        next += 33;
      }
      if (t % 50 === 0) for (const game of [once, held]) game.host.tick(t);
    }
    expect(once.last('snapshot')!.snapshot.elapsed).toBe(3 * SPEEDS[5]);
    expect(held.last('snapshot')!.snapshot.elapsed).toBe(once.last('snapshot')!.snapshot.elapsed);
    expect(held.saves()).toEqual(once.saves());
    held.host.handle({ type: 'export-session' });
    const session = JSON.parse(held.last('export')!.text) as { commands: { message: ToWorker }[] };
    expect(session.commands.map((c) => c.message)).toEqual([{ type: 'speed', speed: 5 }]);
    // A pause, and a pause again (Home's), still saves where it stopped.
    const paused = held.saves().length;
    held.host.handle({ type: 'speed', speed: 0 });
    held.host.handle({ type: 'speed', speed: 0 });
    expect(held.saves().length).toBe(paused + 2);
  });

  it('runs a line from its depot, and the day card at 24:00 adds up and meets the forecast (M1 and M2, headless)', () => {
    const { host, out, last } = started();
    host.handle({ type: 'place-depot', at: depotSpot(last('ready')!.depotLand as [number, number][][]) });
    host.handle({ type: 'create-line', clicks: CLICKS });
    expect(last('snapshot')!.snapshot.lines[0]).toMatchObject({ name: 'Line 1', buses: 2 });
    expect(last('snapshot')!.snapshot.linesVersion).toBe(last('ready')!.snapshot.linesVersion + 2);
    expect(last('snapshot')!.snapshot.lines[0]!.route.length).toBeGreaterThan(10);
    const line = last('snapshot')!.snapshot.lines[0]!;
    // Its day's costs, as Finance's Lines and its forecast column have them.
    const costs = last('snapshot')!.snapshot.finance.lines[0]!.forecastCents;
    expect(costs.deadhead).toBeGreaterThan(0);
    // The page rebuilds the plan the costs bill from the view, and draws its buses on these streets (I6).
    const plan = dayPlan(line.plan);
    expect(busesOut(plan)).toBe(2);
    expect(line.stopAt).toHaveLength(4);
    expect(line.pullOut.at(-1)).toEqual(line.route[0]);
    expect(line.pullIn[0]).toEqual(line.route[0]);
    expect(busPositionsAt(plan, prepareGeometry(line), 12 * 3_600, new Float64Array(24))).toBe(2);
    // Its costs, the depot's $300 and four Signs' $4 each (D25).
    expect(last('snapshot')!.snapshot.costsPerDayCents).toBe(costs.running + costs.wages + costs.deadhead + 30_000 + 1_600);
    host.handle({ type: 'speed', speed: 5 });
    const cards = () => out.filter((m) => m.type === 'day-card');
    let t = 0;
    for (; cards().length < 1; t += 250) host.tick(t);
    // Day 2 is a whole day: its forecast is what Finance shows once day 1 has closed.
    host.handle({ type: 'speed', speed: 0 });
    const day2 = last('snapshot')!.snapshot.finance.lines[0]!.forecastCents;
    expect(last('snapshot')!.snapshot.day).toBe(2);
    host.handle({ type: 'speed', speed: 5 });
    for (; cards().length < 2; t += 250) host.tick(t);
    for (const { card } of cards() as Extract<FromWorker, { type: 'day-card' }>[]) {
      expect(card.rows.some((r) => r.kind === 'fares' && r.amountCents > 0)).toBe(true);
      expect(card.rows.reduce((s, r) => s + r.amountCents, 0)).toBe(card.cashAfterCents - card.cashBeforeCents);
    }
    // Every cost row is the forecast, to the cent (I6): day 2's, and day 1's as Finance forecast it at
    // Create, the line drawn at 05:00 with its buses pulling out of the depot for the departures they
    // could reach. Shown failing (TS-04) on 5f4bce3, where day 1 missed it by a drive out: its first bus
    // had left the depot before 05:00, so day 1 banked $10.32 of drives against $13.76 forecast.
    const [first, card] = (cards() as Extract<FromWorker, { type: 'day-card' }>[]).map((m) => m.card);
    expect([first!.day, card!.day]).toEqual([1, 2]);
    const sum = (c: typeof card, ...kinds: string[]) => c!.rows.filter((r) => kinds.includes(r.kind)).reduce((s, r) => s + r.amountCents, 0);
    expect(['running', 'wages', 'deadhead'].map((k) => sum(first, k))).toEqual([-costs.running, -costs.wages, -costs.deadhead]);
    expect(sum(card, 'running')).toBe(-day2.running);
    expect(sum(card, 'wages')).toBe(-day2.wages);
    expect(sum(card, 'deadhead')).toBe(-day2.deadhead);
    expect(sum(card, 'upkeep')).toBe(-30_000);
    // The debug line nets about $1,400 a day: both closed days were in profit (the checklist's step 4).
    expect(last('snapshot')!.snapshot.profitableDays).toBe(2);
  });

  // Finance's Lines view, its Breakdown and the Costs/day chip are one forecast, and the day banks it (D26), all of the day after a
  // change at 23:50 on a line running overnight, which settles past midnight with no refresh of the lines at the close. Shown
  // failing (TS-04) on 2a00661, whose Lines view read a forecast the line views kept from the 23:50 change: all day 2 it showed
  // running 72,168, wages 174,096 and deadhead 688 cents against the Breakdown's and the bank's 83,808, 187,200 and 0.
  it('shows each line in Finance the forecast the Breakdown sums and the day banks, all of the day after a late change', () => {
    const { host, out, last } = started();
    host.handle({ type: 'found', name: 'Back Bay Transit', colour: '#2471a3' });
    host.handle({ type: 'place-depot', at: depotSpot(last('ready')!.depotLand as [number, number][][]) });
    host.handle({ type: 'create-line', clicks: CLICKS, headways: { peak: 600, offpeak: 600, overnight: 1_800 } });
    const lineId = last('snapshot')!.snapshot.lines[0]!.id;
    host.advanceTo(18 * 3_600 + 50 * 60); // 23:50 on day 1, buses out
    host.handle({ type: 'set-headways', lineId, headways: { peak: 600, offpeak: 600, overnight: 600 } });
    expect(last('snapshot')!.snapshot.lines[0]!.settling).not.toBeNull();
    /** The line's day costs as Finance's Lines view shows them (its split, open) and as the Breakdown's forecast column has them, now. */
    const shown = () => {
      host.handle({ type: 'speed', speed: 0 });
      const snapshot = last('snapshot')!.snapshot;
      const sim = { snapshot, fareBand: null, fareBandFor: () => undefined, send: () => undefined } as unknown as Sim;
      const html = renderToStaticMarkup(createElement(Finance, { sim, onClose: () => undefined, view: 'lines', lineId }));
      const split = html.match(/data-testid="line-forecast" data-running="(\d+)" data-wages="(\d+)" data-deadhead="(\d+)"/)!;
      const column = (kind: string) => 0 - snapshot.finance.rows.find((r) => r.kind === kind)!.forecastCents!; // 0, not -0, for no deadhead
      const lines = { running: Number(split[1]), wages: Number(split[2]), deadhead: Number(split[3]) };
      return { lines, breakdown: { running: column('running'), wages: column('wages'), deadhead: column('deadhead') }, chip: snapshot.costsPerDayCents, day: snapshot.day };
    };
    host.advanceTo(19 * 3_600 + 60); // 00:01 on day 2
    const midnight = shown();
    expect(midnight.day).toBe(2);
    expect(midnight.lines).toEqual(midnight.breakdown);
    // The chip: the line's costs, the depot's $300 and four Signs' $4 each (D25).
    expect(midnight.chip).toBe(midnight.lines.running + midnight.lines.wages + midnight.lines.deadhead + 30_000 + 1_600);
    host.advanceTo(19 * 3_600 + 12 * 3_600); // noon
    const noon = shown();
    expect(noon.lines).toEqual(noon.breakdown);
    host.advanceTo(19 * 3_600 + 86_400); // day 2's close
    const card = out.flatMap((m) => (m.type === 'day-card' && m.card.day === 2 ? [m.card] : []))[0]!;
    const banked = (kind: string) => 0 - card.rows.filter((r) => r.kind === kind).reduce((sum, r) => sum + r.amountCents, 0);
    expect(noon.lines).toEqual({ running: banked('running'), wages: banked('wages'), deadhead: banked('deadhead') });
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
    expect(last('snapshot')!.snapshot.finance.lines[0]!.forecastCents.deadhead).toBeGreaterThan(0);
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
    // The next depot, on another parcel, costs $225k against the $78,548 left on the credit line: the card says by how much, as the click would.
    const other = depotSpot(last('ready')!.depotLand as [number, number][][], 1);
    host.handle({ type: 'depot-site', id: 3, at: other });
    expect(last('depot-site')).toEqual({ type: 'depot-site', id: 3, site: { ok: false, reason: 'insufficient_funds', shortCents: 14_645_200, priceCents: 22_500_000 } });
    host.handle({ type: 'place-depot', at: other });
    expect(last('refused')).toEqual({ type: 'refused', command: 'place-depot', reason: 'insufficient_funds', shortCents: 14_645_200 });
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
        setAside: true,
      });
      expect(store).toBeLessThan(game.out.findIndex((m) => m.type === 'ready')); // kept before anything replaces it
      // Said to be set aside once its backup reads back ('unbacked', below).
      expect(game.last('ready')).toMatchObject({ load: outcome, checking: true, snapshot: { elapsed: 0, company: { name: '' }, lines: [] } });
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

  // Under a key of its own, which Saves names as its notice does. Shown failing (TS-04) with it kept
  // under other-city's key, which Saves listed as "A save from another city" (this test pinned that).
  it('sets aside a save from another bake whose stops find no street on this one, and says so', () => {
    const text = played().saves().at(-1)!;
    const save = JSON.parse(text.replace(CITY.hash, 'f'.repeat(64))) as { data: { stops: { lon: number; lat: number }[] } };
    Object.assign(save.data.stops[0]!, { lon: -71.0, lat: 42.0 }); // far beyond the map's streets
    const raw = JSON.stringify(save);
    const game = started(raw);
    expect(game.out.find((m) => m.type === 'store')).toEqual({
      type: 'store',
      effects: [
        { op: 'write', key: 'interbus.backup.boston.off-street', value: raw },
        { op: 'remove', key: KEY },
      ],
      setAside: true,
    });
    expect(game.last('ready')).toMatchObject({ load: 'off-street', checking: true, snapshot: { elapsed: 0, company: { name: '' }, lines: [] } });
  });
});

// D12 and DP-06: a save the game cannot play is kept under a backup key before anything replaces it.
// When the backup is refused (a disk too full for it), the live key holds its only copy.
describe('a save the start could not set aside', () => {
  /** A host started from `live` on a page store that refuses every write to a backup key, as a full disk refuses a large one (`keeps` lets them through); the effects after a refused one are not carried out (platform's applyEffects). */
  function full(live: string, keeps = false) {
    const store = new Map<string, string>([[KEY, live]]);
    const out: FromWorker[] = [];
    const host = createHost((m) => out.push(m));
    let seen = 0;
    const send = (m: ToWorker) => {
      host.handle(m);
      while (seen < out.length) {
        const n = out[seen++]!;
        if (n.type === 'store') {
          for (const e of n.effects) {
            if (!keeps && e.op === 'write' && e.key.startsWith('interbus.backup.')) break;
            void (e.op === 'write' ? store.set(e.key, e.value) : store.delete(e.key));
          }
        } else if (n.type === 'read-keys') host.handle({ type: 'key-texts', id: n.id, texts: n.keys.map((k) => store.get(k) ?? null) });
      }
    };
    send({ type: 'init', simText: baked.text, city: CITY, seed: 1, build: BUILD });
    send({ type: 'save-text', text: live });
    const last = <T extends FromWorker['type']>(type: T) => out.filter((m) => m.type === type).at(-1) as Extract<FromWorker, { type: T }> | undefined;
    return { send, last, store, out };
  }
  const older = JSON.stringify({ format: SAVE_FORMAT - 1, build: BUILD, data: { company: { name: 'Old Line Co' } } });
  const newer = JSON.stringify({ format: SAVE_FORMAT + 1, build: BUILD, data: { company: { name: 'Old Line Co' } } });
  // A save of this game with a line, then the same from another city, and from another bake with a stop
  // off its streets (as 'sets aside a save from another bake whose stops find no street' builds it).
  const lined = (() => {
    const game = started();
    game.host.handle({ type: 'found', name: 'Old Line Co', colour: '#2471a3' });
    game.host.handle({ type: 'place-depot', at: depotSpot(game.last('ready')!.depotLand as [number, number][][]) });
    game.host.handle({ type: 'create-line', clicks: CLICKS });
    return game.saves().at(-1)!;
  })();
  const elsewhere = lined.replace('"id":"boston"', '"id":"worcester"');
  const offStreet = (() => {
    const save = JSON.parse(lined.replace(CITY.hash, 'f'.repeat(64))) as { data: { stops: { lon: number; lat: number }[] } };
    Object.assign(save.data.stops[0]!, { lon: -71.0, lat: 42.0 }); // far beyond the map's streets
    return JSON.stringify(save);
  })();
  const kinds = [[older, `older-${SAVE_FORMAT - 1}`], [newer, 'newer'], ['not a save', 'unreadable'], [elsewhere, 'other-city'], [offStreet, 'off-street']] as const;

  // Shown failing (TS-04) with the founding save written over it, as the start went on as if the backup
  // had landed: the older build's save was then gone for good, with no row in Saves. Once it is deleted,
  // Export and Delete pressed again (before its row goes) do nothing: shown failing with each refused as
  // 'no_such_slot', which names a slot the player never touched (this test pinned that for Export).
  it('writes nothing over it, says so, hands it over as a file, and saves again once the player deletes it, after which its buttons do nothing', () => {
    for (const [live, why] of kinds) {
      const { send, last, store, out } = full(live);
      expect(last('ready')).toMatchObject({ checking: true });
      send({ type: 'found', name: 'Back Bay Transit', colour: '#2471a3' });
      send({ type: 'place-depot', at: depotSpot(last('ready')!.depotLand as [number, number][][]) });
      send({ type: 'speed', speed: 0 });
      expect(store.get(KEY)).toBe(live);
      expect(last('unbacked')).toEqual({ type: 'unbacked', why });
      expect(store.has('interbus.quarter.boston')).toBe(true); // every other save is kept as before
      send({ type: 'slots' });
      expect(last('slots')).toMatchObject({ setAside: [], autosave: null });
      send({ type: 'export-unbacked' });
      expect(last('export')).toEqual({ type: 'export', name: `interbus-boston-not-set-aside-${why}.json`, text: live });
      send({ type: 'delete-unbacked' });
      expect(last('unbacked')).toEqual({ type: 'unbacked', why: null });
      // The save owed is made at once: the game as it stands, depot and all.
      expect(JSON.parse(store.get(KEY)!)).toMatchObject({ format: SAVE_FORMAT, data: { company: { name: 'Back Bay Transit' }, depots: [{}] } });
      const from = out.length;
      send({ type: 'export-unbacked' });
      send({ type: 'delete-unbacked' });
      expect(out.slice(from)).toEqual([]);
      expect(JSON.parse(store.get(KEY)!)).toMatchObject({ data: { company: { name: 'Back Bay Transit' } } });
    }
  });

  // The page hears the hold has ended only after the slots are listed again with the save owed
  // meanwhile, so the autosave's row goes from naming the held save to naming this game, never to
  // Empty. Shown failing (TS-04) with no listing after the delete: the row read "Autosave · Empty"
  // until Saves next listed the slots, up to 2 s later.
  it('lists the slots, the save owed in the autosave’s row, before saying the hold has ended', () => {
    const { send, last, out } = full(older);
    send({ type: 'found', name: 'Back Bay Transit', colour: '#2471a3' });
    const from = out.length;
    send({ type: 'delete-unbacked' });
    const after = out.slice(from);
    const ended = after.findIndex((m) => m.type === 'unbacked');
    expect(after[ended]).toEqual({ type: 'unbacked', why: null });
    expect(after.slice(0, ended).filter((m) => m.type === 'slots')).toMatchObject([{ autosave: { company: 'Back Bay Transit' } }]);
    expect(last('slots')!.autosave).toMatchObject({ company: 'Back Bay Transit' });
  });

  it('saves over it as before once its backup reads back, and says it was kept', () => {
    for (const [live, why] of kinds) {
      const { send, last, store } = full(live, true);
      expect(store.get(`interbus.backup.boston.${why}`)).toBe(live);
      expect(last('unbacked')).toEqual({ type: 'unbacked', why: null });
      send({ type: 'found', name: 'Back Bay Transit', colour: '#2471a3' });
      expect(JSON.parse(store.get(KEY)!).data.company.name).toBe('Back Bay Transit');
    }
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

  // Every undo has one answer, 'undone' or its refusal, so the page knows which undos took a command back
  // (useSim's undos): a Create or a Save route on its way lets go only on one of those. Shown failing
  // (TS-04) on 5f4bce3, whose host said nothing of an undo done: the first expect read [], not ['done'].
  it('says each undo that took a command back before its snapshot, and nothing more for an undo refused', () => {
    const { host, out } = foundedWithSaves();
    const answers = () => out.flatMap((m) => (m.type === 'undone' ? ['done'] : m.type === 'refused' && m.command === 'undo' ? [m.reason] : []));
    const depot = depotSpot((out.find((m) => m.type === 'ready') as Extract<FromWorker, { type: 'ready' }>).depotLand as [number, number][][]);
    host.handle({ type: 'place-depot', at: depot });
    host.handle({ type: 'undo' });
    expect(answers()).toEqual(['done']);
    expect(out.at(-1)).toMatchObject({ type: 'snapshot', snapshot: { depots: [] } });
    host.handle({ type: 'undo' });
    host.handle({ type: 'place-depot', at: depot });
    host.handle({ type: 'speed', speed: 3 }); // time runs: the depot can no longer be taken back
    host.handle({ type: 'undo' });
    expect(answers()).toEqual(['done', 'nothing_to_undo', 'time_has_run']);
  });

  // Run it on the line's own headways changes nothing: refused in words, as the same fare is, with nothing kept for the next undo
  // to spend itself on and no save. Shown failing (TS-04) on 2a00661: accepted, the chip reading "Undo: Line 1's headways".
  it('refuses headways the line already runs, and keeps nothing to undo for them', () => {
    const { host, last, saves } = foundedWithSaves();
    host.handle({ type: 'place-depot', at: depotSpot(last('ready')!.depotLand as [number, number][][]) });
    host.handle({ type: 'create-line', clicks: CLICKS });
    const line = last('snapshot')!.snapshot.lines[0]!;
    const saved = saves().length;
    host.handle({ type: 'set-headways', lineId: line.id, headways: { ...line.headways } });
    expect(last('refused')).toEqual({ type: 'refused', command: 'set-headways', reason: 'same_headways' });
    expect(last('snapshot')!.snapshot).toMatchObject({ undo: { command: 'create-line', subject: 'Line 1' }, lines: [{ headways: line.headways, buses: 2 }] });
    expect(saves()).toHaveLength(saved);
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
  /**
   * A host with a page's store: its store effects carried out and its read-keys answered, in order. While `room.full`, the store
   * refuses a write (any, or only one under the key it names) and the rest of its job, as a full disk does (platform's
   * applyEffects), and the page tells the sim the keys it refused; a key removed makes room. The page (useSim) tells only the
   * keys of the game's own saves (`owed`); here every key refused is told, so the host is shown to owe only its own.
   */
  function withStore(now?: () => number, room: { full: boolean | string } = { full: false }) {
    const store = new Map<string, string>();
    const out: FromWorker[] = [];
    const host = createHost((m) => out.push(m), now);
    let seen = 0;
    const pump = () => {
      while (seen < out.length) {
        const m = out[seen++]!;
        if (m.type === 'store') {
          for (const [i, e] of m.effects.entries()) {
            if (e.op === 'write' && (room.full === true || room.full === e.key)) {
              host.handle({ type: 'store-refused', keys: m.effects.slice(i).flatMap((f) => (f.op === 'write' ? [f.key] : [])) });
              break;
            }
            if (e.op === 'write') store.set(e.key, e.value);
            else if (store.delete(e.key)) room.full = false;
          }
        } else if (m.type === 'read-keys') host.handle({ type: 'key-texts', id: m.id, texts: m.keys.map((k) => store.get(k) ?? null) });
      }
    };
    const send = (m: ToWorker) => {
      host.handle(m);
      pump();
    };
    const tick = (nowMs: number) => {
      host.tick(nowMs);
      pump();
    };
    send({ type: 'init', simText: baked.text, city: CITY, seed: 1, build: BUILD });
    send({ type: 'save-text', text: null });
    const last = <T extends FromWorker['type']>(type: T) => out.filter((m) => m.type === type).at(-1) as Extract<FromWorker, { type: T }> | undefined;
    send({ type: 'found', name: 'Back Bay Transit', colour: '#2471a3' });
    send({ type: 'place-depot', at: depotSpot(last('ready')!.depotLand as [number, number][][]) });
    /** The keys the host has written since `from` messages, in order. */
    const writes = (from: number) => out.slice(from).flatMap((m) => (m.type === 'store' ? m.effects : [])).flatMap((e) => (e.op === 'write' ? [e.key] : []));
    const advanceTo = (elapsed: number) => {
      host.advanceTo(elapsed);
      pump();
    };
    return { send, tick, last, store, out, writes, advanceTo };
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
  // page's clock, with delete-slot ignored, and with the set-aside keys left unread. Each job names its
  // slot, so the page says a Save here the browser refused on that slot's row until the slot is saved
  // or deleted: shown failing (TS-04) on 029387a, whose jobs named none.
  it('names each slot’s buses and when it was saved, and deletes a slot', () => {
    const at = Date.UTC(2026, 9, 13, 20, 41);
    const { send, last, store } = withStore(() => at);
    send({ type: 'create-line', clicks: CLICKS });
    send({ type: 'save-slot', slot: 2 });
    expect(last('store')).toMatchObject({ effects: [{ op: 'write', key: 'interbus.slot.boston.2' }], slot: 2 });
    expect(last('slots')!.slots[1]).toMatchObject({ slot: 2, about: { lines: 1, buses: 2, savedAt: at }, readable: true });
    expect(JSON.parse(store.get(KEY)!).savedAt).toBe(at); // the autosave is stamped too
    send({ type: 'delete-slot', slot: 2 });
    expect(last('store')).toEqual({ type: 'store', effects: [{ op: 'remove', key: 'interbus.slot.boston.2' }], slot: 2 });
    expect(store.has('interbus.slot.boston.2')).toBe(false);
    expect(last('slots')!.slots[1]).toEqual({ slot: 2, about: null, readable: true });
    send({ type: 'delete-slot', slot: 7 });
    expect(last('refused')).toEqual({ type: 'refused', command: 'delete-slot', reason: 'no_such_slot' });
  });

  // "This browser isn’t keeping saves", and the player deletes a slot, or a save set aside by a new build, to make room: the
  // autosave the full store refused is written at once, so a reload keeps the game. Shown failing (TS-04) on 5f4bce3, where
  // nothing saved after the delete: the live key kept the game from before the refusal until the next command, pause or game
  // hour, and a reload lost the depot; and, for the save set aside, with delete-set-aside's `writeOwed();` taken out. The
  // delete writes the autosave alone: shown failing with any refusal owing both saves, where it wrote the quarter's start too.
  it('writes the autosave a full store refused as soon as a delete makes room, depot and all', () => {
    const room = { full: false };
    let at = 0; // each save stamped apart, so one written again shows
    const { send, last, store, out, writes } = withStore(() => ++at, room);
    const depots = () => (JSON.parse(store.get(KEY)!) as { data: { depots: unknown[] } }).data.depots.length;
    send({ type: 'save-slot', slot: 1 });
    room.full = true;
    send({ type: 'place-depot', at: depotSpot(last('ready')!.depotLand as [number, number][][], 1) });
    expect(last('snapshot')!.snapshot.depots).toHaveLength(2);
    expect(depots()).toBe(1); // refused
    const from = out.length;
    send({ type: 'delete-slot', slot: 1 });
    expect(store.has('interbus.slot.boston.1')).toBe(false);
    expect(depots()).toBe(2);
    expect(writes(from)).toEqual([KEY]); // the autosave alone: the quarter's start was not refused
    expect(last('slots')!.autosave).toMatchObject({ company: 'Back Bay Transit', cashCents: last('snapshot')!.snapshot.cashCents });
    // The same with a save set aside by a new build (stored as the set-aside test below stores one), deleted to make room.
    store.set('interbus.backup.boston.older', '{"format":1}');
    send({ type: 'slots' });
    expect(last('slots')!.setAside).toEqual(['older']);
    room.full = true;
    send({ type: 'undo' }); // the depot again
    expect(last('snapshot')!.snapshot.depots).toHaveLength(1);
    expect(depots()).toBe(2); // refused
    send({ type: 'delete-set-aside', why: 'older' });
    expect(store.has('interbus.backup.boston.older')).toBe(false);
    expect(depots()).toBe(1);
    expect(last('slots')!.autosave).toMatchObject({ company: 'Back Bay Transit', cashCents: last('snapshot')!.snapshot.cashCents });
    // Owed only after a refusal: a delete with nothing owed writes nothing.
    const kept = store.get(KEY);
    send({ type: 'save-slot', slot: 2 });
    send({ type: 'delete-slot', slot: 2 });
    expect(store.get(KEY)).toBe(kept);
  });

  // The quarter's start the full store refused at a quarter's close is owed, as is the autosave it refused after, and the delete
  // writes both, the quarter's start from memory, so after a reload Restart this quarter goes back to this quarter's start. Shown
  // failing (TS-04) on 5f4bce3, where the delete wrote neither, and with only the autosave owed: the quarter key kept the start
  // of the quarter before (here, where a file was loaded on its last evening) though the autosave was written.
  it('writes the quarter’s start a full store refused at the close once a delete makes room, with the autosave', () => {
    const room = { full: false };
    const { send, tick, last, store, out } = withStore(undefined, room);
    const elapsedIn = (key: string) => (JSON.parse(store.get(key)!) as { data: { clock: { elapsed: number } } }).data.clock.elapsed;
    send({ type: 'save-slot', slot: 1 });
    // This game as a file, at 23:50 on day 8, the quarter's last close ten minutes off: loaded, it is the quarter's start.
    send({ type: 'export' });
    const file = JSON.parse(last('export')!.text) as { data: { clock: { elapsed: number } } };
    const lastEvening = 7 * 86_400 + 18 * 3_600 + 50 * 60;
    file.data.clock.elapsed = lastEvening;
    send({ type: 'import', text: JSON.stringify(file) });
    expect(elapsedIn('interbus.quarter.boston')).toBe(lastEvening);
    room.full = true;
    send({ type: 'speed', speed: 5 });
    for (let t = 0; !last('day-card')?.card.report && t < 60_000; t += 250) tick(t);
    send({ type: 'speed', speed: 0 });
    const midnight = 7 * 86_400 + 19 * 3_600; // day 8's close, where quarter 2 begins
    expect(last('snapshot')!.snapshot.elapsed).toBeGreaterThanOrEqual(midnight);
    expect(elapsedIn('interbus.quarter.boston')).toBe(lastEvening); // refused
    send({ type: 'delete-slot', slot: 1 });
    expect(elapsedIn(KEY)).toBe(last('snapshot')!.snapshot.elapsed);
    expect(elapsedIn('interbus.quarter.boston')).toBe(midnight);
    // Each of the game's own writes says which save it is, so the page's Saves chip says "Autosave off" for the autosave alone,
    // and a slot's Save here names its slot. Shown failing (TS-04) with the quarter's start marked as the autosave.
    const marked = new Set(out.flatMap((m) => (m.type === 'store' ? m.effects.map((e) => `${e.key} ${m.owed ?? '-'} ${m.slot ?? '-'}`) : [])));
    expect(marked).toEqual(new Set([`${KEY} autosave -`, 'interbus.quarter.boston quarter -', 'interbus.slot.boston.1 - 1']));
  });

  // Owed by key. A slot's Save here refused owes nothing: the slot stays as it was until the player saves or deletes it. At a
  // quarter's close the store may refuse the quarter's start alone (over the last one it needs a quarter's growth of room) and
  // keep the autosave a moment later (an hour's): the delete then writes the quarter's start, and not the autosave again.
  // Shown failing (TS-04) on 5f4bce3, where the delete after the close wrote nothing, and with any refusal owing both saves,
  // where after the slot's refusal the delete wrote the autosave and the quarter's start.
  it('owes only the saves under the keys the store refused: nothing for a slot, the quarter’s start alone at a close', () => {
    const room: { full: boolean | string } = { full: false };
    const { send, tick, last, store, out, writes } = withStore(undefined, room);
    const elapsedIn = (key: string) => (JSON.parse(store.get(key)!) as { data: { clock: { elapsed: number } } }).data.clock.elapsed;
    send({ type: 'save-slot', slot: 3 });
    room.full = 'interbus.slot.boston.2';
    send({ type: 'save-slot', slot: 2 });
    expect(store.has('interbus.slot.boston.2')).toBe(false); // refused
    let from = out.length;
    send({ type: 'delete-slot', slot: 3 });
    expect(writes(from)).toEqual([]);
    send({ type: 'save-slot', slot: 1 });
    // This game as a file at 23:50 on day 8, loaded, as the test before: the quarter's start, ten minutes before its close.
    send({ type: 'export' });
    const file = JSON.parse(last('export')!.text) as { data: { clock: { elapsed: number } } };
    const lastEvening = 7 * 86_400 + 18 * 3_600 + 50 * 60;
    file.data.clock.elapsed = lastEvening;
    send({ type: 'import', text: JSON.stringify(file) });
    room.full = 'interbus.quarter.boston';
    send({ type: 'speed', speed: 5 });
    for (let t = 0; !last('day-card')?.card.report && t < 60_000; t += 250) tick(t);
    send({ type: 'speed', speed: 0 });
    const midnight = 7 * 86_400 + 19 * 3_600;
    expect(elapsedIn('interbus.quarter.boston')).toBe(lastEvening); // refused
    expect(elapsedIn(KEY)).toBe(last('snapshot')!.snapshot.elapsed); // kept
    from = out.length;
    send({ type: 'delete-slot', slot: 1 });
    expect(writes(from)).toEqual(['interbus.quarter.boston']);
    expect(elapsedIn('interbus.quarter.boston')).toBe(midnight);
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

  // A file comes from outside the game, so its counters are read to a lower bound than the game's own saves are, and a game imported
  // at the bound plays on into an autosave the game still reads (the systems audit's seventh round). Shown failing (TS-04) with one
  // bound for both, where the same save in a slot was refused too.
  it('refuses a file whose counters pass the import bound, though the game’s own slot may hold them', () => {
    const { send, last, store } = withStore();
    const save = JSON.parse(store.get(KEY)!) as { data: { tripsCarried: number } };
    save.data.tripsCarried = Math.floor(IMPORT_COUNTER_LIMIT) + 1;
    send({ type: 'import', text: JSON.stringify(save) });
    expect(last('refused')).toEqual({ type: 'refused', command: 'import', reason: 'save_unreadable' });
    store.set('interbus.slot.boston.1', JSON.stringify(save));
    send({ type: 'load-slot', slot: 1 });
    expect(last('loaded')).toEqual({ type: 'loaded', from: 'slot', load: 'ok' });
  });

  // A kept version's distances are billed by the hour while its trips run. Imported with its line changed at 11:30 on day 2 and
  // saved five minutes later, a kept route of 1e300 m billed the 12:00 hour -3.6e299 cents of running, and the tick threw "running
  // must be whole cents", stopping the game (the systems audit's seventh round). Shown failing (TS-04) without the kept version's
  // distance check, where the file loaded.
  it('refuses a file whose settling line kept a route no city has, which stopped the game at the next hour', () => {
    const { send, last, advanceTo } = withStore();
    send({ type: 'create-line', clicks: CLICKS });
    advanceTo(86_400 + 6.5 * 3_600);
    send({ type: 'set-headways', lineId: 1, headways: { peak: 600, offpeak: 900, overnight: null } });
    advanceTo(86_400 + 6.5 * 3_600 + 300);
    send({ type: 'export' });
    const file = JSON.parse(last('export')!.text) as { data: { lines: { earlier: { routeM: number }[] }[] } };
    expect(file.data.lines[0]!.earlier).toHaveLength(1);
    file.data.lines[0]!.earlier[0]!.routeM = 1e300;
    send({ type: 'import', text: JSON.stringify(file) });
    expect(last('refused')).toEqual({ type: 'refused', command: 'import', reason: 'save_unreadable' });
  });

  // The systems audit's seventh round: a save of this bake with a stop moved off every street loaded and played, the stop drawn
  // in the harbour while its line routed to the nearest street. Shown failing (TS-04) with the check taken out, when it loaded.
  it('refuses a file of this map whose stop stands off every street', () => {
    const { send, last, store } = withStore();
    send({ type: 'create-line', clicks: CLICKS });
    send({ type: 'export' });
    const live = store.get(KEY);
    const file = JSON.parse(last('export')!.text) as { data: { stops: { lon: number; lat: number }[] } };
    Object.assign(file.data.stops[1]!, { lon: -71.06, lat: 42.36 });
    send({ type: 'import', text: JSON.stringify(file) });
    expect(last('refused')).toEqual({ type: 'refused', command: 'import', reason: 'save_unreadable' });
    expect(store.get(KEY)).toBe(live);
  });

  // The review of the seventh round's fixes: refused at the start, such a save went unsaid and unsaved, and the founding save
  // wrote over it; in a slot it listed as readable and Load then refused it. It is set aside as unreadable, with the notice's
  // check, and lists so. Shown failing (TS-04) with the start's set-aside and the slot's check taken out.
  it('sets aside an autosave of this map whose stop stands off every street, and lists such a slot as unreadable', () => {
    const { send, last, store } = withStore();
    send({ type: 'create-line', clicks: CLICKS });
    send({ type: 'export' });
    const file = JSON.parse(last('export')!.text) as { data: { stops: { lon: number; lat: number }[] } };
    Object.assign(file.data.stops[1]!, { lon: -71.06, lat: 42.36 });
    const text = JSON.stringify(file);
    const game = started(text);
    expect(game.out.find((m) => m.type === 'store')).toEqual({
      type: 'store',
      effects: [
        { op: 'write', key: 'interbus.backup.boston.unreadable', value: text },
        { op: 'remove', key: KEY },
      ],
      setAside: true,
    });
    expect(game.last('ready')).toMatchObject({ load: 'unreadable', checking: true, snapshot: { elapsed: 0, company: { name: '' }, lines: [] } });
    store.set('interbus.slot.boston.1', text);
    send({ type: 'slots' });
    expect(last('slots')!.slots[0]).toEqual({ slot: 1, about: null, readable: false, why: 'unreadable' });
  });

  // Shown failing (TS-04) with the session file's own `format: 1` read as a save's: "Saved by an older build".
  it('refuses an Export session file as no save, never as one from an older build', () => {
    const { send, last, store } = withStore();
    const live = store.get(KEY);
    send({ type: 'export-session' });
    send({ type: 'import', text: last('export')!.text });
    expect(last('refused')).toEqual({ type: 'refused', command: 'import', reason: 'save_unreadable' });
    expect(store.get(KEY)).toBe(live);
  });

  // A slot written before a format change is never lost unseen (D12, DP-06). Shown failing (TS-04)
  // with every slot it cannot load named as unreadable, and no way to hand one over as a file.
  it('names a slot from an older build as one, and hands it over as a file', () => {
    const { send, last, store } = withStore();
    send({ type: 'save-slot', slot: 1 });
    const older = JSON.stringify({ ...JSON.parse(store.get('interbus.slot.boston.1')!), format: SAVE_FORMAT - 1 });
    store.set('interbus.slot.boston.1', older);
    send({ type: 'slots' });
    expect(last('slots')!.slots[0]).toEqual({ slot: 1, about: null, readable: false, why: `older-${SAVE_FORMAT - 1}` });
    send({ type: 'export-slot', slot: 1 });
    expect(last('export')).toEqual({ type: 'export', name: 'interbus-boston-slot-1.json', text: older });
    send({ type: 'export-slot', slot: 2 });
    expect(last('refused')).toEqual({ type: 'refused', command: 'export-slot', reason: 'empty_slot' });
    expect(store.get('interbus.slot.boston.1')).toBe(older);
  });

  // D26's Rows: a slot this game cannot load says why and never loads. Shown failing (TS-04) with a slot
  // from another bake listed to load whether or not its stops find this bake's streets: Load was then
  // refused ("Its stops aren’t on this map"), and the row had no Export.
  it('names a slot from another bake whose stops are off the new map as one, never to load', () => {
    const { send, last, store } = withStore();
    send({ type: 'create-line', clicks: CLICKS });
    send({ type: 'save-slot', slot: 1 });
    const rebaked = store.get('interbus.slot.boston.1')!.replace(CITY.hash, 'f'.repeat(64));
    const off = JSON.parse(rebaked) as { data: { stops: { lon: number; lat: number }[] } };
    Object.assign(off.data.stops[0]!, { lon: -71.0, lat: 42.0 }); // far beyond the map's streets
    store.set('interbus.slot.boston.1', JSON.stringify(off));
    store.set('interbus.slot.boston.2', rebaked); // another bake, its stops still on the streets
    send({ type: 'slots' });
    const [one, two] = last('slots')!.slots;
    expect(one).toEqual({ slot: 1, about: null, readable: false, why: 'off-street' });
    expect(two).toMatchObject({ slot: 2, about: { company: 'Back Bay Transit', lines: 1 }, readable: true });
    send({ type: 'export-slot', slot: 1 });
    expect(last('export')).toEqual({ type: 'export', name: 'interbus-boston-slot-1.json', text: JSON.stringify(off) });
    send({ type: 'load-slot', slot: 2 });
    expect(last('loaded')).toEqual({ type: 'loaded', from: 'slot', load: 'rebaked' });
  });

  // Two tabs of the game (the systems audit's fifth round): Home takes up another tab's newer save as the game, as a reload would,
  // writing nothing, and Restart this quarter then reads the quarter's start from the store, the other tab's, not this game's
  // own; one this build can't play leaves the game as it was. Shown failing (TS-04) on 050dbdd, which had no answer to it.
  it('takes up another tab’s save as the game, writing nothing, its quarter’s start the store’s; one it can’t play changes nothing', () => {
    const other = withStore();
    other.send({ type: 'create-line', clicks: CLICKS });
    other.send({ type: 'speed', speed: 5 });
    for (let t = 0; t < 2_000; t += 250) other.tick(t);
    other.send({ type: 'speed', speed: 0 });
    const theirs = other.store.get(KEY)!;
    const at = other.last('snapshot')!.snapshot;
    expect(at.elapsed).toBeGreaterThan(0);
    const { send, last, store, out, writes } = withStore();
    store.set('interbus.quarter.boston', theirs); // the other tab's quarter's start, as the store holds it
    const from = out.length;
    send({ type: 'take-save', text: theirs });
    expect(last('took-save')).toEqual({ type: 'took-save', ok: true });
    expect(last('snapshot')!.snapshot).toMatchObject({ elapsed: at.elapsed, cashCents: at.cashCents, lines: [{ name: 'Line 1' }], speed: 0, undo: null });
    expect(writes(from)).toEqual([]);
    send({ type: 'restart-quarter' });
    expect(last('snapshot')!.snapshot.elapsed).toBe(at.elapsed); // not this game's founding, at 0
    const was = last('snapshot')!.snapshot;
    const before = out.length;
    for (const text of [JSON.stringify({ format: SAVE_FORMAT + 1, data: {} }), null]) {
      send({ type: 'take-save', text });
      expect(last('took-save')).toEqual({ type: 'took-save', ok: false });
    }
    expect(out.slice(before).filter((m) => m.type !== 'took-save')).toEqual([]);
    expect(last('snapshot')!.snapshot).toBe(was);
  });

  // The autosave in the save list (the M5 spec's exit check 2). Shown failing (TS-04) with the list
  // sent without it, when the panel named only the game's day and time.
  it('lists the autosave with its company, cash, lines and buses, and when it was saved', () => {
    const at = Date.UTC(2026, 9, 14, 18, 5);
    const { send, last } = withStore(() => at);
    send({ type: 'create-line', clicks: CLICKS });
    send({ type: 'slots' });
    const cashCents = last('snapshot')!.snapshot.cashCents;
    expect(last('slots')!.autosave).toEqual({ day: 1, hour: 5, minute: 0, company: 'Back Bay Transit', cashCents, lines: 1, buses: 2, savedAt: at });
  });
});

// The failure floor through the worker (the M3 spec, item 10; exit check 4): the countdown in the
// snapshot, time stopped once the run ends, and Restart this quarter from the save written as the
// quarter began: at founding for quarter 1, at a quarter's close, or when a slot or file was loaded.
describe('the failure floor', () => {
  /** With `refuses`, the page's store keeps nothing and reads nothing, as a browser that refuses storage. */
  function founded(refuses = false) {
    const store = new Map<string, string>();
    const out: FromWorker[] = [];
    const host = createHost((m) => out.push(m));
    let seen = 0;
    const send = (m: ToWorker) => {
      host.handle(m);
      while (seen < out.length) {
        const n = out[seen++]!;
        if (n.type === 'store') for (const e of refuses ? [] : n.effects) void (e.op === 'write' ? store.set(e.key, e.value) : store.delete(e.key));
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

  // Interest is a running cost (sim/rules/money.ts) and Finance forecasts a day of it while owing; the
  // chip left it out, so here, owing $556,000, it read $333.60 a day less than Finance's running costs.
  // Shown failing (TS-04) with Costs/day summed without the interest.
  it('counts a day’s interest in Costs/day while owing, as Finance’s running costs forecast it', () => {
    const { send, last, owing } = founded();
    send({ type: 'place-depot', at: depotSpot(last('ready')!.depotLand as [number, number][][]) });
    send({ type: 'create-line', clicks: CLICKS });
    send({ type: 'import', text: owing(0) });
    const s = last('snapshot')!.snapshot;
    const forecast = (kind: string) => -s.finance.rows.find((r) => r.kind === kind)!.forecastCents!;
    expect(forecast('interest')).toBeGreaterThan(0);
    expect(s.costsPerDayCents).toBe(['running', 'wages', 'deadhead', 'upkeep', 'stopUpkeep', 'interest'].reduce((sum, kind) => sum + forecast(kind), 0));
  });

  it('restarts quarter 1 from its founding', () => {
    const { send, last } = founded();
    send({ type: 'place-depot', at: depotSpot(last('ready')!.depotLand as [number, number][][]) });
    send({ type: 'restart-quarter' });
    expect(last('loaded')).toEqual({ type: 'loaded', from: 'quarter', load: 'ok' });
    expect(last('snapshot')!.snapshot).toMatchObject({ elapsed: 0, cashCents: 47_454_800, depots: [], company: { name: 'Back Bay Transit' } });
  });

  // D10's way back with storage refused (the slots stay empty there, by design: DECISIONS, "A browser
  // that keeps no saves"). Shown failing (TS-04) with Restart reading the quarter's save only from the
  // store: it was refused ("No save from this quarter’s start"), and a failing company could not go on.
  it('restarts the quarter for the life of the page when the browser keeps no saves', () => {
    const { send, last, store, host } = founded(true);
    send({ type: 'place-depot', at: depotSpot(last('ready')!.depotLand as [number, number][][]) });
    send({ type: 'restart-quarter' });
    expect(last('refused')).toBeUndefined();
    expect(last('snapshot')!.snapshot).toMatchObject({ elapsed: 0, cashCents: 47_454_800, depots: [], company: { name: 'Back Bay Transit' } });
    // A failing game imported, then run to its end: Restart reopens it where it was loaded.
    send({ type: 'export' });
    const save = JSON.parse(last('export')!.text) as { data: { closesBelowFloor: number; ledger: { day: number; kind: string; amountCents: number; lineId: null }[] } };
    save.data.closesBelowFloor = 4;
    save.data.ledger.push({ day: 1, kind: 'buses', amountCents: -(foundingCapitalCents() + 20_000_000), lineId: null });
    send({ type: 'import', text: JSON.stringify(save) });
    send({ type: 'speed', speed: 5 });
    for (let t = 0; !last('snapshot')!.snapshot.floor?.ended && t < 600_000; t += 250) host.tick(t);
    expect(last('snapshot')!.snapshot.floor).toEqual({ closesLeft: 0, ended: true });
    send({ type: 'restart-quarter' });
    expect(last('refused')).toBeUndefined();
    expect(last('loaded')).toEqual({ type: 'loaded', from: 'quarter', load: 'ok' });
    expect(last('snapshot')!.snapshot).toMatchObject({ elapsed: 0, cashCents: -20_000_000, floor: { closesLeft: 1, ended: false } });
    expect(store.size).toBe(0);
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

  // The quarter's save is whichever game wrote it last, and loading an ended game writes none. Shown
  // failing (TS-04) with it read whoever wrote it: Restart brought back the company played before.
  it('never restarts another company’s quarter: an ended game loaded from a file has none of its own', () => {
    const { send, last, owing } = founded();
    const other = JSON.parse(owing(5)) as { data: { company: { name: string } } };
    other.data.company.name = 'Beta Transit';
    send({ type: 'import', text: JSON.stringify(other) });
    expect(last('snapshot')!.snapshot).toMatchObject({ company: { name: 'Beta Transit' }, floor: { closesLeft: 0, ended: true } });
    send({ type: 'restart-quarter' });
    expect(last('refused')).toEqual({ type: 'refused', command: 'restart-quarter', reason: 'no_quarter_save' });
    expect(last('loaded')).toEqual({ type: 'loaded', from: 'file', load: 'ok' });
    expect(last('snapshot')!.snapshot).toMatchObject({ company: { name: 'Beta Transit' }, floor: { ended: true } });
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

  it('puts snow’s words amid the stops of the game on screen, after another game loads on the same snowy day and after a stop is built in the snow', () => {
    // Every game starts from one seed, so another game loaded on a snowy day often meets the same snow.
    // Its place was kept under the event and the day alone, and stayed amid the last game's stops.
    /** A founded game with a line through `clicks`, as a file with snow falling today (days 1 and 2). */
    const snowy = (clicks: [number, number][]) => {
      const { host, last } = started();
      host.handle({ type: 'found', name: 'Back Bay Transit', colour: '#2471a3' });
      host.handle({ type: 'place-depot', at: depotSpot(last('ready')!.depotLand as [number, number][][]) });
      host.handle({ type: 'create-line', clicks });
      host.handle({ type: 'export' });
      const file = JSON.parse(last('export')!.text) as { data: { event: unknown } };
      file.data.event = { kind: 'snow', startDay: 1, endDay: 2, street: '', edges: [], at: null };
      return JSON.stringify(file);
    };
    const { host, last } = started();
    /** Where the words are, and the mean of the stops' places. */
    const snow = () => {
      const s = last('snapshot')!.snapshot;
      expect(s.event).toMatchObject({ kind: 'snow', phase: 'on' });
      return { at: s.event!.at, amid: [0, 1].map((k) => s.stops.reduce((sum, stop) => sum + stop.at[k]!, 0) / s.stops.length) };
    };
    const expectAmid = () => {
      const { at, amid } = snow();
      expect(at[0]).toBeCloseTo(amid[0]!, 6);
      expect(at[1]).toBeCloseTo(amid[1]!, 6);
    };
    host.handle({ type: 'import', text: snowy(CLICKS.slice(2)) }); // the Museum of Fine Arts and Longwood
    expectAmid();
    const longwood = snow().at;
    host.handle({ type: 'import', text: snowy([CLICKS[0]!, [...KENMORE]]) }); // Copley and Kenmore, about 1.7 km away
    expectAmid();
    expect(Math.abs(snow().at[1] - longwood[1])).toBeGreaterThan(0.01);
    host.handle({ type: 'place-stop', at: CLICKS[1]! }); // Symphony
    expect(last('snapshot')!.snapshot.stops).toHaveLength(3);
    expectAmid();
  });
});
