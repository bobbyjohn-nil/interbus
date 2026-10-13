// One full game day of the debug line on the fixture (day 2, since day 1 starts at 05:00), parked
// at a depot: its boardings, what they earn, what it costs, and what a day adds to the save; the M1
// and M2 specs' magnitudes. `npm run bench day`.
import { bakeSim } from '../tools/bake/sim.mjs';
import { addDebugLine } from '../src/sim/commands/debugLine';
import { placeDepot } from '../src/sim/commands/placeDepot';
import { loadCity } from '../src/sim/city/simfile';
import { pointInRing, toLngLat, type XY } from '../src/sim/core/geo';
import { SECONDS_PER_DAY, START_SECOND_OF_DAY, STEP_SECONDS } from '../src/sim/config/time';
import { encode } from '../src/sim/save/save';
import { newGame } from '../src/sim/state';
import { advance } from '../src/sim/step';
import { createWorld } from '../src/sim/world';

const loaded = loadCity(bakeSim('boston', 'mini-boston').text);
if (!loaded.ok) throw new Error(loaded.problem);
const city = loaded.city;
const world = createWorld(city, newGame({ id: 'boston', revision: 'mini-boston', hash: '-' }, { name: 'x', colour: '#000000' }, 1));
// The depot goes in the fixture's largest parcel of depot land, as day-costs.test.ts places it.
const ring = [...city.depotLand].sort((a, b) => b.length - a.length)[0]!;
const [cx, cy] = ring.reduce(([x, y], p) => [x + p[0] / ring.length, y + p[1] / ring.length], [0, 0]);
const site = [...Array(21).keys()].map((k): XY => [cx + (ring[0]![0] - cx) * k * 0.05, cy + (ring[0]![1] - cy) * k * 0.05]).find((p) => pointInRing(ring, p))!;
if (!placeDepot(world, toLngLat(city.frame, site)).ok) throw new Error('no depot');
const added = addDebugLine(world);
if (!added.ok) throw new Error(added.reason);
const build = { sha: 'bench', version: '0.0.0' };

// From 05:00 on day 1 to its close at 24:00, then day 2 up to its last step.
advance(world, SECONDS_PER_DAY - START_SECOND_OF_DAY);
const before = encode(world.state, build).length;
advance(world, SECONDS_PER_DAY - STEP_SECONDS);
const open = world.state.ledger.rows.filter((r) => r.day === 2);
const openBytes = JSON.stringify(open).length;
advance(world, STEP_SECONDS);
const closed = world.state.ledger.rows.filter((r) => r.day === 2);
const after = encode(world.state, build).length;

const sum = (kind: string) => closed.filter((r) => r.kind === kind).reduce((s, r) => s + r.amountCents, 0);
const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const line = [...world.assignment.lines.values()][0]!;
const service = [...world.services.values()][0]!;
console.log(`debug line: ${line.perDay.toFixed(1)} boardings a day modelled; route ${service.costs.routeM.toFixed(0)} m, cycle ${service.timing.cycle} s, ${service.timing.buses} buses; depot ${service.costs.pullOutM.toFixed(0)} m out, ${service.costs.pullInM.toFixed(0)} m back`);
console.log(`day 2: fares ${usd(sum('fares'))} + subsidy ${usd(sum('subsidy'))}; running ${usd(sum('running'))}, wages ${usd(sum('wages'))}, deadhead ${usd(sum('deadhead'))}, upkeep ${usd(sum('upkeep'))}; net ${usd(closed.reduce((s, r) => s + r.amountCents, 0))}`);
console.log(`save: day 2 posted ${open.length} rows (${openBytes} B as JSON) before 24:00; the close merged them into ${closed.length}, and the save grew ${after - before} B over the day`);
