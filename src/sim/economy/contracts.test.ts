// Contracts (the M3 spec, item 11; the M4 spec, item 1; I11). Shown failing (TS-04): with V2's
// grading, which averaged the headway over the day's hours, a line every 10 minutes at peak and every
// 16 off-peak meets a 15-minute contract (14.1 minutes over the 19 hours); with asks drawn
// independently, as V2 drew them, six offers in a row can repeat an ask; with every boarding counted,
// changes at Kenmore count for RIDERSHIP; with untaken offers kept for good, I11's income spreads from
// $60k to $900k over 100 seeds.
import { describe, expect, it } from 'vitest';
import { acceptContract } from '../commands/acceptContract';
import { addDebugLine } from '../commands/debugLine';
import { CONTRACT_ASKS, CONTRACT_OFFER_DAYS, CONTRACT_REACH_M, type ContractKind } from '../config/contracts';
import { toXY } from '../core/geo';
import { SPARROW } from '../config/fleet';
import { DAYS_PER_QUARTER, SECONDS_PER_DAY } from '../config/time';
import { createLine } from '../commands/createLine';
import { busesNeeded, cycleSeconds } from '../rules/cycle';
import { advance } from '../step';
import { contractIncome, COPLEY, gameWithDepot, KENMORE } from '../testing';
import { planLine, recompute, type World } from '../world';
import type { Contract } from '../state';
import { landmarkFigures, landmarkHeadways, rollOffers } from './contracts';

/** The debug line at these headways, with the buses they need. */
function runEvery(world: World, peak: number, offpeak: number) {
  const line = world.state.lines[0]!;
  line.headways = { peak, offpeak, overnight: null };
  const plan = planLine(world, line)!;
  line.buses = busesNeeded(cycleSeconds(plan.stopDistM.at(-1)!, plan.stops.length, SPARROW.kmh), line.headways);
  recompute(world);
}

/** A founded game on the fixture with the debug line and day 1's offers. */
function game(seed = 7) {
  const world = gameWithDepot(seed);
  if (!addDebugLine(world).ok) throw new Error('no line');
  rollOffers(world, 1);
  return world;
}

/** The game's contract at `landmark`, made to ask `ask` of `kind` (the deck decides the real one). */
function at(world: World, landmark: string, kind: ContractKind, ask: number): Contract {
  const c = world.state.contracts.find((k) => k.landmark === landmark)!;
  Object.assign(c, CONTRACT_ASKS.find((a) => a.kind === kind && a.ask === ask)!);
  return c;
}
const longwood = (world: World, askSeconds: number) => at(world, 'Longwood', 'headway', askSeconds);
/** Which of CONTRACT_ASKS a contract asks. */
const askIndex = (c: Contract) => CONTRACT_ASKS.findIndex((a) => a.kind === c.kind && a.ask === c.ask);

const paid = (world: World) => world.state.ledger.rows.filter((r) => r.kind === 'contract');

