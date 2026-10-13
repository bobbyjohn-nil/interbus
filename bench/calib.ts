// calib.tripScale on Inner Boston (city-boston-r1, the M3 spec's Nov 15 item): prices stay V1's and
// demand scales (PLAN §3), so the extent the preview plays is scaled to carry on the debug line (Copley,
// Symphony, the MFA, Longwood; every 20 minutes by day; $2.25) what the fixture carries at its
// calibrated 111‰, and the economics measured on the fixture hold on the preview. Riders offered
// scale in proportion to the permille (src/sim/demand/calibration.test.ts), so this is one division.
// `npm run bench calib`, once `node tools/bake/sim.mjs boston inner-boston` has baked Inner Boston.
import { existsSync, readFileSync } from 'node:fs';
import { bakeSim } from '../tools/bake/sim.mjs';
import { loadCity, type City } from '../src/sim/city/simfile';
import { addDebugLine } from '../src/sim/commands/debugLine';
import { newGame } from '../src/sim/state';
import { createWorld } from '../src/sim/world';

const INNER = '.cache/bake/boston/sim-inner-boston.json';

function offered(city: City, permille: number): number {
  const world = createWorld({ ...city, tripScalePermille: permille }, newGame({ id: 'boston', revision: city.extent, hash: '-' }, { name: 'x', colour: '#000000' }, 1));
  if (!addDebugLine(world).ok) throw new Error(`no debug line on ${city.extent}`);
  const demand = [...world.assignment.lines.values()][0]!;
  return demand.perDay + demand.shedPerDay;
}

const fixture = loadCity(bakeSim('boston', 'mini-boston').text);
if (!fixture.ok) throw new Error(fixture.problem);
if (!existsSync(INNER)) throw new Error(`no ${INNER}: bake it with node tools/bake/sim.mjs boston inner-boston`);
const inner = loadCity(readFileSync(INNER, 'utf8'));
if (!inner.ok) throw new Error(inner.problem);

const target = offered(fixture.city, fixture.city.tripScalePermille);
const fixtureAt1000 = offered(fixture.city, 1000);
const innerAt1000 = offered(inner.city, 1000);
const permille = Math.round((target / innerAt1000) * 1000);
console.log(`the debug line, riders offered a day: fixture ${fixtureAt1000.toFixed(1)} at 1000‰, ${target.toFixed(1)} at its ${fixture.city.tripScalePermille}‰`);
console.log(`Inner Boston ${innerAt1000.toFixed(1)} at 1000‰ (${(innerAt1000 / fixtureAt1000).toFixed(3)}× the fixture's), so ${permille}‰ carries ${offered(inner.city, permille).toFixed(1)}`);
