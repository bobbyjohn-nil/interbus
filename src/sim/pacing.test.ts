// The scripted pacing run on the fixture (the M5 spec, item 1; EC-11's regression bands), in small for
// the PR checks: the debug line, then Copley to Kenmore as the one candidate, for 40 days, day 1 at
// 600x and later days at the ladder's 4 (2,700x since the tuning freeze). The full run on Inner Boston
// is `npm run bench pacing`, which holds PLAN §3's minutes nightly on seeds 1-3. These bands are the
// fixture's own measured milestones with room either side, not PLAN §3's: on seed 7 a $60,000 contract
// pays on day 9 and the second line follows on day 10, earlier than Inner Boston's, so a change that
// moves the pace fails here and is measured on Inner Boston before it lands. Shown failing (TS-04)
// with the starting cash at k 1.2, the value before the tuning freeze: the second line comes on day 17.
import { describe, expect, it } from 'vitest';
import { DEBUG_STOPS } from './commands/debugLine';
import { FOUNDING_HEADWAYS } from './config/lines';
import { post, rowsOfDay } from './economy/ledger';
import { corridorCandidates, playScripted } from './pacing';
import { isOperating } from './rules/money';
import { SPEED_RATES } from './rules/speed';
import { COPLEY, fixtureGame, KENMORE } from './testing';
import type { World } from './world';


describe('the scripted pacing run, on the fixture', () => {
  const play = (world: World, maxDays: number) =>
    playScripted(world, { name: 'the debug line', stops: DEBUG_STOPS.map((s) => s.at), headways: FOUNDING_HEADWAYS }, corridorCandidates(world, [['Copley to Kenmore', COPLEY, KENMORE]]), {
      rateOn: (day) => SPEED_RATES[day === 1 ? 3 : 4],
      player: { newGameToPlay: 3.5, perLine: 1.5, perDepot: 0.5 },
      reserveCents: 0,
      maxDays,
    });
  const result = play(fixtureGame(7), 40);

  it('profits on day 1, within PLAN §3’s 8 minutes, and grades its first quarter by 20', () => {
    expect(result.at.profit).toEqual({ day: 1, minutes: 5.4 });
    expect(result.at.reportCard).toEqual({ day: 8, minutes: 9.1 }); // 11.0 at 1,800x; day 10 at 12.6 while a quarter was ten days (D25)
    expect(result.at.bronze?.day).toBe(8);
  });

  it('draws its second line the day after its first contract pays (measured: day 10, 11.2 minutes; day 17 and 18.9 at k 1.2 and 1,800x)', () => {
    expect(result.lines[0]?.name).toBe('Copley to Kenmore, whole, 4 stops');
    expect(result.at.secondLine!.day).toBeGreaterThanOrEqual(9);
    expect(result.at.secondLine!.day).toBeLessThanOrEqual(13);
    expect(result.at.secondLine!.minutes).toBeGreaterThanOrEqual(10);
    expect(result.at.secondLine!.minutes).toBeLessThanOrEqual(14);
  });

  // The nightly's founding-recipe band (bench/pacing.ts) read day 2's rows at the end of its run, and
  // the ledger now folds a closed day once Finance's two quarters pass it (economy/ledger.ts DAYS_KEPT),
  // so the run reads them at day 2's close: what the same run, stopped after day 2 before any fold,
  // sums. Shown failing (TS-04) on 001fc4a, whose result had no such figure, and with the bench's read
  // put back (day 2's rows at the run's end, folded by then): $0 against $1,206.31.
  it('reads day 2’s running net at its close, as the day’s rows sum before any fold', () => {
    const short = fixtureGame(7);
    play(short, 2);
    const day2 = rowsOfDay(short.state.ledger, 2).filter((r) => isOperating(r.kind));
    expect(day2.length).toBeGreaterThan(0);
    expect(result.secondDayNetCents).toBe(day2.reduce((s, r) => s + r.amountCents, 0));
  });

  // With the cash for more than one, the player draws each candidate that scores on the same day, as a player with the money
  // would; it drew one a day (the review of #144). The fixture's only line that earns its keep past the debug line is Copley
  // to Kenmore, so the card's points score a second, in the South End, a third of whose residents no stop yet reaches. Shown
  // failing (TS-04) with one a day.
  it('draws every candidate that scores on one day when the cash allows', () => {
    const rich = fixtureGame(7);
    // $10 million, room for every candidate at once, as a contract's row so that each trial's restore keeps it.
    post(rich.state.ledger, { day: 1, kind: 'contract', amountCents: 1_000_000_000 });
    const both = playScripted(
      rich,
      { name: 'the debug line', stops: DEBUG_STOPS.map((s) => s.at), headways: FOUNDING_HEADWAYS },
      corridorCandidates(rich, [
        ['Copley to Kenmore', COPLEY, KENMORE],
        ['The South End', [-71.0734, 42.34129], [-71.08271, 42.33624]],
      ]),
      { rateOn: () => SPEED_RATES[4], player: { newGameToPlay: 3.5, perLine: 1.5, perDepot: 0.5 }, reserveCents: 0, maxDays: 3, cardCentsPerPoint: 1_000_000 },
    );
    // Measured: Copley to Kenmore whole and the South End from its second end on day 2, then another Copley to Kenmore on day 3.
    expect(both.lines.slice(0, 2).map((l) => l.name.split(',')[0])).toEqual(['Copley to Kenmore', 'The South End']);
    expect(both.lines[1]!.day).toBe(both.lines[0]!.day);
  }, 60_000); // three days of trials with every candidate: 3.4 s alone, past vitest's 5 s on a loaded machine

  it('carries 25,000 trips for silver within the first four quarters (measured: day 22; day 23 at k 1.2)', () => {
    expect(result.at.silver!.day).toBeGreaterThanOrEqual(18);
    expect(result.at.silver!.day).toBeLessThanOrEqual(30);
  });
});
