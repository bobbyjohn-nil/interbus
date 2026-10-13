// Inner Boston with ten lines along real corridors, 116 stops as in T03: each line's stops are spaced
// evenly between its ends and snap to the street graph as the line tool's will. Read by the
// recompute and crowding benches once `node tools/bake/sim.mjs boston inner-boston` has baked it.
import { existsSync, readFileSync } from 'node:fs';
import { loadCity } from '../src/sim/city/simfile';
import { mint } from '../src/sim/core/ids';
import type { LinePlan } from '../src/sim/demand/assign';
import { newGame } from '../src/sim/state';
import { createWorld, planLine, type World } from '../src/sim/world';

const INNER = '.cache/bake/boston/sim-inner-boston.json';
const CORRIDORS: [name: string, from: [number, number], to: [number, number], stops: number][] = [
  ['Massachusetts Avenue', [-71.119, 42.3736], [-71.0838, 42.3293], 12],
  ['Huntington Avenue', [-71.0776, 42.3496], [-71.111, 42.3285], 12],
  ['Washington Street', [-71.0603, 42.3555], [-71.0985, 42.317], 12],
  ['Columbia Road', [-71.0571, 42.3302], [-71.087, 42.319], 12],
  ['Cambridge Street', [-71.0767, 42.3706], [-71.119, 42.3736], 12],
  ['Commonwealth Avenue', [-71.0953, 42.3488], [-71.13, 42.3519], 11],
  ['Beacon Street', [-71.0953, 42.3488], [-71.1495, 42.3361], 11],
  ['Dorchester Avenue', [-71.0552, 42.3523], [-71.0524, 42.3209], 11],
  ['East Boston', [-71.0396, 42.3691], [-71.0047, 42.3868], 11],
  ['Broadway, Somerville', [-71.0768, 42.384], [-71.1218, 42.3967], 12],
];

/** The world and its ten Sparrow lines' plans, every 10 min at peak and 15 off-peak, or null if not baked. */
export function innerBoston(): { world: World; plans: LinePlan[]; names: string[] } | null {
  if (!existsSync(INNER)) {
    console.log(`bench: Inner Boston skipped; bake it with \`node tools/bake/sim.mjs boston inner-boston\``);
    return null;
  }
  const inner = loadCity(readFileSync(INNER, 'utf8'));
  if (!inner.ok) throw new Error(inner.problem);
  const world = createWorld(inner.city, newGame({ id: 'boston', revision: 'inner-boston', hash: '-' }, { name: 'x', colour: '#000000' }, 1));
  const plans = CORRIDORS.map(([name, from, to, count], n) => {
    const stopIds = Array.from({ length: count }, (_, k) => {
      const t = k / (count - 1);
      const [id, next] = mint(world.state.nextIds, 'stop');
      world.state.nextIds = next;
      world.state.stops.push({ id, lon: from[0] + (to[0] - from[0]) * t, lat: from[1] + (to[1] - from[1]) * t, tier: 1 });
      return id;
    });
    const [id, next] = mint(world.state.nextIds, 'line');
    world.state.nextIds = next;
    const line = { id, name, colour: '#1f6fb2', stopIds, fareCents: 225, headways: { peak: 600, offpeak: 900, overnight: n % 3 === 0 ? 1800 : null }, boardedMilli: 0, buses: 10, model: 'sparrow' as const };
    world.state.lines.push(line);
    const plan = planLine(world, line);
    if (!plan) throw new Error(`bench: ${name} does not route`);
    return plan;
  });
  return { world, plans, names: CORRIDORS.map(([name]) => name) };
}
