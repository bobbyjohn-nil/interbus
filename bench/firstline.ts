// A first line on Inner Boston against the starting cash (city-boston-r1; D7, GD-11): every
// candidate a starter could draw along T03's ten corridors, four stops over about 3 km from either
// end, plus the debug line, each in a new game with a depot on the nearest depot land, at the founding
// headways. Prints what each costs beside the founding capital and what its second day nets, so the
// best profitable first line can be seen to fit the starting cash (and a four-bus line not to).
// `npm run bench firstline`, once `node tools/bake/sim.mjs boston inner-boston` has baked it.
import { existsSync, readFileSync } from 'node:fs';
import { createLine } from '../src/sim/commands/createLine';
import { DEBUG_STOPS } from '../src/sim/commands/debugLine';
import { placeDepot } from '../src/sim/commands/placeDepot';
import { loadCity } from '../src/sim/city/simfile';
import { DEPOT_COST_CENTS } from '../src/sim/config/economy';
import { SECONDS_PER_DAY } from '../src/sim/config/time';
import { distXY, pointInRing, toLngLat, toXY, type LngLat, type XY } from '../src/sim/core/geo';
import { foundingCapitalCents, rowsOfDay } from '../src/sim/economy/ledger';
import { newGame } from '../src/sim/state';
import { advance } from '../src/sim/step';
import { createWorld } from '../src/sim/world';
import { CORRIDORS } from './inner';

const INNER = '.cache/bake/boston/sim-inner-boston.json';
if (!existsSync(INNER)) throw new Error(`no ${INNER}: bake it with node tools/bake/sim.mjs boston inner-boston`);
const loaded = loadCity(readFileSync(INNER, 'utf8'));
if (!loaded.ok) throw new Error(loaded.problem);
const city = loaded.city;
const SPAN_M = 3_200;

/** A point inside the depot-land parcel nearest `at`. */
function depotNear(at: XY): LngLat {
  let best: { p: XY; d: number } | null = null;
  for (const ring of city.depotLand) {
    const c: XY = ring.reduce(([x, y], p) => [x + p[0] / ring.length, y + p[1] / ring.length], [0, 0]);
    for (let t = 0; t <= 1; t += 0.05) {
      const p: XY = [c[0] + (ring[0]![0] - c[0]) * t, c[1] + (ring[0]![1] - c[1]) * t];
      if (!pointInRing(ring, p)) continue;
      const d = distXY(p, at);
      if (!best || d < best.d) best = { p, d };
      break;
    }
  }
  return toLngLat(city.frame, best!.p);
}

const candidates: { name: string; stops: LngLat[] }[] = [{ name: 'the debug line', stops: DEBUG_STOPS.map((s) => s.at) }];
for (const [name, from, to] of CORRIDORS) {
  for (const [a, b, end] of [[from, to, 'from its first end'], [to, from, 'from its second end']] as const) {
    const [ax, ay] = toXY(city.frame, a);
    const [bx, by] = toXY(city.frame, b);
    const len = Math.hypot(bx - ax, by - ay);
    const span = Math.min(SPAN_M, len);
    candidates.push({ name: `${name}, ${end}`, stops: [0, 1, 2, 3].map((k) => toLngLat(city.frame, [ax + ((bx - ax) * span * k) / 3 / len, ay + ((by - ay) * span * k) / 3 / len])) });
  }
}

const capital = foundingCapitalCents();
const usd = (cents: number) => `${cents < 0 ? '-' : ''}$${Math.round(Math.abs(cents) / 100).toLocaleString('en-US')}`;
const rows: { name: string; cost: number; net: number; buses: number; riders: number }[] = [];
for (const c of candidates) {
  const world = createWorld(city, newGame({ id: 'boston', revision: 'inner-boston', hash: '-' }, { name: 'x', colour: '#000000' }, 1));
  if (!placeDepot(world, depotNear(toXY(city.frame, c.stops[0]!))).ok) continue;
  const made = createLine(world, c.stops);
  if (!made.ok) {
    console.log(`  ${c.name}: refused (${made.reason})`);
    continue;
  }
  const line = world.state.lines[0]!;
  const riders = [...world.assignment.lines.values()][0]!.perDay;
  advance(world, 2 * SECONDS_PER_DAY);
  const net = rowsOfDay(world.state.ledger, 2).reduce((s, r) => s + r.amountCents, 0);
  rows.push({ name: c.name, cost: DEPOT_COST_CENTS + made.priceCents, net, buses: line.buses, riders });
}
rows.sort((a, b) => b.net - a.net);
console.log(`founding capital ${usd(capital)}; a depot and a first line at the founding headways (every 20 min), day 2's net:`);
for (const r of rows) console.log(`  ${r.name.padEnd(44)} ${usd(r.cost).padStart(9)} (${(r.cost / capital).toFixed(2)}×), ${r.buses} Sparrows, ${r.riders.toFixed(0).padStart(5)} riders, day 2 ${usd(r.net).padStart(8)}`);
const fits = rows.filter((r) => r.cost <= capital);
const profitable = fits.filter((r) => r.net > 0);
console.log(`${fits.length} of ${rows.length} fit the founding capital; ${profitable.length} of those net above $0 on day 2; the best: ${profitable[0] ? `${profitable[0].name}, ${usd(profitable[0].net)}` : 'none'}`);
