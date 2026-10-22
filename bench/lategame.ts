// What a late company can spend its cash on (D26's values pass). The nightly's profit-only player (sim/pacing.ts) stops drawing
// lines on Inner Boston once no candidate scores, while its cash grows: $1.2 million by day 200 on seed 1 (DECISIONS, Measured,
// 2026-10-21). From where it stands at the end of its run, each investment the game offers is tried on the game as it stands for
// a day, and taken back as an undo does:
// - every stop's next tier;
// - every line's bigger bus, at its headways;
// - every line's peak and off-peak one step more often (config/lines.ts HEADWAY_MINUTES), with the buses that takes;
// - every line's bigger bus less often, at the longest steps that keep its seats an hour, which frees bus places, the one way
//   to free one at the 30-bus ceiling: a line's headways park its spare buses, and only a model change sells them.
// The day they play is an ordinary one: while an event is on (a festival's riders, roadworks' or snow's slower buses), the
// company plays on a day as it stands first. The bench prints the riders full buses turn away, all a bigger bus could win back,
// then each trial's price, what it changes in that day's operating net and in the card's overall, and, for those that pay, the
// days they take to. Trials played one at a time can count the same riders twice, so each kind's best per stop or line that
// pays alone is also played all together.
//
// `npm run bench lategame` (PACING_SEED and PACING_DAYS as bench/pacing.ts, 1 and 200 by default; about 6 minutes). With
// PACING_CARD_CENTS and PACING_CANDIDATES=wide it plays the card-building player instead, which stops at gold (day 144 on seed 1,
// about 65 minutes) or at PACING_DAYS. LATEGAME_SAVE=<file> keeps the played company in that file with the settings it was played
// with, and reads it from there instead of playing when it exists; it refuses a file kept under other settings. Otherwise it
// reports and exits 0.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
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
import { eventPhase } from '../src/sim/rules/event';
import { isOperating } from '../src/sim/rules/money';
import { SPEED_RATES } from '../src/sim/rules/speed';
import { fromSaveData, toSaveData } from '../src/sim/save/save';
import type { SaveData } from '../src/sim/save/schema';
import { newGame } from '../src/sim/state';
import { advance } from '../src/sim/step';
import { before } from '../src/sim/undo';
import { createWorld, recompute, type World } from '../src/sim/world';
import { denseCandidates } from './dense';
import { CORRIDORS, innerBostonCity } from './inner';

const city = innerBostonCity();
if (!city) throw new Error('lategame: no Inner Boston; bake it with node tools/bake/sim.mjs boston inner-boston, or npm run cities');
const seed = Number(process.env.PACING_SEED ?? 1);
const maxDays = Number(process.env.PACING_DAYS ?? 200);
const cardCentsPerPoint = Number(process.env.PACING_CARD_CENTS ?? 0);
const wide = process.env.PACING_CANDIDATES === 'wide';
const savePath = process.env.LATEGAME_SAVE;
const settings = { seed, maxDays, cardCentsPerPoint, wide };
const t0 = performance.now();

/** What LATEGAME_SAVE keeps: the company where the run ended, and the settings that played it. */
interface Kept {
  readonly settings: typeof settings;
  readonly company: SaveData;
}
const world = createWorld(city, newGame({ id: 'boston', revision: 'inner-boston', hash: '-' }, { name: 'Back Bay Transit', colour: '#2471a3' }, seed));
const loaded = savePath !== undefined && existsSync(savePath);
if (loaded) {
  const kept = JSON.parse(readFileSync(savePath, 'utf8')) as Kept;
  if (JSON.stringify(kept.settings) !== JSON.stringify(settings)) throw new Error(`lategame: ${savePath} was played with ${JSON.stringify(kept.settings)}, not ${JSON.stringify(settings)}`);
  world.state = fromSaveData(kept.company);
  recompute(world);
} else {
  const candidates = [...corridorCandidates(world, CORRIDORS), ...(wide ? denseCandidates(world) : [])];
  playScripted(world, { name: 'the founding recipe', stops: DEBUG_STOPS.map((s) => s.at), headways: FOUNDING_HEADWAYS }, candidates, {
    rateOn: (day) => (day === 1 ? SPEED_RATES[3] : SPEED_RATES[4]),
    player: { newGameToPlay: 3.5, perLine: 1.5, perDepot: 0.5 },
    reserveCents: 0,
    maxDays,
    cardCentsPerPoint,
  });
  if (savePath !== undefined) writeFileSync(savePath, JSON.stringify({ settings, company: toSaveData(world.state) } satisfies Kept));
}
const who = cardCentsPerPoint > 0 ? `the card-building player's (a point at ${`$${cardCentsPerPoint / 100}`} a day${wide ? ', wide candidates' : ''})` : "the profit-only player's";

