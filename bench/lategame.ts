// What a late company can spend its cash on (D26's values pass). The nightly's profit-only player (sim/pacing.ts) stops drawing
// lines on Inner Boston once no candidate scores, while its cash grows: $1.2 million by day 200 on seed 1 (DECISIONS, Measured,
// 2026-10-21). From where it stands at the end of its run, each investment the game offers is tried on the game as it stands for
// a day, and taken back as an undo does:
// - every stop's next tier;
// - every line's bigger bus;
// - every line's peak and off-peak one step more often (config/lines.ts HEADWAY_MINUTES), with the buses that takes.
// Each prints its price, what it changes in the next day's operating net and in the card's overall, and, for those that pay, the
// days they take to. `npm run bench lategame` (PACING_SEED and PACING_DAYS as bench/pacing.ts, 1 and 200 by default); it
// reports and always exits 0.
import { DEBUG_STOPS } from '../src/sim/commands/debugLine';
import { setHeadways } from '../src/sim/commands/setHeadways';
import { setModel } from '../src/sim/commands/setModel';
import { setStopTier } from '../src/sim/commands/setStopTier';
import { BUS_MODELS } from '../src/sim/config/fleet';
import { FOUNDING_HEADWAYS, HEADWAY_MINUTES } from '../src/sim/config/lines';
import { REPORT_WEIGHTS } from '../src/sim/config/report';
import { STOP_TIERS, type StopTier } from '../src/sim/config/stops';
import { SECONDS_PER_DAY } from '../src/sim/config/time';
import { toCalendarTime } from '../src/sim/core/calendar';
import { rowsOfDay } from '../src/sim/economy/ledger';
import { comfortGrade, coverageGrade, moneyGrade, reliabilityGrade } from '../src/sim/economy/reportCard';
import { corridorCandidates, playScripted } from '../src/sim/pacing';
import { isOperating } from '../src/sim/rules/money';
import { SPEED_RATES } from '../src/sim/rules/speed';
import { fromSaveData } from '../src/sim/save/save';
import { newGame } from '../src/sim/state';
import { advance } from '../src/sim/step';
import { before } from '../src/sim/undo';
import { createWorld, recompute, type World } from '../src/sim/world';
import { CORRIDORS, innerBostonCity } from './inner';

const city = innerBostonCity();
if (!city) throw new Error('lategame: no Inner Boston; bake it with node tools/bake/sim.mjs boston inner-boston, or npm run cities');
const seed = Number(process.env.PACING_SEED ?? 1);
const maxDays = Number(process.env.PACING_DAYS ?? 200);
const t0 = performance.now();

const world = createWorld(city, newGame({ id: 'boston', revision: 'inner-boston', hash: '-' }, { name: 'Back Bay Transit', colour: '#2471a3' }, seed));
const run = playScripted(world, { name: 'the founding recipe', stops: DEBUG_STOPS.map((s) => s.at), headways: FOUNDING_HEADWAYS }, corridorCandidates(world, CORRIDORS), {
  rateOn: (day) => (day === 1 ? SPEED_RATES[3] : SPEED_RATES[4]),
  player: { newGameToPlay: 3.5, perLine: 1.5, perDepot: 0.5 },
  reserveCents: 0,
  maxDays,
});

const usd = (cents: number) => `${cents < 0 ? '-' : ''}$${Math.round(Math.abs(cents) / 100).toLocaleString('en-US')}`;
const net = (w: World, day: number) =>
  rowsOfDay(w.state.ledger, day)
    .filter((r) => isOperating(r.kind))
    .reduce((s, r) => s + r.amountCents, 0);
const overall = (w: World, day: number) =>
  REPORT_WEIGHTS.coverage * coverageGrade(w) + REPORT_WEIGHTS.reliability * reliabilityGrade(w) + REPORT_WEIGHTS.comfort * comfortGrade(w) + REPORT_WEIGHTS.money * moneyGrade(w, day, day);

// The day the trials play, and the company's own on it.
const kept = before(world);
const day = toCalendarTime(world.state.elapsed).day;
const restore = () => {
  world.state = fromSaveData(kept);
  recompute(world);
};
advance(world, SECONDS_PER_DAY);
const baseNet = net(world, day);
const baseCard = overall(world, day);
restore();

