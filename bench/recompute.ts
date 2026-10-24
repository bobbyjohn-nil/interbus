// The recompute bench (PLAN §10 week 3, I14: ≤150 ms p95 on Boston with three periods; R2 needs
// ≤100 ms, D11). `npm run bench` bundles this file as the game's build would (vitest's module
// transform turns every imported constant into a getter call, which tripled the hot loop's time)
// and runs it in Node; never part of the PR checks. Times the demand model's whole recompute
// (assign: every catchment, every pair, all three periods) on the fixture with three lines, on a
// synthetic Inner-Boston-sized grid with T03's network, and, once `node tools/bake/sim.mjs boston
// inner-boston` has baked it, on Inner Boston itself with ten lines along real corridors, then the
// whole recompute there with five depots, on hubs of lines out of one stop, on a late game's many lines, and on the pacing run's
// card-building companies at the bus ceiling (bench/fixtures). The whole recompute is timed from nothing, its memo let go first,
// as a load runs it; a command's, one line's headways changed with the memo kept as the game keeps it (the
// assignment carries the rides of the cell pairs no changed line has a route in, and the catchments and ride tables nothing
// changed, AssignMemo), and on the late companies a fare's, which keeps the catchments, a Shelter's, which works them out
// afresh, and a festival's start and end, which change the trips of the pairs near it. Results go to .cache/bench/recompute.json.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { bakeSim } from '../tools/bake/sim.mjs';
import { addDebugLine } from '../src/sim/commands/debugLine';
import { loadCity } from '../src/sim/city/simfile';
import { toCalendarTime } from '../src/sim/core/calendar';
import { toLngLat } from '../src/sim/core/geo';
import { createLine } from '../src/sim/commands/createLine';
import { found } from '../src/sim/commands/found';
import { placeDepot } from '../src/sim/commands/placeDepot';
import { toXY } from '../src/sim/core/geo';
import { mint, type LineId } from '../src/sim/core/ids';
import { foundLedger } from '../src/sim/economy/ledger';
import { assign, type AssignMemo, type LinePlan } from '../src/sim/demand/assign';
import { buildCommuters } from '../src/sim/demand/commuters';
import { depotNear } from '../src/sim/pacing';
import { corridorStops } from '../src/sim/sweep';
import { lateScene } from '../src/sim/scene';
import { fromSaveData } from '../src/sim/save/save';
import type { SaveData } from '../src/sim/save/schema';
import { newGame } from '../src/sim/state';
import { commutersToday, createWorld, planLine, recompute, runningPlans, type World } from '../src/sim/world';
import { CORRIDORS, innerBoston } from './inner';
import { syntheticCity, t03Network } from './synthetic';

// 100 runs a case: at 30, p95 was the second-slowest run, and one or two slow runs decided it. On the nightly of
// 2026-10-18, Inner Boston's assignment read p95 170.8 ms against a p50 of 77.3; the whole recompute, which runs it, read
// p95 95.4 the same night. On a shared 4-CPU machine, 100 runs a case give p95s of 1.5–1.6× their p50s, run after run.
const RUNS = 100;
/** I14's budget on Boston; R2 (D11) needs ≤100 ms. */
const BUDGET_MS = 150;
const results: Record<string, unknown> = {};

function time(name: string, run: () => void, gate = true): { p50: number; p95: number } {
  for (let k = 0; k < 3; k++) run(); // warm the JIT
  const ms: number[] = [];
  for (let k = 0; k < RUNS; k++) {
    const t0 = performance.now();
    run();
    ms.push(performance.now() - t0);
  }
  ms.sort((a, b) => a - b);
  const out = { p50: ms[Math.floor(RUNS * 0.5)]!, p95: ms[Math.ceil(RUNS * 0.95) - 1]! };
  results[name] = { ...out, runs: RUNS, gate };
  console.log(`bench: ${name}: p50 ${out.p50.toFixed(1)} ms, p95 ${out.p95.toFixed(1)} ms over ${RUNS} runs${gate ? '' : ' (timed, not held to I14)'}`);
  if (gate && out.p95 > BUDGET_MS) {
    console.error(`bench: ${name} is over I14's ${BUDGET_MS} ms`);
    process.exitCode = 1;
  }
  return out;
}

/**
 * The whole recompute from nothing, as a load runs it: the memo's last assignment and its kept tables let go first (its arenas
 * kept, as the game keeps them once it has run). A festival's start and end carry the pairs it leaves alone (aFestival).
 */
const fromNothing = (w: World) => () => {
  w.assignMemo!.last = null;
  delete w.assignMemo!.tables;
  recompute(w);
};