// An ordinary day: no event on. A festival multiplies the riders near it, and roadworks and snow slow the buses and so change
// what a headway needs, so the company plays on through them as it stands.
const playedOn: string[] = [];
for (;;) {
  const today = toCalendarTime(world.state.elapsed).day;
  const e = world.state.event;
  if (!e || eventPhase(e, today) !== 'on') break;
  playedOn.push(`${e.kind} on day ${today}`);
  advance(world, SECONDS_PER_DAY);
}

const usd = (cents: number) => `${cents < 0 ? '-' : ''}$${Math.round(Math.abs(cents) / 100).toLocaleString('en-US')}`;
const net = (w: World, day: number) =>
  rowsOfDay(w.state.ledger, day)
    .filter((r) => isOperating(r.kind))
    .reduce((s, r) => s + r.amountCents, 0);
const overall = (w: World, day: number) =>
  REPORT_WEIGHTS.coverage * coverageGrade(w) + REPORT_WEIGHTS.reliability * reliabilityGrade(w) + REPORT_WEIGHTS.comfort * comfortGrade(w) + REPORT_WEIGHTS.money * moneyGrade(w, day, day);

// The day the trials play, and the company's own on it. Each plays from the company as a save restores it, the base day too, so
// a company read from LATEGAME_SAVE measures what the played one does.
const kept = before(world);
const day = toCalendarTime(world.state.elapsed).day;
const restore = () => {
  world.state = fromSaveData(kept);
  recompute(world);
};
restore();
advance(world, SECONDS_PER_DAY);
const baseNet = net(world, day);
const baseCard = overall(world, day);
restore();

/** What a trial's commands did: what they cost and the bus places they freed, or why the game refused them. */
type Done = { readonly priceCents: number; readonly freed?: number } | { readonly refused: string };
interface Trial {
  readonly kind: string;
  /** The stop or line it changes: played together, each kind takes one trial a subject. */
  readonly subject: string;
  readonly what: string;
  readonly act: () => Done;
}
interface Played {
  readonly priceCents: number;
  readonly gainCents: number;
  readonly points: number;
  /** Bus places it frees in the depots. */
  readonly freed: number;
}
/** Plays `act` on the game as it stands for a day and takes it back. */
function play(act: () => Done): Played | { readonly refused: string } {
  const done = act();
  if ('refused' in done) {
    restore();
    return done;
  }
  advance(world, SECONDS_PER_DAY);
  const played = { priceCents: done.priceCents, gainCents: net(world, day) - baseNet, points: overall(world, day) - baseCard, freed: done.freed ?? 0 };
  restore();
  return played;
}

// The company as it stands, read once: a command changes the state it acts on, and each trial is played on a restored copy.
const stops = world.state.stops.map((s) => ({ id: s.id, tier: s.tier }));
const lines = world.state.lines.map((l) => ({ id: l.id, name: l.name, model: l.model, buses: l.buses, headways: { ...l.headways } }));
const trials: Trial[] = [];
for (const stop of stops) {
  const up = (stop.tier + 1) as StopTier;
  if (!STOP_TIERS[up]) continue;
  trials.push({
    kind: 'stop',
    subject: `stop ${stop.id}`,
    what: `stop ${stop.id} to a ${STOP_TIERS[up].name}`,
    act: () => {
      const done = setStopTier(world, stop.id, up);
      return done.ok ? { priceCents: done.priceCents } : { refused: done.reason };
    },
  });
}
for (const line of lines) {
  const subject = `line ${line.id}`;
  const seats = BUS_MODELS[line.model].seats;
  for (const model of Object.values(BUS_MODELS)) {
    if (model.seats <= seats) continue;
    trials.push({
      kind: 'bus',
      subject,
      what: `${line.name} on ${model.name}s`,
      act: () => {
        const done = setModel(world, line.id, model.id);
        return done.ok ? { priceCents: done.buyCents - done.saleCents, freed: line.buses - done.bought } : { refused: done.reason };
      },
    });
    // The longest steps at or under the seats an hour it runs now, each at least one step less often.
    const less = (s: number) => [...HEADWAY_MINUTES].reverse().find((m) => m * 60 > s && m * 60 * seats <= s * model.seats);
    const [lessPeak, lessOffpeak] = [less(line.headways.peak), less(line.headways.offpeak)];
    if (lessPeak !== undefined && lessOffpeak !== undefined) {
      trials.push({
        kind: 'bigger, less often',
        subject,
        what: `${line.name} on ${model.name}s every ${lessPeak}/${lessOffpeak} min`,
        act: () => {
          const slower = setHeadways(world, line.id, { peak: lessPeak * 60, offpeak: lessOffpeak * 60, overnight: line.headways.overnight });
          if (!slower.ok) return { refused: slower.reason };
          const done = setModel(world, line.id, model.id);
          return done.ok ? { priceCents: slower.priceCents + done.buyCents - done.saleCents, freed: line.buses - done.bought } : { refused: done.reason };
        },
      });
    }
  }
  const step = (s: number) => [...HEADWAY_MINUTES].reverse().find((m) => m * 60 < s);
  const [peak, offpeak] = [step(line.headways.peak), step(line.headways.offpeak)];
  if (peak !== undefined && offpeak !== undefined) {
    trials.push({
      kind: 'more often',
      subject,
      what: `${line.name} every ${peak}/${offpeak} min`,
      act: () => {
        const done = setHeadways(world, line.id, { peak: peak * 60, offpeak: offpeak * 60, overnight: line.headways.overnight });
        return done.ok ? { priceCents: done.priceCents, freed: -done.bought } : { refused: done.reason };
      },
    });
  }
}
const tried: (Trial & Played)[] = [];
const refused = new Map<string, number>();
for (const t of trials) {
  const r = play(t.act);
  if ('refused' in r) refused.set(`${t.kind}: ${r.refused}`, (refused.get(`${t.kind}: ${r.refused}`) ?? 0) + 1);
  else tried.push({ ...t, ...r });
}

