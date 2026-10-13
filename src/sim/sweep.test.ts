// I3's full sweep in small (the M4 spec, item 5): the debug line through each bus model, a Station
// tier and each kind of event (roadworks on its own streets, snow, a festival), on the headways every 5–60 minutes by day with overnight off
// and the night-heavy setting, at every fare. The whole sweep, every headway the card offers on the
// debug line and two Inner Boston corridors, runs nightly (`npm run bench sweep inner`).
import { describe, expect, it } from 'vitest';
import { addDebugLine } from './commands/debugLine';
import type { Headways } from './rules/periods';
import { encode } from './save/save';
import { i3Verdict, sweepSlice, type Slice } from './sweep';
import { fixtureGame } from './testing';

const DAY = [300, 600, 900, 1_200, 1_800, 3_600];
const SOME: Headways[] = [...DAY.flatMap((peak) => DAY.map((offpeak) => ({ peak, offpeak, overnight: null }))), { peak: 3_600, offpeak: 3_600, overnight: 3_600 }];
const SLICES: Slice[] = [
  { model: 'sparrow', tier: 1, event: 'none' },
  { model: 'sparrow', tier: 1, event: 'roadworks' },
  { model: 'metro40', tier: 3, event: 'none' },
  { model: 'goliath', tier: 1, event: 'none' },
  { model: 'sparrow', tier: 1, event: 'snow' },
  { model: 'sparrow', tier: 1, event: 'festival' },
];

describe('I3 in the full sweep, in small (the M4 spec, item 5)', () => {
  const world = fixtureGame(1);
  const added = addDebugLine(world);
  if (!added.ok) throw new Error(added.reason);
  const before = encode(world.state, { sha: 'x', version: '0.0.0' });
  const results = SLICES.map((slice) => sweepSlice(world, added.lineId, slice, SOME));

  it('finds an interior optimum in every slice, the best fare under $5, and a starved line under 60% of the best', () => {
    for (const r of results) expect(i3Verdict(r), JSON.stringify(r.slice)).toEqual({ failures: [], notes: [] });
  });

  it('times roadworks on the line’s own street and snow on every drive, which cost it, and a festival, which pays', () => {
    const [clear, works, , , snow, festival] = results;
    expect(works!.street).toBe('Huntington Avenue');
    expect(works!.best.netCents).toBeLessThan(clear!.best.netCents);
    expect(snow!.best.netCents).toBeLessThan(works!.best.netCents);
    expect(festival!.best.netCents).toBeGreaterThan(clear!.best.netCents);
  });

  it('leaves the game as it found it', () => {
    expect(encode(world.state, { sha: 'x', version: '0.0.0' })).toBe(before);
  });
});
