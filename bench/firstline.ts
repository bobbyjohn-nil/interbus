// I10 on Inner Boston (PLAN §5 and §6; D7, GD-11; the fixture's is src/sim/economy/startingCash.test.ts):
// every first line a starter could draw along T03's ten corridors, four stops over about 3 km from
// either end, each in a new game with a depot on the nearest depot land, at the founding headways,
// played for a quarter; the debug line beside them for reference, not counted. Prints what each costs
// beside the founding capital, its second day's net and the first day it closes in profit; exits 1
// when the best first line found without the debug line that turns a daily profit within a quarter
// does not fit the starting cash, or there is none, or when a four-bus line of the starter's shape (a
// depot, four stops, four Sparrows) costs under 1.15x the starting cash. Its best line's day-2 net is
// one of Boston's balance bands (the M5 spec, item 2; EC-12), held at $1,500–$3,500 (measured $2,523
// at the tuning freeze). `npm run bench firstline`; nightly on GitHub's runner too.
import { createLine } from '../src/sim/commands/createLine';
import { DEBUG_STOPS } from '../src/sim/commands/debugLine';
import { placeDepot } from '../src/sim/commands/placeDepot';
import { DEPOT_COST_CENTS, STARTER_STOPS, STOP_COST_CENTS } from '../src/sim/config/economy';
import { SPARROW } from '../src/sim/config/fleet';
import { DAYS_PER_QUARTER, SECONDS_PER_DAY } from '../src/sim/config/time';
import { toLngLat, toXY, type LngLat } from '../src/sim/core/geo';
import { foundingCapitalCents, rowsOfDay } from '../src/sim/economy/ledger';
import { depotNear } from '../src/sim/pacing';
import { isOperating } from '../src/sim/rules/money';
import { newGame } from '../src/sim/state';
import { advance } from '../src/sim/step';
import { createWorld } from '../src/sim/world';
import { CORRIDORS, innerBostonCity } from './inner';

const loaded = innerBostonCity();
if (!loaded) throw new Error('firstline: no Inner Boston; bake it with node tools/bake/sim.mjs boston inner-boston, or npm run cities');
const city = loaded;
const SPAN_M = 3_200;
/** The best first line's day-2 net, Boston's balance band (EC-12). */
const BEST_NET_BAND_CENTS = [150_000, 350_000] as const;

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
const rows: { name: string; cost: number; net: number; profitDay: number | null; buses: number; riders: number }[] = [];
for (const c of candidates) {
  const world = createWorld(city, newGame({ id: 'boston', revision: 'inner-boston', hash: '-' }, { name: 'x', colour: '#000000' }, 1));
  if (!placeDepot(world, depotNear(city, toXY(city.frame, c.stops[0]!))).ok) continue;
  const made = createLine(world, c.stops);
  if (!made.ok) {
    console.log(`  ${c.name}: refused (${made.reason})`);
    continue;
  }
  const line = world.state.lines[0]!;
  const riders = [...world.assignment.lines.values()][0]!.perDay;
  advance(world, DAYS_PER_QUARTER * SECONDS_PER_DAY);
  const net = (day: number) => rowsOfDay(world.state.ledger, day).filter((r) => isOperating(r.kind)).reduce((s, r) => s + r.amountCents, 0);
  const profitDay = Array.from({ length: DAYS_PER_QUARTER }, (_, k) => k + 1).find((d) => net(d) > 0) ?? null;
  rows.push({ name: c.name, cost: DEPOT_COST_CENTS + made.priceCents, net: net(2), profitDay, buses: line.buses, riders });
}
rows.sort((a, b) => b.net - a.net);
console.log(`founding capital ${usd(capital)}; a depot and a first line at the founding headways (every 20 min), day 2's running net and its first day in profit:`);
for (const r of rows) {
  console.log(`  ${r.name.padEnd(44)} ${usd(r.cost).padStart(9)} (${(r.cost / capital).toFixed(2)}×), ${r.buses} Sparrows, ${r.riders.toFixed(0).padStart(5)} riders, day 2 ${usd(r.net).padStart(8)}, ${r.profitDay ? `in profit on day ${r.profitDay}` : 'no day in profit'}`);
}
const found = rows.filter((r) => r.name !== 'the debug line');
const fits = found.filter((r) => r.cost <= capital);
// The best profitable line among all of them, then whether it fits, as PLAN §5 words I10: a line
// that profits best but costs more than the starting cash fails here, not passes over to the next.
const profitable = found.filter((r) => r.profitDay !== null);
const best = profitable[0];
const fourBus = DEPOT_COST_CENTS + STARTER_STOPS * STOP_COST_CENTS + 4 * SPARROW.priceCents;
console.log(`${fits.length} of ${found.length} fit the founding capital; ${profitable.length} turn a day's profit within a quarter; the best: ${best ? `${best.name}, ${usd(best.cost)}, ${usd(best.net)} on day 2` : 'none'}`);
console.log(`a four-bus line of the starter's shape, ${usd(fourBus)}, costs ${(fourBus / capital).toFixed(4)}× the founding capital (I10: 1.15× or more)`);
const missed: string[] = [];
if (!best) missed.push('no first line turns a daily profit within a quarter');
else if (best.cost > capital) missed.push(`the best profitable first line, ${best.name}, costs ${usd(best.cost)}, more than the starting cash`);
if (fourBus * 100 < capital * 115) missed.push('the four-bus line costs under 1.15× the starting cash');
if (best && (best.net < BEST_NET_BAND_CENTS[0] || best.net > BEST_NET_BAND_CENTS[1])) missed.push(`the best first line's day 2 ${usd(best.net)} is outside ${usd(BEST_NET_BAND_CENTS[0])}–${usd(BEST_NET_BAND_CENTS[1])}`);
if (missed.length > 0) {
  console.log(`I10 on Inner Boston: ${missed.join('; ')}`);
  process.exitCode = 1;
}
