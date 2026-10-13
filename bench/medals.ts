// Medals against the M4 spec's magnitudes (item 3): bronze and silver in about the first or second
// quarter, silver in about 40 days with one line or about 12 with three. Two companies on the fixture
// run untouched for six quarters: the checklist's debug line at the founding headways, and I11's
// company (the debug line and Copley to Kenmore, both every 10 minutes, their buses given). Prints
// each quarter's card, the trips a day and the day each medal came. `npm run bench medals`.
import { createLine } from '../src/sim/commands/createLine';
import { addDebugLine } from '../src/sim/commands/debugLine';
import { SECONDS_PER_DAY } from '../src/sim/config/time';
import { busesNeeded } from '../src/sim/rules/cycle';
import { advance } from '../src/sim/step';
import { COPLEY, gameWithDepot, KENMORE } from '../src/sim/testing';
import { recompute, type World } from '../src/sim/world';

const DAYS = 60;

function run(name: string, world: World): void {
  const t0 = performance.now();
  const f = (v: number) => v.toFixed(1).padStart(5);
  let trips = 0;
  for (let day = 1; day <= DAYS; day++) {
    for (const e of advance(world, SECONDS_PER_DAY)) {
      if (e.kind !== 'day-closed') continue;
      trips = e.trips;
      if (e.card) console.log(`  ${name} quarter ${e.card.quarter}: coverage ${f(e.card.coverage)}, reliability ${f(e.card.reliability)}, comfort ${f(e.card.comfort)}, money ${f(e.card.money)}; overall ${f(e.card.overall)}; ${trips} trips on day ${e.day}`);
      for (const m of e.medals) console.log(`  ${name}: ${m} on day ${e.day}, ${world.state.tripsCarried} trips carried`);
    }
  }
  const m = world.state.medals;
  console.log(`${name}: ${trips} trips a day at the end, ${world.state.tripsCarried} carried in ${DAYS} days; bronze ${m.bronze ?? '-'}, silver ${m.silver ?? '-'}, gold ${m.gold ?? '-'} (${((performance.now() - t0) / 1000).toFixed(1)} s)`);
}

{
  const world = gameWithDepot(1);
  if (!addDebugLine(world).ok) throw new Error('no debug line');
  run('the debug line', world);
}
{
  const world = gameWithDepot(1);
  if (!addDebugLine(world).ok || !createLine(world, [COPLEY, KENMORE]).ok) throw new Error('no lines');
  for (const line of world.state.lines) line.headways = { peak: 600, offpeak: 600, overnight: null };
  recompute(world);
  for (const line of world.state.lines) line.buses = busesNeeded(world.services.get(line.id)!.timing.cycles!, line.headways);
  recompute(world);
  run('two lines every 10 min', world);
}
