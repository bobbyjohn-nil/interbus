// I4 (the M3 spec, item 13; EC-04): what splitting a line where both halves call at one stop does to
// a day's fares and subsidy, as the game charges them (once a trip, on the first line) and as V1
// did (every boarding). Each half gets the whole line's headways and the buses they need, and the
// shared stop the tier named; the whole line is measured with that tier too, so only the split
// differs. `npm run bench split`: the fixture's debug line, then Inner Boston's corridors when baked.
import { bakeSim } from '../tools/bake/sim.mjs';
import { addDebugLine } from '../src/sim/commands/debugLine';
import { loadCity, type City } from '../src/sim/city/simfile';
import { SPARROW } from '../src/sim/config/fleet';
import type { StopTier } from '../src/sim/config/stops';
import { mint } from '../src/sim/core/ids';
import { busesNeeded, cycleSeconds } from '../src/sim/rules/cycle';
import { subsidyCents } from '../src/sim/rules/fare';
import type { Headways } from '../src/sim/rules/periods';
import { newGame, type Line } from '../src/sim/state';
import { createWorld, planLine, recompute, type World } from '../src/sim/world';
import { CORRIDORS, innerBoston } from './inner';

/** A day's fares and subsidy at the modelled riders, in dollars: paid boardings, and every boarding. */
function income(world: World): { perTrip: number; perBoarding: number; changes: number } {
  let perTrip = 0;
  let perBoarding = 0;
  let changes = 0;
  for (const line of world.state.lines) {
    const d = world.assignment.lines.get(line.id)!;
    const rate = line.fareCents + subsidyCents(line.fareCents);
    perTrip += (Math.floor(d.paidPerDay) * rate) / 100;
    perBoarding += (Math.floor(d.perDay) * rate) / 100;
    changes += d.transfersByStop.reduce((s, v) => s + v, 0);
  }
  return { perTrip, perBoarding, changes };
}

/** `make` builds a world with one line; this measures it whole and split at stop `at`, with that stop of `tier`. */
function measure(name: string, make: () => World, at: number, tier: StopTier, headways: Headways): void {
  const run = (split: boolean) => {
    const world = make();
    const whole = world.state.lines[0]!;
    whole.headways = headways;
    world.state.stops.find((s) => s.id === whole.stopIds[at])!.tier = tier;
    if (split) {
      const [id, next] = mint(world.state.nextIds, 'line');
      world.state.nextIds = next;
      world.state.lines.push({ ...whole, id, name: 'Second half', stopIds: whole.stopIds.slice(at), boardedMilli: 0 });
      whole.stopIds = whole.stopIds.slice(0, at + 1);
    }
    for (const line of world.state.lines) {
      const plan = planLine(world, line)!;
      line.buses = busesNeeded(cycleSeconds(plan.stopDistM.at(-1)!, plan.stops.length, SPARROW.kmh), line.headways);
    }
    recompute(world);
    return income(world);
  };
  const before = run(false);
  const after = run(true);
  const pct = (v: number) => `${v >= before.perTrip ? '+' : ''}${(((v - before.perTrip) / before.perTrip) * 100).toFixed(1)}%`;
  console.log(
    `${name}, split at stop ${at + 1} (tier ${tier}), every ${headways.peak / 60}/${headways.offpeak / 60} min: whole $${before.perTrip.toFixed(0)} a day; ` +
      `split $${after.perTrip.toFixed(0)} (${pct(after.perTrip)}) with ${after.changes.toFixed(1)} changes; charged per boarding $${after.perBoarding.toFixed(0)} (${pct(after.perBoarding)})`,
  );
}

const loaded = loadCity(bakeSim('boston', 'mini-boston').text);
if (!loaded.ok) throw new Error(loaded.problem);
const fixture: City = loaded.city;
const debugWorld = () => {
  const world = createWorld(fixture, newGame({ id: 'boston', revision: 'mini-boston', hash: '-' }, { name: 'x', colour: '#000000' }, 1));
  addDebugLine(world);
  return world;
};
for (const minutes of [20, 10, 5]) {
  const headways = { peak: minutes * 60, offpeak: minutes * 60, overnight: null };
  for (const tier of [1, 5] as const) for (const at of [1, 2]) measure('fixture, debug line', debugWorld, at, tier, headways);
}

const inner = innerBoston();
if (inner) {
  const city = inner.world.city;
  CORRIDORS.forEach(([name], n) => {
    const template: Line = inner.world.state.lines[n]!;
    const corridor = () => {
      const world = createWorld(city, newGame({ id: 'boston', revision: 'inner-boston', hash: '-' }, { name: 'x', colour: '#000000' }, 1));
      const stops = template.stopIds.map((id) => inner.world.state.stops.find((s) => s.id === id)!);
      const stopIds = stops.map((s) => {
        const [id, next] = mint(world.state.nextIds, 'stop');
        world.state.nextIds = next;
        world.state.stops.push({ ...s, id });
        return id;
      });
      const [id, next] = mint(world.state.nextIds, 'line');
      world.state.nextIds = next;
      world.state.lines.push({ ...template, id, stopIds, boardedMilli: 0 });
      return world;
    };
    const middle = Math.floor(template.stopIds.length / 2);
    for (const tier of [1, 5] as const) measure(`Inner Boston, ${name}`, corridor, middle, tier, { peak: 600, offpeak: 900, overnight: null });
  });
}
