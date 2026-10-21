// The scripted pacing run on Inner Boston (the M5 spec, item 1; src/sim/pacing.ts): the founding
// recipe's line from Copley to the Longwood Medical Area (PLAN §3's first ten minutes), then T03's ten
// corridors as candidates. The player plays day 1 at 600x and every day after at the ladder's 4,
// 2,700x since the tuning freeze (PLAN §3's table presses play at 600x; PACING_RATE sets the later
// days' game seconds a second); its own time at the tools is PLAN §3's, 3.5 minutes from New game to
// play, then a minute and a half for each line it draws and half a minute for each depot. Prints each
// milestone's game day and real minutes against PLAN §3's targets, the lines drawn, the contracts paid
// and each quarter's card with its four grades and the company at its close, and writes them to
// .cache/bench/pacing.json. `npm run bench pacing` (PACING_SEED, the new game's seed, 1 by default;
// PACING_DAYS, PACING_RESERVE_CENTS, PACING_RATE).
// It exits 1 when profit, the report card or the second line misses PLAN §3's minutes, or one of
// Boston's balance bands moves (BANDS below), so the nightly run on GitHub's runner holds them on seeds
// 1-3 (gold, 2-4 hours, waits for the medal ladder's answer and only reports).
// For the medal ladder's question (DECISIONS, Open), three switches, off by default so the nightly
// plays the player its bands were measured on: PACING_CARD_CENTS, what a point of the card's overall
// is worth to the player a day (0, the next day's net alone; 16000 is a day's grant a point,
// config/report.ts); PACING_CANDIDATES=wide, which adds the 348 lines between the densest
// neighbourhoods (bench/dense.ts) to T03's corridors; and PACING_REPORT_ONLY=1, which prints everything
// and always exits 0. PACING_PROGRESS=1 prints each card and line as the run reaches it.
import { mkdirSync, writeFileSync } from 'node:fs';
import { DEBUG_STOPS } from '../src/sim/commands/debugLine';
import { FOUNDING_HEADWAYS } from '../src/sim/config/lines';
import { corridorCandidates, playScripted } from '../src/sim/pacing';
import { newGame } from '../src/sim/state';
import { createWorld } from '../src/sim/world';
import { SPEED_RATES } from '../src/sim/rules/speed';
import { denseCandidates } from './dense';
import { CORRIDORS, innerBostonCity } from './inner';

const city = innerBostonCity();
if (!city) throw new Error('pacing: no Inner Boston; bake it with node tools/bake/sim.mjs boston inner-boston, or npm run cities');

const player = { newGameToPlay: 3.5, perLine: 1.5, perDepot: 0.5 };
const later = Number(process.env.PACING_RATE ?? SPEED_RATES[4]);
const seed = Number(process.env.PACING_SEED ?? 1);
const reserveCents = Number(process.env.PACING_RESERVE_CENTS ?? 0);
const maxDays = Number(process.env.PACING_DAYS ?? 200);
/** The player's default is the tuning freeze's: the next day's net alone, so the measured bands below stay its. */
const cardCentsPerPoint = Number(process.env.PACING_CARD_CENTS ?? 0);
/** Days between tries after one that found nothing to draw: 1, the tuning freeze's player, by default. */
const retryDays = Number(process.env.PACING_RETRY_DAYS ?? 1);
const wide = process.env.PACING_CANDIDATES === 'wide';
const reportOnly = process.env.PACING_REPORT_ONLY === '1';
const progress = process.env.PACING_PROGRESS === '1';
/** PLAN §3's targets, in real minutes. */
const TARGETS = { profit: [0, 8], secondLine: [15, 25], reportCard: [0, 20], gold: [120, 240] } as const;
/** The targets a run must meet, or exit 1: gold waits for the medal ladder's answer (DECISIONS, Open). */
const HELD = ['profit', 'reportCard', 'secondLine'] as const;
/**
 * Boston's balance bands (the M5 spec, item 2; EC-12), measured at the tuning freeze on seeds 1-3 with
 * room either side (DECISIONS, Measured, 2026-10-14), so a change that moves one fails the nightly: the
 * founding recipe's second day's running net, the game day the second line is drawn, and the first
 * quarter's grade. The best first line's net is `npm run bench firstline`'s.
 */
const BANDS = { foundingDay2NetCents: [80_000, 140_000], secondLineDay: [18, 35], firstCard: [60, 70] } as const;

const t0 = performance.now();
const world = createWorld(city, newGame({ id: 'boston', revision: 'inner-boston', hash: '-' }, { name: 'Back Bay Transit', colour: '#2471a3' }, seed));
const corridors = corridorCandidates(world, CORRIDORS);
const dense = wide ? denseCandidates(world) : [];
const result = playScripted(world, { name: 'the founding recipe', stops: DEBUG_STOPS.map((s) => s.at), headways: FOUNDING_HEADWAYS }, [...corridors, ...dense], {
  rateOn: (day) => (day === 1 ? SPEED_RATES[3] : later),
  player,
  reserveCents,
  maxDays,
  cardCentsPerPoint,
  retryDays,
  ...(progress
    ? {
        onProgress: (e) =>
          console.log(
            `  … ${
              'card' in e
                ? `card on day ${e.card.day} (${e.card.minutes.toFixed(1)} min): ${e.card.overall.toFixed(1)} (coverage ${e.card.coverage.toFixed(1)}, reliability ${e.card.reliability.toFixed(1)}, comfort ${e.card.comfort.toFixed(1)}, money ${e.card.money.toFixed(1)}); ${e.card.trips} trips; ${e.card.lines} lines, ${e.card.depots} depots, ${e.card.buses} buses; cash $${Math.round(e.card.cashCents / 100).toLocaleString('en-US')}`
                : `line on day ${e.line.day}: ${e.line.name}`
            } (${((performance.now() - t0) / 1000).toFixed(0)} s)`,
          ),
      }
    : {}),
});

