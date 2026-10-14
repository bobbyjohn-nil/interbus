// The scripted pacing run (the M5 spec, item 1; PLAN §3's pacing targets, GD-10, EC-11): a scripted
// player timed in real minutes on the speed ladder. No earlier version had one; V1 took about 15
// game days to a second bus and nobody had checked (GD-10). bench/pacing.ts plays it on Inner Boston;
// pacing.test.ts plays it on the fixture in the PR checks, with bands.
//
// The player founds, places a depot on the nearest depot land and draws its first line at the
// founding headways and the fare its band calls best. At each close it takes every contract on offer
// (a lapse costs nothing) and, when its cash covers the cheapest line and a reserve, draws the
// candidate that most raises the company's next day, each tried on the game as it stands and taken
// back as an undo would, with a depot of its own when none is within reach of its first stop.
import { acceptContract } from './commands/acceptContract';
import { createLine } from './commands/createLine';
import { placeDepot } from './commands/placeDepot';
import { setFare } from './commands/setFare';
import type { City } from './city/simfile';
import { STOP_COST_CENTS } from './config/economy';
import { SPARROW } from './config/fleet';
import { FOUNDING_HEADWAYS } from './config/lines';
import { SECONDS_PER_DAY } from './config/time';
import { toCalendarTime } from './core/calendar';
import { distM, distXY, pointInRing, toLngLat, toXY, type LngLat, type XY } from './core/geo';
import type { LineId } from './core/ids';
import { fareBand } from './economy/fareBand';
import { profitableDays, rowsOfDay } from './economy/ledger';
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
}

export interface Milestone {
  readonly day: number;
  readonly minutes: number;
}

export interface PacingResult {
  /** The day and real minute each was first reached: profit, secondLine, reportCard, bronze, silver, gold. */
  readonly at: Readonly<Record<string, Milestone>>;
  readonly lines: readonly { readonly name: string; readonly day: number; readonly minutes: number; readonly gainCents: number }[];
  readonly contracts: readonly { readonly day: number; readonly landmark: string; readonly kind: string; readonly ask: number; readonly rewardCents: number }[];
  /** Each quarter's card: its overall grade and its lowest category, which gold needs at 60 or more. */
  readonly cards: readonly { readonly day: number; readonly overall: number; readonly lowest: string; readonly lowestGrade: number; readonly trips: number }[];
  readonly tripsADay: number;
  readonly carried: number;
  readonly cashCents: number;
}

/** A line whose first stop is farther than this from every depot gets a depot of its own, as a player would place one. */
export const DEPOT_REACH_M = 2_000;
/** A part-corridor candidate spans about this much street, as a first line does. */
const SPAN_M = 3_200;

/** A point inside the depot-land parcel nearest `at` (each parcel tried along its centre to its first corner). */
export function depotNear(city: City, at: XY): LngLat {
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

/** Draws a candidate, with a depot near its first stop when none is in reach, at its band's best fare; the line's id, or null if refused. */
function draw(world: World, c: PacingCandidate): LineId | null {
  const first = c.stops[0]!;
  const near = world.state.depots.some((d) => distM(world.city.frame, [d.lon, d.lat], first) <= DEPOT_REACH_M);
  if (!near && !placeDepot(world, depotNear(world.city, toXY(world.city.frame, first))).ok) return null;
  const made = createLine(world, c.stops, c.headways);
  if (!made.ok) return null;
  bestFare(world, made.lineId);
  return made.lineId;
}

/** The game as it stands, put back as an undo does. */
function restore(world: World, kept: ReturnType<typeof before>): void {
  world.state = fromSaveData(kept);
  recompute(world);
}

/** The candidate that most raises the company's next day and leaves the reserve, or null. */
function bestNextLine(world: World, candidates: readonly PacingCandidate[], built: ReadonlySet<string>, reserveCents: number): (PacingCandidate & { gainCents: number }) | null {
  const kept = before(world);
  const day = toCalendarTime(world.state.elapsed).day;
  advance(world, SECONDS_PER_DAY);
  const baseline = operatingNet(world, day);
  restore(world, kept);
  let best: (PacingCandidate & { gainCents: number }) | null = null;
  for (const c of candidates) {
    if (built.has(c.name)) continue;
    if (draw(world, c) !== null && world.state.ledger.cashCents >= reserveCents) {
      advance(world, SECONDS_PER_DAY);
      const gain = operatingNet(world, day) - baseline;
      if (gain > 0 && (!best || gain > best.gainCents)) best = { ...c, gainCents: gain };
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
  if (draw(world, first) === null) throw new Error(`pacing: the first line was refused`);
  let minutes = o.player.newGameToPlay;
  const at: Record<string, Milestone> = {};
  const mark = (name: string, day: number) => void (at[name] ??= { day, minutes: Math.round(minutes * 10) / 10 });
  const built = new Set<string>([first.name]);
  const lines: { name: string; day: number; minutes: number; gainCents: number }[] = [];
  const contracts: { day: number; landmark: string; kind: string; ask: number; rewardCents: number }[] = [];
  const cards: { day: number; overall: number; lowest: string; lowestGrade: number; trips: number }[] = [];
  let tripsADay = 0;
  // Nothing is tried until the cash could pay for the cheapest line: four stops and two Sparrows.
  const cheapest = 4 * STOP_COST_CENTS + 2 * SPARROW.priceCents;

  for (let day = toCalendarTime(world.state.elapsed).day; day <= o.maxDays && world.state.medals.gold === null; day++) {
    const seconds = SECONDS_PER_DAY - toCalendarTime(world.state.elapsed).secondOfDay;
    const events = advance(world, seconds);
    minutes += seconds / o.rateOn(day) / 60;
    for (const e of events) {
      if (e.kind !== 'day-closed') continue;
      tripsADay = e.trips;
      if (profitableDays(world.state.ledger, e.day + 1) > 0) mark('profit', e.day);
      if (e.card) {
        mark('reportCard', e.day);
        const grades = { coverage: e.card.coverage, reliability: e.card.reliability, comfort: e.card.comfort, money: e.card.money };
        const [lowest, lowestGrade] = Object.entries(grades).reduce((a, b) => (b[1] < a[1] ? b : a));
        cards.push({ day: e.day, overall: e.card.overall, lowest, lowestGrade, trips: e.trips });
      }
      for (const m of e.medals) mark(m, e.day);
      for (const c of e.contracts) if (c.outcome === 'paid') contracts.push({ day: e.day, landmark: c.contract.landmark, kind: c.contract.kind, ask: c.contract.ask, rewardCents: c.contract.rewardCents });
    }
    if (world.state.closesBelowFloor >= 5) break;
    for (const c of world.state.contracts) if (c.acceptedDay === null) acceptContract(world, c.id);
    const next = world.state.ledger.cashCents >= o.reserveCents + cheapest ? bestNextLine(world, candidates, built, o.reserveCents) : null;
    if (!next) continue;
    const depots = world.state.depots.length;
    if (draw(world, next) === null) continue;
    built.add(next.name);
    minutes += o.player.perLine + (world.state.depots.length > depots ? o.player.perDepot : 0);
    lines.push({ name: next.name, day: day + 1, minutes: Math.round(minutes * 10) / 10, gainCents: next.gainCents });
    if (lines.length === 1) mark('secondLine', day + 1);
  }
  return { at, lines, contracts, cards, tripsADay, carried: world.state.tripsCarried, cashCents: world.state.ledger.cashCents };
}
