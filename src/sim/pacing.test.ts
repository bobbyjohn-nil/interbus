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
import { corridorCandidates, playScripted } from './pacing';
import { SPEED_RATES } from './rules/speed';
import { COPLEY, fixtureGame, KENMORE } from './testing';


describe('the scripted pacing run, on the fixture', () => {
  const world = fixtureGame(7);
  const result = playScripted(world, { name: 'the debug line', stops: DEBUG_STOPS.map((s) => s.at), headways: FOUNDING_HEADWAYS }, corridorCandidates(world, [['Copley to Kenmore', COPLEY, KENMORE]]), {
    rateOn: (day) => SPEED_RATES[day === 1 ? 3 : 4],
    player: { newGameToPlay: 3.5, perLine: 1.5, perDepot: 0.5 },
    reserveCents: 0,
    maxDays: 40,
  });

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

  it('carries 25,000 trips for silver within the first four quarters (measured: day 22; day 23 at k 1.2)', () => {
    expect(result.at.silver!.day).toBeGreaterThanOrEqual(18);
    expect(result.at.silver!.day).toBeLessThanOrEqual(30);
  });
});
