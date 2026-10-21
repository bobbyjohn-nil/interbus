// The scripted pacing run (the M5 spec, item 1; PLAN §3's pacing targets, GD-10, EC-11): a scripted
// player timed in real minutes on the speed ladder. No earlier version had one; V1 took about 15
// game days to a second bus and nobody had checked (GD-10). bench/pacing.ts plays it on Inner Boston;
// pacing.test.ts plays it on the fixture in the PR checks, with bands.
//
// The player founds, places a depot on the nearest depot land and draws its first line at the
// founding headways and the fare its band calls best. At each close it takes every contract on offer
// (a lapse costs nothing) and, while its cash covers the cheapest line and a reserve, draws the
// candidate that scores best, if its score is above nothing, as often as the cash allows that day: the
// company's next day's net and, when `cardCentsPerPoint` is set, the change in the card's overall it
// brings at that much a point (a day's grant a point, config/report.ts, plays toward the card; the
// default, 0, scores by the net alone, as the tuning freeze's player did). Each candidate is tried on
// the game as it stands and taken back as an undo would, with a depot of its own when none is within
// reach of its first stop (on the next parcel along when the nearest refuses one; at the depots there
// are when none can be had), and another whenever the depots have no room for its buses. The tuning
// freeze's player drew one line a day and refused a line with no depot in reach (the review of #144:
// on Inner Boston's seed 1 it reached Coverage 31.6, this one 31.0).
import { acceptContract } from './commands/acceptContract';
import { createLine } from './commands/createLine';
import { placeDepot } from './commands/placeDepot';
import { setFare } from './commands/setFare';
import type { City } from './city/simfile';
import { STOP_COST_CENTS } from './config/economy';
import { SPARROW } from './config/fleet';
import { FOUNDING_HEADWAYS } from './config/lines';
import { REPORT_WEIGHTS } from './config/report';
import { SECONDS_PER_DAY } from './config/time';
import { toCalendarTime } from './core/calendar';
import { distM, distXY, pointInRing, toLngLat, toXY, type LngLat, type XY } from './core/geo';
import type { LineId } from './core/ids';
import { fareBand } from './economy/fareBand';
import { profitableDays, rowsOfDay } from './economy/ledger';
import { comfortGrade, coverageGrade, moneyGrade, reliabilityGrade } from './economy/reportCard';
import { isOperating } from './rules/money';
import type { Headways } from './rules/periods';
import { fromSaveData } from './save/save';
import { advance } from './step';
import { corridorStops } from './sweep';
import { before } from './undo';
import { recompute, type World } from './world';

export interface PacingCandidate {
  readonly name: string;
  readonly stops: readonly LngLat[];
  readonly headways: Headways;
}

export interface PacingOptions {
  /** Game seconds a real second each day is played at (rules/speed.ts SPEED_RATES). */
  readonly rateOn: (day: number) => number;
  /** The player's own time at the tools, in real minutes. */
  readonly player: { readonly newGameToPlay: number; readonly perLine: number; readonly perDepot: number };
  /** Cash kept back when drawing a line. */
  readonly reserveCents: number;
  /** Days played before giving up on the top medal. */
  readonly maxDays: number;
  /**
   * After a day that drew nothing (no candidate scored, or none the cash or the depots allowed), the days until the player tries
   * again: 1 when left out, each day. A larger one is another player, not only a faster run: it skips the days in between, on
   * which the daily player may draw a line that changes the rest of its game.
   */
  readonly retryDays?: number;
  /** What a point of the card's overall is worth to the player a day: 0 when left out, the next day's net alone; REPORT_GRANT_PER_POINT_PER_DAY_CENTS plays toward the card. */
  readonly cardCentsPerPoint?: number;
  /** Called with each card and each line as the run reaches it, for a long run's progress. */
  readonly onProgress?: (entry: { readonly card: PacingCard } | { readonly line: PacingLine }) => void;
}

export interface Milestone {
  readonly day: number;
  readonly minutes: number;
}

export interface PacingLine {
  readonly name: string;
  readonly day: number;
  readonly minutes: number;
  readonly gainCents: number;
  readonly cardPoints: number;
  readonly depots: number;
  readonly buses: number;
}