describe('HEADWAY contracts', () => {
  it('offers three at a game’s start, one at each fixture landmark, three different asks', () => {
    const world = game();
    expect(world.state.contracts.map((c) => c.landmark).sort()).toEqual(['Copley Square', 'Kenmore', 'Longwood']);
    expect(new Set(world.state.contracts.map(askIndex)).size).toBe(3);
    expect(world.state.contracts.every((c) => c.acceptedDay === null && c.offeredDay === 1)).toBe(true);
  });

  it('reads the best stop within a walk, all lines there together: the debug line every 20 min serves Copley and Longwood, not Kenmore', () => {
    const world = game();
    expect(Object.fromEntries(landmarkHeadways(world))).toEqual({ 'Copley Square': 1_200, Longwood: 1_200, Kenmore: null });
  });

  it('pays once, as one Contracts row, on the eighth close in a row met (a quarter, D25), and offers another in its slot the next day', () => {
    const world = game();
    const c = longwood(world, 1_200);
    expect(acceptContract(world, c.id).ok).toBe(true);
    expect(acceptContract(world, c.id)).toEqual({ ok: false, reason: 'already_held' });
    const events = advance(world, 8 * SECONDS_PER_DAY);
    expect(events.map((e) => e.contracts.map((o) => o.outcome))).toEqual([[], [], [], [], [], [], [], ['paid']]);
    expect(paid(world)).toEqual([{ day: 8, kind: 'contract', amountCents: 6_000_000 }]);
    expect(world.state.contracts.find((k) => k.id === c.id)).toBeUndefined();
    expect(world.state.contracts.find((k) => k.landmark === 'Longwood')).toMatchObject({ offeredDay: 9, acceptedDay: null });
  });

  it('starts the count again after a day with an hour that missed', () => {
    const world = game();
    const c = longwood(world, 1_200);
    acceptContract(world, c.id);
    advance(world, 4 * SECONDS_PER_DAY);
    expect(c.daysMet).toBe(4);
    advance(world, 12 * 3_600); // 17:00 on day 5
    runEvery(world, 1_200, 1_800); // off-peak every 30 minutes for one evening
    advance(world, 3_600);
    runEvery(world, 1_200, 1_200);
    advance(world, 6 * 3_600);
    expect(c.daysMet).toBe(0);
    advance(world, 7 * SECONDS_PER_DAY); // days 6–12: seven met in a row, one short
    expect(paid(world)).toEqual([]);
    advance(world, SECONDS_PER_DAY);
    expect(paid(world)).toEqual([{ day: 13, kind: 'contract', amountCents: 6_000_000 }]);
  });

  it('lapses once the days left in its 16 cannot hold the days still needed, and pays nothing', () => {
    const world = game();
    const c = longwood(world, 600); // the debug line every 20 minutes never meets 10
    acceptContract(world, c.id);
    const events = advance(world, 11 * SECONDS_PER_DAY);
    expect(events.findIndex((e) => e.contracts.some((o) => o.outcome === 'lapsed'))).toBe(8); // day 9: 7 days left, 8 needed
    expect(paid(world)).toEqual([]);
  });

  it('is never met by one period alone (I11): every 10 minutes at peak and 16 off-peak misses a 15-minute ask', () => {
    const world = game();
    runEvery(world, 600, 960);
    expect(landmarkHeadways(world).get('Longwood')).toBe(960);
    const c = longwood(world, 900);
    acceptContract(world, c.id);
    advance(world, 16 * SECONDS_PER_DAY);
    expect(paid(world)).toEqual([]);
  });

  it('deals the asks from one shuffled deck of both kinds: every six offers in a row hold each of the six once', () => {
    const world = game(3);
    const dealt = world.state.contracts.map(askIndex);
    for (let day = 2; day <= 40; day++) {
      world.state.contracts.splice(0, 1 + (day % 2)); // one or two slots freed, as if paid
      rollOffers(world, day);
      dealt.push(...world.state.contracts.filter((c) => c.offeredDay === day).map(askIndex));
    }
    expect(dealt.length).toBeGreaterThan(50);
    for (let k = 0; k + 6 <= dealt.length; k += 6) expect(dealt.slice(k, k + 6).sort((a, b) => a - b), `offers ${k + 1}–${k + 6}`).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('withdraws an offer nobody takes after a quarter, eight days, and deals another into its slot', () => {
    const world = game();
    const before = world.state.contracts.map((c) => c.id);
    rollOffers(world, 1 + CONTRACT_OFFER_DAYS - 1);
    expect(world.state.contracts.map((c) => c.id)).toEqual(before);
    rollOffers(world, 1 + CONTRACT_OFFER_DAYS);
    expect(world.state.contracts.some((c) => before.includes(c.id))).toBe(false);
    expect(world.state.contracts).toHaveLength(3);
  });

  it('keeps contract income over 10 seeds within 30% of the median (I11)', { timeout: 60_000 }, () => {
    // Each seed's company runs the debug line and a Copley–Kenmore line every 10 minutes all day and
    // takes every offer it meets, for four quarters (testing.ts). Over 100 seeds `npm run bench
    // contracts` measured $900k–$1.02M with both kinds dealt, and every run of ten seeds within 30% of
    // its median; with HEADWAY alone and the debug line alone, $1.11M–$1.29M (M3, ten-day quarters).
    // One-second steps (D25) make its 32 days about 2.8 million steps, so it has a longer timeout.
    const incomes = Array.from({ length: 10 }, (_, k) => contractIncome(k + 1, 4 * DAYS_PER_QUARTER));
    const sorted = [...incomes].sort((a, b) => a - b);
    const median = (sorted[4]! + sorted[5]!) / 2;
    for (const income of incomes) expect(Math.abs(income - median) / median, `${incomes}`).toBeLessThanOrEqual(0.3);
  });
});

describe('RIDERSHIP contracts (the M4 spec, item 1)', () => {
  it('reads the paid boardings a day at every stop within a walk: the debug line every 20 min carries Copley past 150, not Longwood', () => {
    const world = game();
    const figures = Object.fromEntries(landmarkFigures(world));
    expect(figures['Copley Square']!.ridership).toBeGreaterThan(150);
    expect(figures['Copley Square']!.ridership).toBeLessThan(400);
    expect(figures.Longwood!.ridership).toBeLessThan(150);
    expect(figures.Kenmore).toEqual({ headway: null, ridership: null });
  });

  it('pays 150 at Copley after eight closes in a row met, and never pays 400 there', () => {
    const world = game();
    const c = at(world, 'Copley Square', 'ridership', 150);
    acceptContract(world, c.id);
    advance(world, 8 * SECONDS_PER_DAY);
    expect(paid(world).map((r) => r.amountCents)).toEqual([6_000_000]);

    const other = game();
    const d = at(other, 'Copley Square', 'ridership', 400);
    acceptContract(other, d.id);
    advance(other, 16 * SECONDS_PER_DAY);
    expect(paid(other)).toEqual([]);
  });

  it('counts a rider changing lines once: changes at Kenmore board free and do not count (EC-04)', () => {
    const world = gameWithDepot();
    createLine(world, [COPLEY, KENMORE]);
    createLine(world, [KENMORE, [-71.1035, 42.336]]);
    const changes = [...world.assignment.lines.values()].reduce((sum, d) => sum + d.transfersByStop.reduce((s, v) => s + v, 0), 0);
    const boardings = world.state.lines.reduce((sum, line) => {
      const d = world.assignment.lines.get(line.id)!;
      return sum + line.stopIds.reduce((s, id, q) => s + (world.state.stops.find((x) => x.id === id) && landmarkNear(world, id) ? d.boardingsByStop[q]! : 0), 0);
    }, 0);
    expect(changes).toBeGreaterThan(40);
    const kenmore = landmarkFigures(world).get('Kenmore')!.ridership!;
    expect(kenmore).toBeCloseTo(boardings - changes, 6);
  });
});

/** Whether stop `id` is within a walk of Kenmore. */
function landmarkNear(world: World, id: number): boolean {
  const stop = world.state.stops.find((s) => s.id === id)!;
  const kenmore = world.city.landmarks.find((l) => l.name === 'Kenmore')!;
  const [x, y] = toXY(world.city.frame, [stop.lon, stop.lat]);
  return Math.hypot(x - kenmore.at[0], y - kenmore.at[1]) <= CONTRACT_REACH_M;
}
