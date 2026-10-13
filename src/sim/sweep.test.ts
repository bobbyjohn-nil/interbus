// I3's full sweep in small (the M4 spec, item 5): the debug line through each bus model, a Station
// tier and each kind of event (roadworks on its own streets, snow, a festival), on the headways every 5–60 minutes by day with overnight off
// and the night-heavy setting, at every fare. The whole sweep, every headway the card offers on the
// debug line and two Inner Boston corridors, one also laid as an express line, runs nightly (`npm run bench sweep inner`).
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CORRIDORS } from '../../bench/inner';
import { loadCity } from './city/simfile';
import { planIsExpress } from './rules/express';
import { newGame } from './state';
import { createWorld } from './world';
import { addDebugLine } from './commands/debugLine';
import type { Headways } from './rules/periods';
import { encode } from './save/save';
import { corridorStops, i3Verdict, soleLine, sweepSlice, type Slice } from './sweep';
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

// Express behind I3 (the M4 spec, below the cut): no fixture street is 5 km long, so an express line is
// swept on Inner Boston, whose city file CI fetches before the tests (`npm run cities`).
const index = JSON.parse(readFileSync('cities/index.json', 'utf8')) as { cities: { sim: { file: string } }[] };
const innerFile = `public/cities/${index.cities[0]!.sim.file}`;

describe.skipIf(!existsSync(innerFile))('I3 on an express line, in small', () => {
  it('finds an interior optimum on Massachusetts Avenue with its stops 1,300 m apart, its best fare under $5', () => {
    const inner = loadCity(readFileSync(innerFile, 'utf8'));
    if (!inner.ok) throw new Error(inner.problem);
    const world = createWorld(inner.city, newGame({ id: 'boston', revision: 'inner-boston', hash: '-' }, { name: 'x', colour: '#000000' }, 1));
    const [, from, to] = CORRIDORS.find(([n]) => n === 'Massachusetts Avenue')!;
    const id = soleLine(world, 'Massachusetts Avenue express', corridorStops(world, from, to, 1_300)!);
    expect(planIsExpress(world.services.get(id)!.plan)).toBe(true);
    const r = sweepSlice(world, id, { model: 'sparrow', tier: 1, event: 'none' }, SOME);
    expect(i3Verdict(r)).toEqual({ failures: [], notes: [] });
    expect(r.best.fareCents).toBeLessThan(500);
  });
});
