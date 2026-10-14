// The scripted pacing run on Inner Boston (the M5 spec, item 1; src/sim/pacing.ts): the founding
// recipe's line from Copley to the Longwood Medical Area (PLAN §3's first ten minutes), then T03's ten
// corridors as candidates. The player plays day 1 at 600x and every day after at 1,800x (PLAN §3's
// table presses play at 600x; PACING_RATE sets the later days' game seconds a second); its own time at the tools is
// PLAN §3's, 3.5 minutes from New game to play, then a minute and a half for each line it draws and
// half a minute for each depot. Prints each milestone's game day and real minutes against PLAN §3's
// targets, the lines drawn, the contracts paid and each quarter's card, and writes them to
// .cache/bench/pacing.json. `npm run bench pacing` (PACING_DAYS, PACING_RESERVE_CENTS, PACING_RATE);
// nightly on GitHub's runner too.
import { mkdirSync, writeFileSync } from 'node:fs';
import { DEBUG_STOPS } from '../src/sim/commands/debugLine';
import { FOUNDING_HEADWAYS } from '../src/sim/config/lines';
import { corridorCandidates, playScripted } from '../src/sim/pacing';
import { newGame } from '../src/sim/state';
import { createWorld } from '../src/sim/world';
import { SPEED_RATES } from '../src/sim/rules/speed';
import { CORRIDORS, innerBostonCity } from './inner';

const city = innerBostonCity();
if (!city) throw new Error('pacing: no Inner Boston; bake it with node tools/bake/sim.mjs boston inner-boston, or npm run cities');

const player = { newGameToPlay: 3.5, perLine: 1.5, perDepot: 0.5 };
const later = Number(process.env.PACING_RATE ?? 1_800);
const reserveCents = Number(process.env.PACING_RESERVE_CENTS ?? 0);
const maxDays = Number(process.env.PACING_DAYS ?? 200);
/** PLAN §3's targets, in real minutes. */
const TARGETS = { profit: [0, 8], secondLine: [15, 25], reportCard: [0, 20], gold: [120, 240] } as const;

const t0 = performance.now();
const world = createWorld(city, newGame({ id: 'boston', revision: 'inner-boston', hash: '-' }, { name: 'Back Bay Transit', colour: '#2471a3' }, 1));
const result = playScripted(world, { name: 'the founding recipe', stops: DEBUG_STOPS.map((s) => s.at), headways: FOUNDING_HEADWAYS }, corridorCandidates(world, CORRIDORS), {
  rateOn: (day) => (day === 1 ? SPEED_RATES[3] : later),
  player,
  reserveCents,
  maxDays,
});

const usd = (cents: number) => `$${Math.round(cents / 100).toLocaleString('en-US')}`;
console.log(`pacing on Inner Boston: day 1 at 600x, then ${later.toLocaleString('en-US')}x; ${player.newGameToPlay} min to play, ${player.perLine} min a line; reserve ${usd(reserveCents)}`);
for (const c of result.contracts) console.log(`  day ${String(c.day).padStart(3)}: ${c.kind} ${c.ask} at ${c.landmark} paid ${usd(c.rewardCents)}`);
for (const l of result.lines) console.log(`  day ${String(l.day).padStart(3)} (${l.minutes.toFixed(1).padStart(6)} min): ${l.name}, +${usd(l.gainCents)} the next day`);
for (const c of result.cards) console.log(`  quarter card on day ${String(c.day).padStart(3)}: ${c.overall.toFixed(1)}, lowest ${c.lowest} ${c.lowestGrade.toFixed(1)}; ${c.trips} trips`);
for (const [name, [lo, hi]] of Object.entries(TARGETS)) {
  const m = result.at[name];
  const verdict = !m ? 'not reached' : m.minutes < lo ? 'early' : m.minutes > hi ? 'late' : 'on target';
  console.log(`  ${name.padEnd(11)} ${m ? `day ${m.day}, ${m.minutes.toFixed(1)} min` : 'not reached'} (target ${lo}–${hi} min): ${verdict}`);
}
for (const medal of ['bronze', 'silver']) console.log(`  ${medal.padEnd(11)} ${result.at[medal] ? `day ${result.at[medal]!.day}, ${result.at[medal]!.minutes.toFixed(1)} min` : 'not reached'}`);
console.log(`  ${world.state.lines.length} lines, ${world.state.depots.length} depots, ${result.tripsADay} trips on the last day, ${result.carried} carried; cash ${usd(result.cashCents)} (${((performance.now() - t0) / 1000).toFixed(0)} s)`);
mkdirSync('.cache/bench', { recursive: true });
writeFileSync('.cache/bench/pacing.json', `${JSON.stringify({ player, later, reserveCents, ...result }, null, 2)}\n`);