export interface PacingCard {
  readonly day: number;
  readonly minutes: number;
  readonly coverage: number;
  readonly reliability: number;
  readonly comfort: number;
  readonly money: number;
  readonly overall: number;
  readonly lowest: string;
  readonly lowestGrade: number;
  readonly trips: number;
  readonly lines: number;
  readonly depots: number;
  readonly buses: number;
  readonly cashCents: number;
}

export interface PacingResult {
  /** The day and real minute each was first reached: profit, secondLine, reportCard, bronze, silver, gold. */
  readonly at: Readonly<Record<string, Milestone>>;
  /** Each line drawn after the first: its next day's gain, the card points it added on its trial, and the depots and buses after it. */
  readonly lines: readonly PacingLine[];
  readonly contracts: readonly { readonly day: number; readonly landmark: string; readonly kind: string; readonly ask: number; readonly rewardCents: number }[];
  /** Each quarter's card: its four grades, its overall and its lowest category (which gold needs at GOLD_GRADE_MIN), and the company at its close. */
  readonly cards: readonly PacingCard[];
  readonly tripsADay: number;
  readonly carried: number;
  readonly cashCents: number;
  /** Day 2's running net, read at its close (bench/pacing.ts's founding-recipe band): the ledger folds a closed day once Finance no longer shows it (economy/ledger.ts DAYS_KEPT). Null if day 2 never closed. */
  readonly secondDayNetCents: number | null;
}

/** A line whose first stop is farther than this from every depot gets a depot of its own, as a player would place one. */
export const DEPOT_REACH_M = 2_000;
/** A part-corridor candidate spans about this much street, as a first line does. */
const SPAN_M = 3_200;

/** A point inside each depot-land parcel (tried along its centre to its first corner), nearest `at` first. */
function depotSites(city: City, at: XY): XY[] {
  const sites: { p: XY; d: number }[] = [];
  for (const ring of city.depotLand) {
    const c: XY = ring.reduce(([x, y], p) => [x + p[0] / ring.length, y + p[1] / ring.length], [0, 0]);
    for (let t = 0; t <= 1; t += 0.05) {
      const p: XY = [c[0] + (ring[0]![0] - c[0]) * t, c[1] + (ring[0]![1] - c[1]) * t];
      if (!pointInRing(ring, p)) continue;
      sites.push({ p, d: distXY(p, at) });
      break;
    }
  }
  return sites.sort((a, b) => a.d - b.d).map((s) => s.p);
}

/** A point inside the depot-land parcel nearest `at`. */
export function depotNear(city: City, at: XY): LngLat {
  return toLngLat(city.frame, depotSites(city, at)[0]!);
}

/** Places a depot on the nearest depot land the depot rule allows, as a player tries the next parcel along; false once the limit or the cash refuses. */
export function placeDepotNear(world: World, at: XY): boolean {
  for (const p of depotSites(world.city, at)) {
    const placed = placeDepot(world, toLngLat(world.city.frame, p));
    if (placed.ok) return true;
    if (placed.reason === 'depot_limit' || placed.reason === 'insufficient_funds') return false;
  }
  return false;
}

/**
 * Lines a player might draw along corridors, laid along the street as the sweep lays them: each from
 * either end over about 3 km with stops about 800 m apart at the founding headways, and whole, with
 * stops about 600 m apart, at the founding headways and at the 12 and 15 minutes the sweep finds best.
 */
export function corridorCandidates(world: World, corridors: readonly (readonly [name: string, from: LngLat, to: LngLat, ...rest: unknown[]])[]): PacingCandidate[] {
  const out: PacingCandidate[] = [];
  for (const [name, from, to] of corridors) {
    for (const [a, b, end] of [[from, to, 'from its first end'], [to, from, 'from its second end']] as const) {
      const along = corridorStops(world, a, b, 800);
      if (!along) continue;
      let kept = 1;
      while (kept < along.length && distM(world.city.frame, along[0]!, along[kept]!) <= SPAN_M) kept++;
      if (kept >= 3) out.push({ name: `${name}, ${end}, ${kept} stops`, stops: along.slice(0, kept), headways: FOUNDING_HEADWAYS });
    }
    const whole = corridorStops(world, from, to, 600);
    if (!whole || whole.length < 2) continue;
    out.push({ name: `${name}, whole, ${whole.length} stops`, stops: whole, headways: FOUNDING_HEADWAYS });
    out.push({ name: `${name}, whole, ${whole.length} stops, every 12/15 min`, stops: whole, headways: { peak: 720, offpeak: 900, overnight: null } });
  }
  return out;
}