const buses = lines.reduce((s, l) => s + l.buses, 0);
console.log(
  `lategame on Inner Boston, seed ${seed}: ${who} company on day ${day}, no event on${playedOn.length ? ` (it played on through ${playedOn.join(', ')})` : ''}: ${lines.length} lines, ${world.state.depots.length} depots, ${buses} buses, ${stops.length} stops; cash ${usd(world.state.ledger.cashCents)}; the day's operating net ${usd(baseNet)}, its card ${baseCard.toFixed(1)}`,
);
// What a bigger bus could win back: the riders full buses turn away (K27), the line that turns away the most first.
const shed = lines.map((l) => ({ name: l.name, d: world.assignment.lines.get(l.id) })).filter((x) => x.d);
const shedPerDay = shed.reduce((s, x) => s + x.d!.shedPerDay, 0);
const offered = shed.reduce((s, x) => s + x.d!.perDay + x.d!.shedPerDay, 0);
const most = [...shed].sort((a, b) => b.d!.shedPerDay - a.d!.shedPerDay)[0];
console.log(
  `  full buses turn away ${Math.round(shedPerDay)} riders a day of ${Math.round(offered)} (${offered > 0 ? ((100 * shedPerDay) / offered).toFixed(1) : '0.0'}%)${most && most.d!.shedPerDay > 0 ? `, the most on ${most.name} (${Math.round(most.d!.shedPerDay)})` : ''}`,
);
const frees = (p: Played) => (p.freed > 0 ? `, frees ${p.freed} bus place${p.freed === 1 ? '' : 's'}` : '');
const told = (p: Played) =>
  `${usd(p.priceCents)}, ${usd(p.gainCents)} a day${p.gainCents > 0 ? ` (${Math.round(p.priceCents / p.gainCents)} days)` : ''}, card ${p.points >= 0 ? '+' : ''}${p.points.toFixed(2)}${frees(p)}`;
for (const kind of ['stop', 'bus', 'more often', 'bigger, less often']) {
  const all = tried.filter((t) => t.kind === kind);
  const pay = all.filter((t) => t.gainCents > 0).sort((a, b) => a.priceCents / a.gainCents - b.priceCents / b.gainCents);
  const price = pay.reduce((s, t) => s + t.priceCents, 0);
  const gain = pay.reduce((s, t) => s + t.gainCents, 0);
  console.log(
    `  ${kind}: ${all.length} tried; ${pay.length} pay alone, ${usd(price)} for ${usd(gain)} a day added up${gain > 0 ? ` (${Math.round(price / gain)} days)` : ''}; all ${all.length} cost ${usd(all.reduce((s, t) => s + t.priceCents, 0))} and add ${all.reduce((s, t) => s + t.points, 0).toFixed(2)} card points, each alone`,
  );
  // The best that pays alone on each stop or line, bought together on the one day.
  const best = pay.filter((t, i) => pay.findIndex((u) => u.subject === t.subject) === i);
  if (best.length > 1) {
    const together = play(() => {
      let priceCents = 0;
      let freed = 0;
      for (const t of best) {
        const done = t.act();
        if ('refused' in done) return done;
        priceCents += done.priceCents;
        freed += done.freed ?? 0;
      }
      return { priceCents, freed };
    });
    console.log(`    all ${best.length} together: ${'refused' in together ? `refused, ${together.refused}` : told(together)}`);
  }
  // A bigger bus less often is worth its loss where the places it frees run a better line, so the five that lose least show too.
  const shown = kind === 'bigger, less often' ? [...all].sort((a, b) => b.gainCents - a.gainCents).slice(0, 5) : pay.slice(0, 5);
  for (const t of shown) console.log(`    ${t.what}: ${told(t)}`);
}
if (refused.size) console.log(`  refused: ${[...refused].map(([r, n]) => `${r} ${n}`).join(', ')}`);
console.log(`  (${((performance.now() - t0) / 1000).toFixed(0)} s${loaded ? ', the company read from LATEGAME_SAVE' : ''})`);