/**
 * A command's recompute: each run one line's headways a half slower, or back, line after line, the memo kept between runs as the
 * game keeps it. A slower headway needs no more buses, so every line still runs.
 */
const aCommand = (w: World) => {
  const set = w.state.lines.map((line) => line.headways);
  let k = 0;
  return () => {
    const at = Math.floor(k / 2) % w.state.lines.length;
    const line = w.state.lines[at]!;
    const h = set[at]!;
    line.headways = k % 2 === 0 ? { peak: Math.round(h.peak * 1.5), offpeak: Math.round(h.offpeak * 1.5), overnight: h.overnight === null ? null : Math.round(h.overnight * 1.5) } : h;
    k++;
    recompute(w);
  };
};

/** A fare's recompute: each run one line's fare a quarter dearer, or back, line after line. */
const aFare = (w: World) => {
  const set = w.state.lines.map((line) => line.fareCents);
  let k = 0;
  return () => {
    const at = Math.floor(k / 2) % w.state.lines.length;
    w.state.lines[at]!.fareCents = k % 2 === 0 ? Math.round(set[at]! * 1.25) : set[at]!;
    k++;
    recompute(w);
  };
};

/**
 * A stop's recompute: each run one of the lines' stops made a Shelter, or back to a Sign, stop after stop (V1's first upgrade), and
 * the cell pairs with trips each Shelter's worked out afresh.
 */
const aShelter = (w: World, freshAtShelter: number[]) => {
  const stops = w.state.stops.filter((stop) => stop.tier === 1);
  let k = 0;
  return () => {
    const stop = stops[Math.floor(k / 2) % stops.length]!;
    const up = k % 2 === 0;
    stop.tier = up ? 2 : 1;
    k++;
    recompute(w);
    if (up) freshAtShelter.push(w.assignMemo!.last!.freshPairs);
  };
};

/**
 * A festival's start or end, as the recompute at the close that starts or ends it runs (step.ts, where recomputeInService works
 * out the lines' services once more first, 5–7 ms on these companies): each run a festival today round one of the company's
 * stops, stop after stop, or none, the memo kept between runs as the game keeps it. Its trips are boosted afresh at each start
 * (commutersToday), as at a festival's first close.
 */
const aFestival = (w: World, freshAtStart: number[]) => {
  const day = toCalendarTime(w.state.elapsed).day;
  let k = 0;
  return () => {
    const stop = w.state.stops[Math.floor(k / 2) % w.state.stops.length]!;
    const start = k % 2 === 0;
    w.state.event = start ? { kind: 'festival', startDay: day, endDay: day, street: `stop ${stop.id}`, edges: [], at: { lon: stop.lon, lat: stop.lat } } : null;
    k++;
    recompute(w);
    if (start) freshAtStart.push(w.assignMemo!.last!.freshPairs);
  };
};

/**
 * Whether the memo's riders are a whole assignment's, number for number, after a run of one kind of command, each kind in turn,
 * so a stale ride one kind leaves cannot hide behind the next, and after each of `steps` more of them (`more`): a run's commands
 * undo one another, so a pair one of them left stale the next would put right before the run's end could check it (memo.test.ts
 * holds the rule step by step on the fixture).
 */
function exactAfter(what: string, w: World, seed: number, more: () => void, steps: number): void {
  let same = matchesWhole(w);
  for (let k = 0; k < steps && same; k++) {
    more();
    same = matchesWhole(w);
  }
  results[`memo matches a whole assignment after ${what} commands, seed ${seed}`] = same;
  console.log(`bench: after ${what} commands, and after each of ${steps} more, the memo's riders on seed ${seed} ${same ? 'are' : 'are NOT'} a whole assignment's, number for number`);
  if (!same) process.exitCode = 1;
}

