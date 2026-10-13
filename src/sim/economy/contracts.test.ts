// HEADWAY contracts (the M3 spec, item 11; I11). Shown failing (TS-04): with V2's grading, which
// averaged the headway over the day's hours, a line every 10 minutes at peak and every 16 off-peak
// meets a 15-minute contract (14.1 minutes over the 19 hours); with asks drawn independently, as V2
// drew them, three offers in a row can repeat an ask.
import { describe, expect, it } from 'vitest';
import { acceptContract } from '../commands/acceptContract';
import { addDebugLine } from '../commands/debugLine';
import { CONTRACT_ASKS } from '../config/contracts';
import { SPARROW } from '../config/fleet';
import { SECONDS_PER_DAY } from '../config/time';
import { busesNeeded, cycleSeconds } from '../rules/cycle';
import { advance } from '../step';
import { contractIncome, gameWithDepot } from '../testing';
import { planLine, recompute, type World } from '../world';
import type { Contract } from '../state';
import { landmarkHeadways, rollOffers } from './contracts';

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

/** The game's Longwood contract, made to ask `askSeconds` (the deck decides the real one). */
function longwood(world: World, askSeconds: number): Contract {
  const c = world.state.contracts.find((k) => k.landmark === 'Longwood')!;
  Object.assign(c, CONTRACT_ASKS.find((a) => a.askSeconds === askSeconds)!);
  return c;
}

const paid = (world: World) => world.state.ledger.rows.filter((r) => r.kind === 'contract');

describe('HEADWAY contracts', () => {
  it('offers three at a game’s start, one at each fixture landmark, one of each ask', () => {
    const world = game();
    expect(world.state.contracts.map((c) => c.landmark).sort()).toEqual(['Copley Square', 'Kenmore', 'Longwood']);
    expect(world.state.contracts.map((c) => c.askSeconds).sort((a, b) => a - b)).toEqual([600, 900, 1_200]);
    expect(world.state.contracts.every((c) => c.acceptedDay === null && c.offeredDay === 1)).toBe(true);
  });

  it('reads the best stop within a walk, all lines there together: the debug line every 20 min serves Copley and Longwood, not Kenmore', () => {
    const world = game();
    expect(Object.fromEntries(landmarkHeadways(world))).toEqual({ 'Copley Square': 1_200, Longwood: 1_200, Kenmore: null });
  });

  it('pays once, as one Contracts row, on the tenth close in a row met, and offers another in its slot the next day', () => {
    const world = game();
    const c = longwood(world, 1_200);
    expect(acceptContract(world, c.id).ok).toBe(true);
    expect(acceptContract(world, c.id)).toEqual({ ok: false, reason: 'already_held' });
    const events = advance(world, 10 * SECONDS_PER_DAY);
    expect(events.map((e) => e.contracts.map((o) => o.outcome))).toEqual([[], [], [], [], [], [], [], [], [], ['paid']]);
    expect(paid(world)).toEqual([{ day: 10, kind: 'contract', amountCents: 6_000_000 }]);
    expect(world.state.contracts.find((k) => k.id === c.id)).toBeUndefined();
    expect(world.state.contracts.find((k) => k.landmark === 'Longwood')).toMatchObject({ offeredDay: 11, acceptedDay: null });
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
    advance(world, 9 * SECONDS_PER_DAY);
    expect(paid(world)).toEqual([]);
    advance(world, SECONDS_PER_DAY);
    expect(paid(world)).toEqual([{ day: 15, kind: 'contract', amountCents: 6_000_000 }]);
  });

  it('lapses once the days left in its 20 cannot hold the days still needed, and pays nothing', () => {
    const world = game();
    const c = longwood(world, 600); // the debug line every 20 minutes never meets 10
    acceptContract(world, c.id);
    const events = advance(world, 11 * SECONDS_PER_DAY);
    expect(events.findIndex((e) => e.contracts.some((o) => o.outcome === 'lapsed'))).toBe(10); // day 11: 9 days left, 10 needed
    expect(paid(world)).toEqual([]);
  });

  it('is never met by one period alone (I11): every 10 minutes at peak and 16 off-peak misses a 15-minute ask', () => {
    const world = game();
    runEvery(world, 600, 960);
    expect(landmarkHeadways(world).get('Longwood')).toBe(960);
    const c = longwood(world, 900);
    acceptContract(world, c.id);
    advance(world, 20 * SECONDS_PER_DAY);
    expect(paid(world)).toEqual([]);
  });

  it('deals the asks from a shuffled deck: every three offers in a row hold one of each', () => {
    const world = game(3);
    const dealt = world.state.contracts.map((c) => c.askSeconds);
    for (let day = 2; day <= 40; day++) {
      world.state.contracts.splice(0, 1 + (day % 2)); // one or two slots freed, as if paid
      rollOffers(world, day);
      dealt.push(...world.state.contracts.filter((c) => c.offeredDay === day).map((c) => c.askSeconds));
    }
    expect(dealt.length).toBeGreaterThan(50);
    for (let k = 0; k + 3 <= dealt.length; k += 3) expect(dealt.slice(k, k + 3).sort((a, b) => a - b), `offers ${k + 1}–${k + 3}`).toEqual([600, 900, 1_200]);
  });

  it('keeps contract income over 10 seeds within 30% of the median (I11)', () => {
    // Each seed's company runs the debug line every 10 minutes all day and takes every offer it
    // meets, for four quarters (testing.ts). Over 100 seeds `npm run bench contracts` measured
    // $1.11M–$1.29M, and every run of ten seeds within 30% of its median; over 30 days, one run in
    // ten fails with the deck and five in ten with V2's independent draws.
    const incomes = Array.from({ length: 10 }, (_, k) => contractIncome(k + 1, 40));
    const sorted = [...incomes].sort((a, b) => a - b);
    const median = (sorted[4]! + sorted[5]!) / 2;
    for (const income of incomes) expect(Math.abs(income - median) / median, `${incomes}`).toBeLessThanOrEqual(0.3);
  });
});
