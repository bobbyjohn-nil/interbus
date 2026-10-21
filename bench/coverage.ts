// What Coverage 60 takes on Inner Boston: gold asks for no grade under GOLD_GRADE_MIN (config/medals.ts),
// and Coverage is the grade the scripted pacing run leaves lowest (sim/pacing.ts). Coverage counts each
// resident by the best stop within a walk (MAX_WALK_M), at (calls a day ÷ 64)^0.75 held at 1
// (economy/reportCard.ts), so every 15 minutes all day (76 calls) counts in full, every 20 (57) at
// 0.92 and every 30 (38) at 0.68. Lines are laid along the streets as the pacing run lays them, on
// T03's ten corridors (the pacing run's own candidates) and between the densest neighbourhoods
// (bench/dense.ts, the pacing run's with PACING_CANDIDATES=wide), and priced in Sparrows by the line
// rule at each all-day headway. Each pool's network is then picked greedily, the line that brings the
// most residents newly in reach per bus first, within the 30 buses five depots park and on past them
// until Coverage reaches 60. The best 30-bus networks are then founded for real (depots, Create, each
// line at its band's best fare) and graded after a quarter. Also prints the ceilings: a stop on every
// street, and the densest land. `npm run bench coverage`; it reports and always exits 0.
import { createLine } from '../src/sim/commands/createLine';
import { setFare } from '../src/sim/commands/setFare';
import { DEPOT_CAPACITY, MAX_DEPOTS } from '../src/sim/config/depots';
import { MAX_WALK_M } from '../src/sim/config/demand';
import { SPARROW } from '../src/sim/config/fleet';
import { GOLD_GRADE_MIN } from '../src/sim/config/medals';
import { COVERAGE_EXPONENT, COVERAGE_FULL_CALLS } from '../src/sim/config/report';
import { DAYS_PER_QUARTER, SECONDS_PER_DAY, SERVICE_DAY } from '../src/sim/config/time';
import { distM, SpatialGrid, toXY, type LngLat, type XY } from '../src/sim/core/geo';
import { fareBand } from '../src/sim/economy/fareBand';
import { foundLedger } from '../src/sim/economy/ledger';
import { corridorCandidates, DEPOT_REACH_M, placeDepotNear } from '../src/sim/pacing';
import { isOperating } from '../src/sim/rules/money';
import { checkLineDraft } from '../src/sim/rules/line';
import { newGame } from '../src/sim/state';
import { advance } from '../src/sim/step';
import { createWorld, lineDraftContext } from '../src/sim/world';
import { denseLines } from './dense';
import { CORRIDORS, innerBostonCity } from './inner';

const city = innerBostonCity();
if (!city) throw new Error('coverage: no Inner Boston; bake it with node tools/bake/sim.mjs boston inner-boston, or npm run cities');
const t0 = performance.now();
const REF = { id: 'boston', revision: 'inner-boston', hash: '-' };
const world = createWorld(city, newGame(REF, { name: 'x', colour: '#000000' }, 1));
const CEILING = MAX_DEPOTS * DEPOT_CAPACITY;

// Every home sub-point, and a grid to find those within a walk of a stop.
const xs: number[] = [];
const ys: number[] = [];
const ws: number[] = [];
const homes = new SpatialGrid<number>(MAX_WALK_M);
for (const cell of city.cells)
  for (const p of cell.homes) {
    homes.add([p.x, p.y], xs.length);
    xs.push(p.x);
    ys.push(p.y);
    ws.push(p.w);
  }
const residents = ws.reduce((s, w) => s + w, 0);
const pct = (w: number) => (100 * w) / residents;

/** The homes within a walk of any of `stops`, by index. */
function walkShed(stops: readonly XY[]): Int32Array {
  const seen = new Set<number>();
  for (const s of stops) homes.forEachWithin(s, MAX_WALK_M, (i) => void seen.add(i));
  return Int32Array.from([...seen].sort((a, b) => a - b));
}

// The ceiling with a stop on every street: residents within a walk of any node a stop may stand on.
let nearStreet = 0;
for (let i = 0; i < xs.length; i++) if (world.nodes.nearest([xs[i]!, ys[i]!], MAX_WALK_M)) nearStreet += ws[i]!;