const usd = (cents: number) => `$${Math.round(cents / 100).toLocaleString('en-US')}`;
const signed = (cents: number) => `${cents < 0 ? '-' : '+'}${usd(Math.abs(cents))}`;
console.log(
  `pacing on Inner Boston, seed ${seed}: day 1 at 600x, then ${later.toLocaleString('en-US')}x; ${player.newGameToPlay} min to play, ${player.perLine} min a line; reserve ${usd(reserveCents)}; a card point ${usd(cardCentsPerPoint)} a day; tried again ${retryDays === 1 ? 'each day' : `every ${retryDays} days`} after nothing; ${corridors.length} corridor candidates${wide ? ` and ${dense.length} between dense neighbourhoods` : ''}`,
);
for (const c of result.contracts) console.log(`  day ${String(c.day).padStart(3)}: ${c.kind} ${c.ask} at ${c.landmark} paid ${usd(c.rewardCents)}`);
for (const l of result.lines)
  console.log(`  day ${String(l.day).padStart(3)} (${l.minutes.toFixed(1).padStart(6)} min): ${l.name}, ${signed(l.gainCents)} the next day, card ${l.cardPoints < 0 ? '' : '+'}${l.cardPoints.toFixed(2)}; ${l.depots} depots, ${l.buses} buses`);
for (const c of result.cards)
  console.log(
    `  quarter card on day ${String(c.day).padStart(3)} (${c.minutes.toFixed(1).padStart(6)} min): ${c.overall.toFixed(1)} (coverage ${c.coverage.toFixed(1)}, reliability ${c.reliability.toFixed(1)}, comfort ${c.comfort.toFixed(1)}, money ${c.money.toFixed(1)}), lowest ${c.lowest}; ${c.trips} trips; ${c.lines} lines, ${c.depots} depots, ${c.buses} buses; cash ${usd(c.cashCents)}`,
  );
for (const [name, [lo, hi]] of Object.entries(TARGETS)) {
  const m = result.at[name];
  const verdict = !m ? 'not reached' : m.minutes < lo ? 'early' : m.minutes > hi ? 'late' : 'on target';
  console.log(`  ${name.padEnd(11)} ${m ? `day ${m.day}, ${m.minutes.toFixed(1)} min` : 'not reached'} (target ${lo}–${hi} min): ${verdict}`);
}
for (const medal of ['bronze', 'silver']) console.log(`  ${medal.padEnd(11)} ${result.at[medal] ? `day ${result.at[medal]!.day}, ${result.at[medal]!.minutes.toFixed(1)} min` : 'not reached'}`);
console.log(`  ${world.state.lines.length} lines, ${world.state.depots.length} depots, ${result.tripsADay} trips on the last day, ${result.carried} carried; cash ${usd(result.cashCents)} (${((performance.now() - t0) / 1000).toFixed(0)} s)`);
mkdirSync('.cache/bench', { recursive: true });
writeFileSync('.cache/bench/pacing.json', `${JSON.stringify({ seed, player, later, reserveCents, cardCentsPerPoint, candidates: wide ? 'wide' : 'corridors', ...result }, null, 2)}\n`);
// Read at day 2's close: by the run's end the ledger has folded it (src/sim/economy/ledger.ts DAYS_KEPT).
const day2 = result.secondDayNetCents;
const balance = { foundingDay2NetCents: day2, secondLineDay: result.at.secondLine?.day ?? null, firstCard: result.cards[0]?.overall ?? null };
console.log(`  balance     founding recipe day 2 ${day2 === null ? '-' : usd(day2)}; second line on day ${balance.secondLineDay ?? '-'}; first card ${balance.firstCard?.toFixed(1) ?? '-'}`);
const missed: string[] = HELD.filter((name) => {
  const m = result.at[name];
  return !m || m.minutes < TARGETS[name][0] || m.minutes > TARGETS[name][1];
});
for (const [name, [lo, hi]] of Object.entries(BANDS)) {
  const v = balance[name as keyof typeof balance];
  if (v === null || v < lo || v > hi) missed.push(`${name} (${v ?? 'none'}, band ${lo}–${hi})`);
}
if (missed.length > 0) {
  console.log(`missed PLAN §3 or a balance band on seed ${seed}: ${missed.join(', ')}${reportOnly ? ' (PACING_REPORT_ONLY: reported, exit 0)' : ''}`);
  if (!reportOnly) process.exitCode = 1;
}