interface Tried {
  readonly kind: string;
  readonly what: string;
  readonly priceCents: number;
  readonly gainCents: number;
  readonly points: number;
}
/** Plays `act` on the game as it stands for a day and takes it back; null when the game refuses it. */
function tryIt(kind: string, what: string, act: () => number | null): Tried | null {
  const priceCents = act();
  if (priceCents === null) {
    restore();
    return null;
  }
  advance(world, SECONDS_PER_DAY);
  const tried = { kind, what, priceCents, gainCents: net(world, day) - baseNet, points: overall(world, day) - baseCard };
  restore();
  return tried;
}

const tried: Tried[] = [];
const refused = new Map<string, number>();
const refuse = (reason: string) => refused.set(reason, (refused.get(reason) ?? 0) + 1);
for (const stop of [...world.state.stops]) {
  const up = (stop.tier + 1) as StopTier;
  if (!STOP_TIERS[up]) continue;
  const t = tryIt('stop', `stop ${stop.id} to a ${STOP_TIERS[up].name}`, () => {
    const done = setStopTier(world, stop.id, up);
    if (!done.ok) refuse(`stop: ${done.reason}`);
    return done.ok ? done.priceCents : null;
  });
  if (t) tried.push(t);
}
for (const line of [...world.state.lines]) {
  for (const model of Object.values(BUS_MODELS)) {
    if (model.seats <= BUS_MODELS[line.model].seats) continue;
    const t = tryIt('bus', `${line.name} on ${model.name}s`, () => {
      const done = setModel(world, line.id, model.id);
      if (!done.ok) refuse(`bus: ${done.reason}`);
      return done.ok ? done.buyCents - done.saleCents : null;
    });
    if (t) tried.push(t);
  }
  const step = (s: number) => [...HEADWAY_MINUTES].reverse().find((m) => m * 60 < s);
  const [peak, offpeak] = [step(line.headways.peak), step(line.headways.offpeak)];
  if (peak !== undefined && offpeak !== undefined) {
    const t = tryIt('more often', `${line.name} every ${peak}/${offpeak} min`, () => {
      const done = setHeadways(world, line.id, { peak: peak * 60, offpeak: offpeak * 60, overnight: line.headways.overnight });
      if (!done.ok) refuse(`more often: ${done.reason}`);
      return done.ok ? done.priceCents : null;
    });
    if (t) tried.push(t);
  }
}

const buses = world.state.lines.reduce((s, l) => s + l.buses, 0);
console.log(
  `lategame on Inner Boston, seed ${seed}: the profit-only player's company on day ${day}: ${world.state.lines.length} lines, ${world.state.depots.length} depots, ${buses} buses, ${world.state.stops.length} stops; cash ${usd(world.state.ledger.cashCents)}; the next day's operating net ${usd(baseNet)}, its card ${baseCard.toFixed(1)}`,
);
for (const kind of ['stop', 'bus', 'more often']) {
  const all = tried.filter((t) => t.kind === kind);
  const pay = all.filter((t) => t.gainCents > 0).sort((a, b) => a.priceCents / a.gainCents - b.priceCents / b.gainCents);
  const price = pay.reduce((s, t) => s + t.priceCents, 0);
  const gain = pay.reduce((s, t) => s + t.gainCents, 0);
  console.log(
    `  ${kind}: ${all.length} tried; ${pay.length} pay, for ${usd(price)}, ${usd(gain)} a day together${gain > 0 ? ` (${Math.round(price / gain)} days to pay back)` : ''}; all ${all.length} cost ${usd(all.reduce((s, t) => s + t.priceCents, 0))} and add ${all.reduce((s, t) => s + t.points, 0).toFixed(2)} card points`,
  );
  for (const t of pay.slice(0, 5)) console.log(`    ${t.what}: ${usd(t.priceCents)}, ${usd(t.gainCents)} a day (${Math.round(t.priceCents / t.gainCents)} days), card ${t.points >= 0 ? '+' : ''}${t.points.toFixed(2)}`);
}
if (refused.size) console.log(`  refused: ${[...refused].map(([r, n]) => `${r} ${n}`).join(', ')}`);
console.log(`  (${((performance.now() - t0) / 1000).toFixed(0)} s; the run's cash at its end ${usd(run.cashCents)})`);
