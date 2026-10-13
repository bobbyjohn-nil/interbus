// The scripted pacing run on the fixture (the M5 spec, item 1; EC-11's regression bands), in small for
// the PR checks: the debug line, then Copley to Kenmore as the one candidate, for 40 days, day 1 at
// speed 1 and later days at 2. The full run on Inner Boston is `npm run bench pacing`. Its bands are
// the fixture's measured milestones with room either side, so a change that moves the pace fails here
// and is measured on Inner Boston before it lands. Shown failing (TS-04) with the starting cash at
// k 1.0: the second line comes on day 31.
import { describe, expect, it } from 'vitest';
import { DEBUG_STOPS } from './commands/debugLine';
import { FOUNDING_HEADWAYS } from './config/lines';
import { corridorCandidates, playScripted } from './pacing';
import { COPLEY, fixtureGame, KENMORE } from './testing';

/** The worker's speed ladder (src/worker/host.ts SPEEDS), which the sim may not import. */
const SPEEDS = { 1: 600, 2: 1_800, 3: 5_400 } as const;

describe('the scripted pacing run, on the fixture', () => {
  const world = fixtureGame(7);
  const result = playScripted(world, { name: 'the debug line', stops: DEBUG_STOPS.map((s) => s.at), headways: FOUNDING_HEADWAYS }, corridorCandidates(world, [['Copley to Kenmore', COPLEY, KENMORE]]), {
    speeds: SPEEDS,
    speedOn: (day) => (day === 1 ? 1 : 2),
    player: { newGameToPlay: 3.5, perLine: 1.5, perDepot: 0.5 },
    reserveCents: 0,
    maxDays: 40,
  });

  it('profits on day 1, within PLAN §3’s 8 minutes, and grades its first quarter by 20', () => {
    expect(result.at.profit).toEqual({ day: 1, minutes: 5.4 });
    expect(result.at.reportCard).toEqual({ day: 10, minutes: 12.6 });
    expect(result.at.bronze?.day).toBe(10);
  });

  it('draws its second line within PLAN §3’s 15–25 minutes (measured: day 21, 22.1 minutes)', () => {
    expect(result.lines[0]?.name).toBe('Copley to Kenmore, whole, 4 stops');
    expect(result.at.secondLine!.day).toBeGreaterThanOrEqual(15);
    expect(result.at.secondLine!.day).toBeLessThanOrEqual(26);
    expect(result.at.secondLine!.minutes).toBeGreaterThanOrEqual(15);
    expect(result.at.secondLine!.minutes).toBeLessThanOrEqual(25);
  });

  it('carries 25,000 trips for silver within the first three quarters (measured: day 24)', () => {
    expect(result.at.silver!.day).toBeGreaterThanOrEqual(18);
    expect(result.at.silver!.day).toBeLessThanOrEqual(30);
  });
});
