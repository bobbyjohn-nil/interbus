// I3's full sweep (the M4 spec, item 5): every slice of src/sim/sweep.ts on the fixture's debug line,
// and with `inner` on two Inner Boston corridors, each the company's only line, its stops laid every
// 400 m or so along the streets between bench/inner.ts's ends for it. Prints each slice's
// best setting, the starved and night-heavy lines, the starter's best fare and I3's verdicts, and
// how long it took. `npm run bench sweep` or `npm run bench sweep inner`.
import { existsSync, readFileSync } from 'node:fs';
import { loadCity } from '../src/sim/city/simfile';
import { addDebugLine } from '../src/sim/commands/debugLine';
import { mint, type LineId } from '../src/sim/core/ids';
import { newGame } from '../src/sim/state';
import { CORRIDOR_SPACING_M, corridorStops, i3Verdict, SETTINGS, SLICES, sweepSlice, type Point } from '../src/sim/sweep';
import { fixtureGame } from '../src/sim/testing';
import { createWorld, recompute, type World } from '../src/sim/world';
import { CORRIDORS } from './inner';

const min = (s: number | null) => (s === null ? 'off' : String(s / 60));
const show = (p: Point) => `${min(p.headways.peak)}/${min(p.headways.offpeak)}/${min(p.headways.overnight)} min, ${p.buses} buses, $${(p.fareCents / 100).toFixed(2)}: $${(p.netCents / 100).toFixed(0)}`;

function sweep(name: string, world: World, lineId: LineId): number {
  const t0 = performance.now();
  let failures = 0;
  let notes = 0;
  console.log(`${name}: ${SLICES.length} slices × ${SETTINGS.length} headway settings × every fare`);
  for (const slice of SLICES) {
    const r = sweepSlice(world, lineId, slice);
    const v = i3Verdict(r);
    failures += v.failures.length;
    notes += v.notes.length;
    console.log(
      `  ${slice.model.padEnd(8)} tier ${slice.tier} ${slice.event === 'none' ? 'no event' : `${slice.event}${r.street ? ` (${r.street})` : ''}`}: best ${show(r.best)}; starved $${(r.starved.netCents / 100).toFixed(0)}; night-heavy $${(r.nightHeavy.netCents / 100).toFixed(0)}; starter's best fare $${(r.starterFareCents / 100).toFixed(2)}${v.failures.length ? `\n    I3 FAILS: ${v.failures.join('; ')}` : ''}${v.notes.length ? '\n    nothing earns' : ''}`,
    );
  }
  const s = (performance.now() - t0) / 1000;
  console.log(`${name}: ${failures} I3 failures, ${notes} of ${SLICES.length} slices where nothing earns, in ${s.toFixed(1)} s (${((1000 * s) / (SLICES.length * SETTINGS.length)).toFixed(1)} ms a setting)\n`);
  return failures;
}

let failures = 0;
{
  const world = fixtureGame(1);
  const added = addDebugLine(world);
  if (!added.ok) throw new Error(added.reason);
  failures += sweep('the debug line', world, added.lineId);
}
if (process.argv[3] === 'inner') {
  const index = JSON.parse(readFileSync('cities/index.json', 'utf8')) as { cities: { sim: { file: string } }[] };
  const path = `public/cities/${index.cities[0]!.sim.file}`;
  if (!existsSync(path)) throw new Error(`no ${path}: run npm run cities`);
  const inner = loadCity(readFileSync(path, 'utf8'));
  if (!inner.ok) throw new Error(inner.problem);
  for (const corridor of ['Huntington Avenue', 'Massachusetts Avenue']) {
    const [name, from, to] = CORRIDORS.find(([n]) => n === corridor)!;
    const world = createWorld(inner.city, newGame({ id: 'boston', revision: 'inner-boston', hash: '-' }, { name: 'x', colour: '#000000' }, 1));
    const stops = corridorStops(world, from, to);
    if (!stops) throw new Error(`${name}: no street between its ends`);
    const stopIds = stops.map(([lon, lat]) => {
      const [id, next] = mint(world.state.nextIds, 'stop');
      world.state.nextIds = next;
      world.state.stops.push({ id, lon, lat, tier: 1 });
      return id;
    });
    const [id, next] = mint(world.state.nextIds, 'line');
    world.state.nextIds = next;
    world.state.lines.push({ id, name, colour: '#1f6fb2', stopIds, fareCents: 225, headways: { peak: 1_200, offpeak: 1_200, overnight: null }, boardedMilli: 0, buses: 2, model: 'sparrow' });
    recompute(world);
    const s = world.services.get(id)!;
    console.log(`${name}: ${stops.length} stops every ${CORRIDOR_SPACING_M} m or so along ${((s.plan.stopDistM.at(-1) ?? 0) / 1000).toFixed(1)} km of street; ${(s.timing.cycles!.peak / 60).toFixed(0)} min round trip at peak`);
    failures += sweep(name, world, id);
  }
}
console.log(`I3 over the full sweep: ${failures === 0 ? 'holds' : `${failures} failures`}`);
if (failures > 0) process.exitCode = 1;
