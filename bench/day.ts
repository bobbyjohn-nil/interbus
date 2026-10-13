// One full game day of the debug line on the fixture (day 2, since day 1 starts at 05:00): its
// boardings and what they earn, the spec's magnitudes. `npm run bench day`.
import { bakeSim } from '../tools/bake/sim.mjs';
import { addDebugLine } from '../src/sim/commands/debugLine';
import { loadCity } from '../src/sim/city/simfile';
import { SECONDS_PER_DAY } from '../src/sim/config/time';
import { newGame } from '../src/sim/state';
import { advance } from '../src/sim/step';
import { createWorld } from '../src/sim/world';

const loaded = loadCity(bakeSim('boston', 'mini-boston').text);
if (!loaded.ok) throw new Error(loaded.problem);
const world = createWorld(loaded.city, newGame({ id: 'boston', revision: 'mini-boston', hash: '-' }, { name: 'x', colour: '#000000' }, 1));
const added = addDebugLine(world);
if (!added.ok) throw new Error(added.reason);
advance(world, 2 * SECONDS_PER_DAY);
const sum = (kind: string) => world.state.ledger.rows.filter((r) => r.kind === kind && r.day === 2).reduce((s, r) => s + r.amountCents, 0);
const line = [...world.assignment.lines.values()][0]!;
console.log(`debug line: ${line.perDay.toFixed(1)} boardings a day modelled; day 2 banked fares $${(sum('fares') / 100).toFixed(2)} + subsidy $${(sum('subsidy') / 100).toFixed(2)} = $${((sum('fares') + sum('subsidy')) / 100).toFixed(2)}`);