/** Operating net of a closed day: income and running costs (sim/rules/money.ts; the checklist's "a day in profit"). */
function operatingNet(world: World, day: number): number {
  return rowsOfDay(world.state.ledger, day)
    .filter((r) => isOperating(r.kind))
    .reduce((s, r) => s + r.amountCents, 0);
}

/** Sets a line's fare to the best its band names, as the line card suggests. */
function bestFare(world: World, lineId: LineId): void {
  const band = fareBand(world, lineId);
  if (band && band.bestCents !== world.state.lines.find((l) => l.id === lineId)!.fareCents) setFare(world, lineId, band.bestCents);
}

/**
 * Draws a candidate at its band's best fare, with a depot near its first stop when none is in reach
 * (when the depot rule refuses one, the line parks at the depots there are), and another depot each
 * time the line rule refuses it for room (rules/line.ts depotRoom, 'depot_full'); the line's id, or
 * null if refused.
 */
export function drawCandidate(world: World, c: PacingCandidate): LineId | null {
  const first = c.stops[0]!;
  const at = toXY(world.city.frame, first);
  const near = world.state.depots.some((d) => distM(world.city.frame, [d.lon, d.lat], first) <= DEPOT_REACH_M);
  if (!near && !placeDepotNear(world, at) && world.state.depots.length === 0) return null;
  let made = createLine(world, c.stops, c.headways);
  while (!made.ok && made.reason === 'depot_full' && placeDepotNear(world, at)) made = createLine(world, c.stops, c.headways);
  if (!made.ok) return null;
  bestFare(world, made.lineId);
  return made.lineId;
}

/** The game as it stands, put back as an undo does. */
function restore(world: World, kept: ReturnType<typeof before>): void {
  world.state = fromSaveData(kept);
  recompute(world);
}

/** The overall a card would give the network as it stands, with `day`'s money for the quarter's (economy/reportCard.ts). */
function overallOf(world: World, day: number): number {
  return (
    REPORT_WEIGHTS.coverage * coverageGrade(world) +
    REPORT_WEIGHTS.reliability * reliabilityGrade(world) +
    REPORT_WEIGHTS.comfort * comfortGrade(world) +
    REPORT_WEIGHTS.money * moneyGrade(world, day, day)
  );
}

type Scored = PacingCandidate & { readonly gainCents: number; readonly cardPoints: number; readonly score: number };

/** The candidate whose next day's net and card points, at `centsPerPoint` a point, score highest above nothing and leave the reserve, or null. */
function bestNextLine(world: World, candidates: readonly PacingCandidate[], built: ReadonlySet<string>, reserveCents: number, centsPerPoint: number): Scored | null {
  const kept = before(world);
  const day = toCalendarTime(world.state.elapsed).day;
  advance(world, SECONDS_PER_DAY);
  const baseline = operatingNet(world, day);
  const baseCard = overallOf(world, day);
  restore(world, kept);
  let best: Scored | null = null;
  for (const c of candidates) {
    if (built.has(c.name)) continue;
    if (drawCandidate(world, c) !== null && world.state.ledger.cashCents >= reserveCents) {
      advance(world, SECONDS_PER_DAY);
      const gainCents = operatingNet(world, day) - baseline;
      const cardPoints = overallOf(world, day) - baseCard;
      const score = gainCents + cardPoints * centsPerPoint;
      if (score > 0 && (!best || score > best.score)) best = { ...c, gainCents, cardPoints, score };
    }
    restore(world, kept);
  }
  return best;
}

/**
 * Plays `world`, a new company at 05:00 on day 1, from its first line until gold, the run's end or
 * `maxDays`. The first line is drawn at founding with a depot near it.
 */