// The densest land: cells by residents, the area holding GOLD_GRADE_MIN% of them.
const cellKm2 = (city.cellMetres * city.cellMetres) / 1e6;
const byDensity = [...city.cells].map((c) => c.residents).sort((a, b) => b - a);
let held = 0;
let cellsFor = 0;
while (held < (residents * GOLD_GRADE_MIN) / 100) held += byDensity[cellsFor++]!;
const peopled = byDensity.filter((r) => r > 0).length;

// Candidates: the pacing run's on T03's corridors, and lines between the densest neighbourhoods (bench/dense.ts).
const corridorLines: { name: string; stops: LngLat[] }[] = corridorCandidates(world, CORRIDORS).map((c) => ({ name: c.name, stops: [...c.stops] }));
const pairLines = denseLines(world);

const roomy = { ...lineDraftContext(world), depots: 1_000, busesOwned: 0, cashCents: 1e12 };
interface Priced {
  readonly name: string;
  readonly stops: readonly LngLat[];
  readonly routeM: number;
  readonly buses: number;
  readonly shed: Int32Array;
}
const HEADWAYS = [900, 1_200, 1_800] as const;
function price(lines: readonly { name: string; stops: LngLat[] }[], h: number): Priced[] {
  const out: Priced[] = [];
  for (const l of lines) {
    const verdict = checkLineDraft(roomy, l.stops.map((s) => toXY(city!.frame, s)), { peak: h, offpeak: h, overnight: null }, SPARROW);
    if (verdict.ok) out.push({ name: l.name, stops: l.stops, routeM: verdict.draft.routeM, buses: verdict.draft.buses, shed: walkShed(verdict.draft.stops.map((s) => s.at)) });
  }
  return out;
}

interface Greedy {
  /** The lines within the 30 buses, in the order picked. */
  readonly within: Priced[];
  readonly reachWithin: number;
  readonly busesWithin: number;
  readonly to60: { buses: number; lines: number } | null;
  readonly reachAll: number;
  readonly busesAll: number;
}
/** Picks lines by residents newly in reach per bus: those within the 30 buses, and on until Coverage 60 at `q`. */
function greedy(pool: readonly Priced[], q: number): Greedy {
  const covered = new Uint8Array(xs.length);
  const used = new Set<number>();
  const within: Priced[] = [];
  let reach = 0;
  let buses = 0;
  let reachWithin = -1;
  let busesWithin = 0;
  let to60: Greedy['to60'] = null;
  for (;;) {
    let best = -1;
    let bestPerBus = 0;
    for (let k = 0; k < pool.length; k++) {
      if (used.has(k)) continue;
      let gain = 0;
      for (const i of pool[k]!.shed) if (!covered[i]) gain += ws[i]!;
      if (gain / pool[k]!.buses > bestPerBus) {
        bestPerBus = gain / pool[k]!.buses;
        best = k;
      }
    }
    if (best < 0) break;
    const p = pool[best]!;
    if (reachWithin < 0 && buses + p.buses > CEILING) [reachWithin, busesWithin] = [reach, buses];
    used.add(best);
    for (const i of p.shed)
      if (!covered[i]) {
        covered[i] = 1;
        reach += ws[i]!;
      }
    buses += p.buses;
    if (reachWithin < 0) within.push(p);
    if (to60 === null && pct(reach) * q >= GOLD_GRADE_MIN) to60 = { buses, lines: used.size };
    if (to60 !== null && reachWithin >= 0) break;
  }
  if (reachWithin < 0) [reachWithin, busesWithin] = [reach, buses];
  return { within, reachWithin, busesWithin, to60, reachAll: reach, busesAll: buses };
}