/** Whether a world's riders are a whole assignment's of it as it stands, number for number (Object.is). */
function matchesWhole(w: World): boolean {
  const fresh = assign(w.city, commutersToday(w), runningPlans(w));
  const differ = (a: unknown, b: unknown): boolean => {
    if (typeof a === 'number' || typeof b === 'number') return !Object.is(a, b);
    if (a instanceof Map && b instanceof Map) return a.size !== b.size || [...a].some(([k, v]) => differ(v, b.get(k)));
    if (ArrayBuffer.isView(a) || Array.isArray(a)) {
      const x = a as ArrayLike<unknown>;
      const y = b as ArrayLike<unknown>;
      return x.length !== y.length || Array.from(x).some((v, k) => differ(v, y[k]));
    }
    if (a && typeof a === 'object') return Object.keys(a).some((k) => differ((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
    return a !== b;
  };
  return !differ(w.assignment, fresh);
}

/**
 * What keeping the rides costs a whole assignment: one keeping them, from nothing, against one keeping none, taking turns in the
 * same runs, the first of them each run in turn, so the machine's load falls on both alike. The world is recomputed after.
 */
function keepingAgainstNot(name: string, w: World): void {
  const plans = runningPlans(w);
  const commuters = commutersToday(w);
  const keep = () => {
    w.assignMemo!.last = null;
    delete w.assignMemo!.tables;
    const t0 = performance.now();
    assign(w.city, commuters, plans, { memo: w.assignMemo });
    return performance.now() - t0;
  };
  const none = () => {
    const t0 = performance.now();
    assign(w.city, commuters, plans);
    return performance.now() - t0;
  };
  const keeping: number[] = [];
  const not: number[] = [];
  for (let k = 0; k < RUNS + 3; k++) {
    const keptFirst = k % 2 === 0;
    const a = keptFirst ? keep() : none();
    const b = keptFirst ? none() : keep();
    if (k < 3) continue;
    keeping.push(keptFirst ? a : b);
    not.push(keptFirst ? b : a);
  }
  const at = (xs: number[], q: number) => [...xs].sort((x, y) => x - y)[Math.ceil(xs.length * q) - 1]!;
  results[`keeping the rides, ${name}`] = { keeping: { p50: at(keeping, 0.5), p95: at(keeping, 0.95) }, not: { p50: at(not, 0.5), p95: at(not, 0.95) } };
  console.log(`bench: a whole assignment ${name} keeping its rides p50 ${at(keeping, 0.5).toFixed(1)} ms, p95 ${at(keeping, 0.95).toFixed(1)} ms; keeping none p50 ${at(not, 0.5).toFixed(1)} ms, p95 ${at(not, 0.95).toFixed(1)} ms, taking turns over ${RUNS} runs`);
  recompute(w);
}

const loaded = loadCity(bakeSim('boston', 'mini-boston').text);
if (!loaded.ok) throw new Error(loaded.problem);
const world = createWorld(loaded.city, newGame({ id: 'boston', revision: 'mini-boston', hash: '-' }, { name: 'x', colour: '#000000' }, 1));
addDebugLine(world);
const debug = planLine(world, world.state.lines[0]!)!;
// Two more lines over the same streets, shifted, so catchments overlap as they will.
const shift = (id: number, dx: number, dy: number): LinePlan => ({ ...debug, id: id as LineId, stops: debug.stops.map(([x, y]) => [x + dx, y + dy] as const) });
const fixturePlans = [debug, shift(2, 300, 200), shift(3, -250, 350)];
time(`mini-Boston ${world.city.cells.length} cells, 3 lines, 3 periods`, () => assign(world.city, world.commuters, fixturePlans));

const city = syntheticCity();
const commuters = buildCommuters(city);
const plans = t03Network();
const stops = plans.reduce((s, p) => s + p.stops.length, 0);
time(`synthetic ${city.cells.length} cells, ${plans.length} lines, ${stops} stops, 3 periods`, () => assign(city, commuters, plans));

const inner = innerBoston();
if (inner) {
  const { world: boston, plans: bostonPlans } = inner;
  results.innerBostonCells = boston.city.cells.length;
  time(`Inner Boston ${boston.city.cells.length} cells, ${bostonPlans.length} lines, ${bostonPlans.reduce((s, p) => s + p.stops.length, 0)} stops, 3 periods`, () => assign(boston.city, boston.commuters, bostonPlans));
  // A whole assignment on a festival's day (the M4 spec's magnitudes: I14 with events on), as a load
  // during one runs it: its flows boosted afresh each run, round Massachusetts Avenue's middle stop.
  // The closes that start and end one carry the pairs it leaves alone (aFestival, on the late
  // companies). Snow and roadworks change only the plans' times, not the work the assignment does.
  const [lon, lat] = bostonPlans[0]!.stops[6]!;
  const at = toLngLat(boston.city.frame, [lon, lat]);
  const day = toCalendarTime(boston.state.elapsed).day;
  const state = { ...boston.state, event: { kind: 'festival' as const, startDay: day, endDay: day, street: '', edges: [], at: { lon: at[0], lat: at[1] } } };
  time(`Inner Boston on a festival's first day, 3 periods`, () => assign(boston.city, commutersToday({ city: boston.city, commuters: { ...boston.commuters }, state }), bostonPlans));
  // The whole recompute as a building command runs it, with the company's depots as players have them:
  // the five Inner Boston allows (MAX_DEPOTS), each on the depot land nearest the middle of every other
  // corridor, and every line at three Sparrows every 20 minutes, the 30 buses they hold. Each line's
  // drives to and from its depot are routed once, in the warm-up, and read again in the timed runs, as a
  // command that leaves the first stops and depots as they were reads them (the systems audit's fourth
  // round: routing every line from every depot at each recompute took it to 190-240 ms at p50). A
  // command that moves a first stop or adds a depot routes its own new drives once, untimed here.
  for (const line of boston.state.lines) Object.assign(line, { buses: 3, headways: { peak: 1_200, offpeak: 1_200, overnight: null } });
  for (const n of [0, 2, 4, 6, 8]) {
    const stops = bostonPlans[n]!.stops;
    const [lon, lat] = depotNear(boston.city, stops[Math.floor(stops.length / 2)]!);
    const [id, next] = mint(boston.state.nextIds, 'depot');
    boston.state.nextIds = next;
    boston.state.depots.push({ id, lon, lat });
  }
  time(`Inner Boston's whole recompute, ${boston.state.lines.length} lines of 3 Sparrows and ${boston.state.depots.length} depots`, fromNothing(boston));
  time(`Inner Boston, a command's recompute, ${boston.state.lines.length} lines of 3 Sparrows and ${boston.state.depots.length} depots`, aCommand(boston));
  keepingAgainstNot(`of Inner Boston's ${boston.state.lines.length} lines of 3 Sparrows`, boston);

  // Hubs (the systems audit's seventh round): spokes out of Copley Square, each Copley and the next four stops along the
  // streets toward a bearing 3 km out, about 600 m apart (corridorStops), drawn as Create draws them with one Sparrow at
  // 30 minutes in the peaks and hourly off-peak, the five depots placed first round Copley. A bearing whose stops the line
  // rule refuses (a stop twice, or none near a street) gives way to the next. Every spoke changes onto every other near
  // Copley, so the cell pairs riders can make grow with the square of the lines, and the recompute with them. Hubs of 6 and
  // 8 lines are held to I14; at 10 lines and more it is over (DECISIONS, Open: I14 on a hub of lines), so they are timed
  // without failing the run until the assignment is made faster for them or the owner settles what I14 holds.
  const COPLEY: [number, number] = [-71.077, 42.3499];
  const toward = (bearing: number, m: number): [number, number] => {
    const b = (bearing * Math.PI) / 180;
    return [COPLEY[0] + (Math.sin(b) * m) / (111_320 * Math.cos((COPLEY[1] * Math.PI) / 180)), COPLEY[1] + (Math.cos(b) * m) / 110_540];
  };
  const bearings = [...Array(32).keys()].map((k) => (k < 16 ? k * 22.5 : 11.25 + (k - 16) * 22.5));
  for (const size of [6, 8, 10, 15]) {
    const hub = createWorld(boston.city, { ...newGame({ id: 'boston', revision: 'inner-boston', hash: '-' }, { name: '', colour: '#2471a3' }, 1), ledger: foundLedger(2_000_000_000) });
    found(hub, 'Back Bay Transit', '#2471a3');
    for (const at of [COPLEY, toward(0, 1_000), toward(90, 1_000), toward(180, 1_000), toward(270, 1_000), toward(45, 1_500), toward(225, 1_500)]) {
      if (hub.state.depots.length < 5) placeDepot(hub, depotNear(hub.city, toXY(hub.city.frame, at)));
    }
    for (const bearing of bearings) {
      if (hub.state.lines.length >= size) break;
      const along = corridorStops(hub, COPLEY, toward(bearing, 3_000), 600);
      if (along && along.length >= 5) createLine(hub, along.slice(0, 5), { peak: 1_800, offpeak: 3_600, overnight: null });
    }
    if (hub.state.lines.length !== size) throw new Error(`bench: the hub has ${hub.state.lines.length} lines, not ${size}`);
    const buses = hub.state.lines.reduce((n, l) => n + l.buses, 0);
    time(`Inner Boston's whole recompute, a hub of ${size} spokes out of Copley Square, ${buses} buses`, fromNothing(hub), size <= 8);
  }

  // A late game with no hub (the systems audit's seventh round, the screens with many lines; scene.ts lateScene): line after
  // line along the corridors both ways, a Sparrow an hour each, the five depots placed first. Lines on the same streets share
  // their catchments, so the recompute grows with them though few lines meet at any one stop. 10 and 15 lines are held to
  // I14; at 20 and more it is over (DECISIONS, Open: I14 on a hub of lines), so they are timed without failing the run.
  for (const n of [10, 15, 20, 30]) {
    const late = lateScene(boston.city, { id: 'boston', revision: 'inner-boston', hash: '-' }, CORRIDORS, n);
    const at = new Map<number, number>();
    for (const line of late.state.lines) for (const stop of new Set(line.stopIds)) at.set(stop, (at.get(stop) ?? 0) + 1);
    time(`Inner Boston's whole recompute, a late game of ${late.state.lines.length} lines, at most ${Math.max(...at.values())} at a stop`, fromNothing(late), n <= 15);
    if (n === 30) time(`Inner Boston, a command's recompute, a late game of ${late.state.lines.length} lines`, aCommand(late), false);
  }

  // The late game the pacing run builds (the systems audit's fifteenth round): bench/lategame.ts's card-building company
  // (PACING_CARD_CENTS=16000, wide candidates) kept by LATEGAME_SAVE on 2026-10-22, at the bus ceiling, seed 1 on day 145 (14
  // lines, 75 stops, one of 8 lines, gold since day 144) and seed 2 on day 153 (13 lines, 77 stops). Every 20 minutes on far
  // more stops than lateScene's, with 66 to 94 changes between lines and about 20,000 trips a day, it is over I14 at a p95 of
  // 251–327 ms within the hold on 15 lines and hubs of 8 (DECISIONS, Open: I14 on a hub of lines), so it is timed without
  // failing the run until the assignment is made faster for it.
  for (const seed of [1, 2]) {
    const kept = JSON.parse(readFileSync(`bench/fixtures/lategame-card-s${seed}.json`, 'utf8')) as { readonly company: SaveData };
    const company = createWorld(boston.city, fromSaveData(kept.company));
    recompute(company);
    const at = new Map<number, number>();
    for (const line of company.state.lines) for (const stop of new Set(line.stopIds)) at.set(stop, (at.get(stop) ?? 0) + 1);
    const name = `the pacing run's company on seed ${seed} at the bus ceiling, ${company.state.lines.length} lines on ${company.state.stops.length} stops, at most ${Math.max(...at.values())} at a stop`;
    time(`Inner Boston's whole recompute, ${name}`, fromNothing(company), false);
    time(`Inner Boston, a command's recompute, ${name}`, aCommand(company), false);
    exactAfter(`its headways'`, company, seed, aCommand(company), 6);
    time(`Inner Boston, a fare's recompute, ${name}`, aFare(company), false);
    exactAfter(`its fares'`, company, seed, aFare(company), 6);
    const freshAtShelter: number[] = [];
    time(`Inner Boston, a Shelter's recompute, ${name}`, aShelter(company, freshAtShelter), false);
    exactAfter(`its Shelters'`, company, seed, aShelter(company, []), 6);
    // A festival's start and end; then the cell pairs with trips and a route its starts worked out afresh, against a whole
    // assignment's, and the event as it was.
    const event = company.state.event;
    const freshAtStart: number[] = [];
    time(`Inner Boston, a festival's start or end, ${name}`, aFestival(company, freshAtStart), false);
    exactAfter(`its festivals'`, company, seed, aFestival(company, []), 6);
    company.state.event = event;
    recompute(company);
    const blank: AssignMemo = { last: null };
    assign(company.city, commutersToday(company), runningPlans(company), { memo: blank });
    const whole = blank.last!.freshPairs;
    for (const [what, counts] of [[`a Shelter`, freshAtShelter], [`a festival's start`, freshAtStart]] as const) {
      counts.sort((a, b) => a - b);
      const median = counts[Math.floor(counts.length / 2)]!;
      results[`fresh pairs, ${what}, seed ${seed}`] = { median, most: counts.at(-1), whole };
      console.log(`bench: ${what} on seed ${seed} works out ${median} cell pairs afresh at the median, ${counts.at(-1)} at most, of the ${whole} with trips that the lines serve`);
    }
    keepingAgainstNot(`of the pacing run's company on seed ${seed}`, company);
    // What the memo holds: its two arenas, the last assignment's rides and the next one's.
    const memo = company.assignMemo!;
    let bytes = 0;
    for (const arena of memo.arenas ?? []) bytes += arena.stops.byteLength + arena.riders.byteLength + arena.pairWork.byteLength + arena.pairRide.byteLength;
    results[`memo bytes, seed ${seed}`] = bytes;
    console.log(`bench: the memo of the pacing run's company on seed ${seed} holds ${(bytes / 1e6).toFixed(1)} MB in its two arenas`);
  }
}

mkdirSync('.cache/bench', { recursive: true });
writeFileSync('.cache/bench/recompute.json', `${JSON.stringify(results, null, 2)}\n`);