export function playScripted(world: World, first: PacingCandidate, candidates: readonly PacingCandidate[], o: PacingOptions): PacingResult {
  if (drawCandidate(world, first) === null) throw new Error(`pacing: the first line was refused`);
  let minutes = o.player.newGameToPlay;
  const at: Record<string, Milestone> = {};
  const mark = (name: string, day: number) => void (at[name] ??= { day, minutes: Math.round(minutes * 10) / 10 });
  const built = new Set<string>([first.name]);
  const lines: PacingLine[] = [];
  const contracts: { day: number; landmark: string; kind: string; ask: number; rewardCents: number }[] = [];
  const cards: PacingCard[] = [];
  let tripsADay = 0;
  let secondDayNetCents: number | null = null;
  // Nothing is tried until the cash could pay for the cheapest line: four stops and two Sparrows.
  const cheapest = 4 * STOP_COST_CENTS + 2 * SPARROW.priceCents;
  const centsPerPoint = o.cardCentsPerPoint ?? 0;
  const retryDays = Math.max(1, o.retryDays ?? 1);
  let nextTry = 0;
  const buses = () => world.state.lines.reduce((s, l) => s + l.buses, 0);

  for (let day = toCalendarTime(world.state.elapsed).day; day <= o.maxDays && world.state.medals.gold === null; day++) {
    const seconds = SECONDS_PER_DAY - toCalendarTime(world.state.elapsed).secondOfDay;
    const events = advance(world, seconds);
    minutes += seconds / o.rateOn(day) / 60;
    for (const e of events) {
      if (e.kind !== 'day-closed') continue;
      tripsADay = e.trips;
      if (e.day === 2) secondDayNetCents = e.rows.filter((r) => isOperating(r.kind)).reduce((s, r) => s + r.amountCents, 0);
      if (profitableDays(world.state.ledger, e.day + 1) > 0) mark('profit', e.day);
      if (e.card) {
        mark('reportCard', e.day);
        const { coverage, reliability, comfort, money, overall } = e.card;
        const [lowest, lowestGrade] = Object.entries({ coverage, reliability, comfort, money }).reduce((a, b) => (b[1] < a[1] ? b : a));
        const card: PacingCard = {
          day: e.day,
          minutes: Math.round(minutes * 10) / 10,
          coverage,
          reliability,
          comfort,
          money,
          overall,
          lowest,
          lowestGrade,
          trips: e.trips,
          lines: world.state.lines.length,
          depots: world.state.depots.length,
          buses: buses(),
          cashCents: world.state.ledger.cashCents,
        };
        cards.push(card);
        o.onProgress?.({ card });
      }
      for (const m of e.medals) mark(m, e.day);
      for (const c of e.contracts) if (c.outcome === 'paid') contracts.push({ day: e.day, landmark: c.contract.landmark, kind: c.contract.kind, ask: c.contract.ask, rewardCents: c.contract.rewardCents });
    }
    if (world.state.closesBelowFloor >= 5) break;
    for (const c of world.state.contracts) if (c.acceptedDay === null) acceptContract(world, c.id);
    // Draw while the cash allows and the best candidate scores above nothing; after a day that drew none, try again `retryDays` on.
    while (day >= nextTry && world.state.ledger.cashCents >= o.reserveCents + cheapest) {
      const next = bestNextLine(world, candidates, built, o.reserveCents, centsPerPoint);
      if (!next) {
        nextTry = day + retryDays;
        break;
      }
      const depots = world.state.depots.length;
      if (drawCandidate(world, next) === null) break;
      built.add(next.name);
      minutes += o.player.perLine + (world.state.depots.length - depots) * o.player.perDepot;
      const line: PacingLine = { name: next.name, day: day + 1, minutes: Math.round(minutes * 10) / 10, gainCents: next.gainCents, cardPoints: next.cardPoints, depots: world.state.depots.length, buses: buses() };
      lines.push(line);
      o.onProgress?.({ line });
      if (lines.length === 1) mark('secondLine', day + 1);
    }
  }
  return { at, lines, contracts, cards, tripsADay, carried: world.state.tripsCarried, cashCents: world.state.ledger.cashCents, secondDayNetCents };
}