/** Founds `lines` for real at all-day headway `h`, with a depot near each first stop none reaches, each line at its band's best fare, and grades its first quarter. */
function gradeNetwork(lines: readonly Priced[], h: number) {
  const w = createWorld(city!, { ...newGame(REF, { name: 'Coverage Transit', colour: '#2471a3' }, 1), ledger: foundLedger(5_000_000_000) });
  for (const l of lines) {
    const first = l.stops[0]!;
    const at = toXY(city!.frame, first);
    if (!w.state.depots.some((d) => distM(city!.frame, [d.lon, d.lat], first) <= DEPOT_REACH_M)) placeDepotNear(w, at);
    let made = createLine(w, l.stops, { peak: h, offpeak: h, overnight: null });
    // Room: another depot by the line, as the pacing player buys one.
    while (!made.ok && made.reason === 'depot_full' && placeDepotNear(w, at)) made = createLine(w, l.stops, { peak: h, offpeak: h, overnight: null });
    if (!made.ok) {
      console.log(`    (${l.name} refused: ${made.reason})`);
      continue;
    }
    const band = fareBand(w, made.lineId);
    if (band) setFare(w, made.lineId, band.bestCents);
  }
  const capitalCents = 5_000_000_000 - w.state.ledger.cashCents;
  const events = advance(w, DAYS_PER_QUARTER * SECONDS_PER_DAY - 5 * 3_600);
  const card = events.find((e) => e.kind === 'day-closed' && e.card)!;
  const last = DAYS_PER_QUARTER;
  const net = w.state.ledger.rows.filter((r) => r.day === last && isOperating(r.kind)).reduce((s, r) => s + r.amountCents, 0);
  return { card: card.card!, trips: card.trips, lines: w.state.lines.length, depots: w.state.depots.length, buses: w.state.lines.reduce((s, l) => s + l.buses, 0), netCents: net, capitalCents };
}

const pools = { corridors: corridorLines, 'corridors and dense pairs': [...corridorLines, ...pairLines] };
console.log(
  `coverage on Inner Boston: ${Math.round(residents).toLocaleString('en-US')} residents in ${xs.length.toLocaleString('en-US')} home points, ${peopled} peopled cells of ${cellKm2.toFixed(2)} km²; ${corridorLines.length} corridor candidates, ${pairLines.length} between dense pairs`,
);
console.log(`  a stop on every street reaches ${pct(nearStreet).toFixed(1)}% of residents within ${MAX_WALK_M} m`);
console.log(`  the densest ${(cellsFor * cellKm2).toFixed(1)} km² (${cellsFor} cells of ${peopled}, ${((100 * cellsFor) / peopled).toFixed(0)}% of the peopled land) hold ${GOLD_GRADE_MIN}% of residents`);
for (const h of HEADWAYS) {
  const calls = Math.ceil((SERVICE_DAY[1] - SERVICE_DAY[0]) / h);
  const q = Math.min(1, calls / COVERAGE_FULL_CALLS) ** COVERAGE_EXPONENT;
  console.log(`  every ${h / 60} min all day: ${calls} calls, each resident in reach counted ${q.toFixed(3)}; Coverage ${GOLD_GRADE_MIN} needs ${(GOLD_GRADE_MIN / q).toFixed(1)}% of residents in reach`);
  for (const [name, lines] of Object.entries(pools)) {
    const pool = price(lines, h);
    const g = greedy(pool, q);
    const perBus = pool.reduce((m, p) => Math.max(m, p.routeM / p.buses), 0);
    console.log(
      `    ${name} (${pool.length} lines; the longest route a bus ${(perBus / 1000).toFixed(2)} km): ${g.within.length} lines on ${g.busesWithin} buses reach ${pct(g.reachWithin).toFixed(1)}%, Coverage ${(pct(g.reachWithin) * q).toFixed(1)}; Coverage ${GOLD_GRADE_MIN} ${
        g.to60 ? `on ${g.to60.buses} buses, ${g.to60.lines} lines` : `never: all ${pool.length} lines reach ${pct(g.reachAll).toFixed(1)}% on ${g.busesAll} buses`
      }`,
    );
    if (h === HEADWAYS[0] || name !== 'corridors') {
      const r = gradeNetwork(g.within, h);
      const c = r.card;
      console.log(
        `      founded and run a quarter: card ${c.overall.toFixed(1)} (coverage ${c.coverage.toFixed(1)}, reliability ${c.reliability.toFixed(1)}, comfort ${c.comfort.toFixed(1)}, money ${c.money.toFixed(1)}); ${r.trips} trips on day ${DAYS_PER_QUARTER}, its operating net $${Math.round(r.netCents / 100).toLocaleString('en-US')}; ${r.lines} lines, ${r.depots} depots, ${r.buses} buses, $${Math.round(r.capitalCents / 100).toLocaleString('en-US')} of depots, stops and buses`,
      );
      console.log(`      lines: ${g.within.map((p) => `${p.name} (${p.buses})`).join('; ')}`);
    }
  }
}
console.log(`  (${((performance.now() - t0) / 1000).toFixed(0)} s)`);
