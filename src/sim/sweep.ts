// I3's full sweep (the M4 spec, item 5; PLAN §10 week 8): one line's day at every headway the line
// card offers and every fare, for each bus model and each tier its stops may take with no other line
// calling (Sign, Shelter, Station), with no event and with roadworks on its own streets. Each slice
// reports its best setting over headways and fares together, the starved line (hourly all day, no
// overnight) at its own best fare, the night-heavy line (hourly all day and night), and the best fare
// on the starter's headways. The verdicts are I3's on a slice whose best earns: an interior optimum,
// a starved line at 60% of the best or less, and the best fare under $5. A slice where nothing earns
// is noted for tuning, not failed: running as little as it may is a losing line's least loss, no
// exploit. Imported only by tests and benches.
import { MODEL_IDS, type BusModelId } from './config/fleet';
import { FOUNDING_HEADWAYS, HEADWAY_MINUTES } from './config/lines';
import type { StopTier } from './config/stops';
import { toCalendarTime } from './core/calendar';
import { distXY, toLngLat, toXY, type LngLat } from './core/geo';
import { createRng } from './core/rng';
import { fareBand } from './economy/fareBand';
import { pickRoadworks } from './events/roll';
import type { LineId } from './core/ids';
import { busesNeeded } from './rules/cycle';
import { FARES_CENTS } from './rules/fare';
import { checkHeadways, type Headways } from './rules/periods';
import { lineServices, nodesBetween, recompute, type World } from './world';

/** A corridor's stop spacing along its street, metres: about a city bus's. */
export const CORRIDOR_SPACING_M = 400;

/**
 * Stops along the streets a bus drives from `from` to `to`, about every `spacingM`, both ends
 * included, each on a street node of the way, so the line drives the corridor as a player lays it.
 * Stops spaced on the straight line between the ends instead snap to whatever street is nearest:
 * bench/inner.ts's Huntington Avenue, so laid, drives a 94-minute round trip over 3.6 km.
 */
export function corridorStops(world: World, from: LngLat, to: LngLat, spacingM = CORRIDOR_SPACING_M): LngLat[] | null {
  const nodes = nodesBetween(world, toXY(world.city.frame, from), toXY(world.city.frame, to));
  if (!nodes || nodes.length < 2) return null;
  const along = [0];
  for (let i = 1; i < nodes.length; i++) along.push(along[i - 1]! + distXY(nodes[i - 1]!, nodes[i]!));
  const total = along[along.length - 1]!;
  const gaps = Math.max(1, Math.round(total / spacingM));
  const picked: number[] = [];
  for (let k = 0; k <= gaps; k++) {
    const target = (k * total) / gaps;
    let best = 0;
    for (let i = 1; i < nodes.length; i++) if (Math.abs(along[i]! - target) < Math.abs(along[best]! - target)) best = i;
    if (picked[picked.length - 1] !== best) picked.push(best);
  }
  return picked.map((i) => toLngLat(world.city.frame, nodes[i]!));
}

/** The tiers a stop may take with one line calling (config/stops.ts minLines). */
export const LONE_TIERS: readonly StopTier[] = [1, 2, 3];

export interface Slice {
  readonly model: BusModelId;
  readonly tier: StopTier;
  readonly works: boolean;
}

export const SLICES: readonly Slice[] = MODEL_IDS.flatMap((model) => LONE_TIERS.flatMap((tier) => [false, true].map((works) => ({ model, tier, works }))));

/** Every headway setting the line card offers that the rules allow: peak, off-peak, and overnight off or no more often than off-peak. */
export const SETTINGS: readonly Headways[] = HEADWAY_MINUTES.flatMap((peak) =>
  HEADWAY_MINUTES.flatMap((offpeak) => [null, ...HEADWAY_MINUTES].map((overnight) => ({ peak: peak * 60, offpeak: offpeak * 60, overnight: overnight === null ? null : overnight * 60 }))),
).filter((h) => checkHeadways(h).ok);

export interface Point {
  readonly headways: Headways;
  readonly buses: number;
  readonly fareCents: number;
  /** The day's net at that fare: whole paid boardings at it and its subsidy, less the day's costs (economy/fareBand.ts). */
  readonly netCents: number;
}

export interface SliceResult {
  readonly slice: Slice;
  /** Roadworks' street, when the slice has them. */
  readonly street: string | null;
  readonly best: Point;
  readonly starved: Point;
  readonly nightHeavy: Point;
  /** The best fare on the founding headways. */
  readonly starterFareCents: number;
}

const same = (a: Headways, b: Headways) => a.peak === b.peak && a.offpeak === b.offpeak && a.overnight === b.overnight;

/** Sweeps `lineId`, the only line in `world`, through one slice. Leaves the line, its stops and the event as they were. */
export function sweepSlice(world: World, lineId: LineId, slice: Slice, settings: readonly Headways[] = SETTINGS): SliceResult {
  const line = world.state.lines.find((l) => l.id === lineId)!;
  const stops = world.state.stops.filter((s) => line.stopIds.includes(s.id));
  const kept = { model: line.model, headways: line.headways, buses: line.buses, fareCents: line.fareCents, tiers: stops.map((s) => s.tier), event: world.state.event };
  line.model = slice.model;
  for (const s of stops) s.tier = slice.tier;
  world.state.event = null;
  recompute(world);
  let street: string | null = null;
  if (slice.works) {
    // Roadworks on the line's own streets, on today: the stretch the roll would pick with this line alone.
    const stretch = pickRoadworks(world, createRng(1));
    if (!stretch) throw new Error('sweep: no street for roadworks');
    const today = toCalendarTime(world.state.elapsed).day;
    world.state.event = { kind: 'roadworks', startDay: today, endDay: today, street: stretch.street, edges: stretch.edges };
    street = stretch.street;
    recompute(world);
  }
  const cycles = world.services.get(lineId)!.timing.cycles!;
  const points = settings.map((headways) => {
    line.headways = headways;
    line.buses = busesNeeded(cycles, headways);
    // The fare band assigns the riders at each fare itself; it needs only the line's plan and costs.
    world.services = lineServices(world);
    const band = fareBand(world, lineId)!;
    const k = band.netCents.indexOf(Math.max(...band.netCents));
    return { point: { headways, buses: line.buses, fareCents: FARES_CENTS[k]!, netCents: band.netCents[k]! }, band };
  });
  const at = (h: Headways) => points.find((p) => same(p.point.headways, h));
  const best = points.reduce((a, b) => (b.point.netCents > a.point.netCents ? b : a)).point;
  const starved = at({ peak: 3_600, offpeak: 3_600, overnight: null })!.point;
  const nightHeavy = at({ peak: 3_600, offpeak: 3_600, overnight: 3_600 })!.point;
  const starter = at(FOUNDING_HEADWAYS)!.band;
  const result = { slice, street, best, starved, nightHeavy, starterFareCents: starter.bestCents };
  Object.assign(line, { model: kept.model, headways: kept.headways, buses: kept.buses, fareCents: kept.fareCents });
  stops.forEach((s, k) => (s.tier = kept.tiers[k]!));
  world.state.event = kept.event;
  recompute(world);
  return result;
}

export interface Verdict {
  /** I3's breaches: a degenerate optimum on a line that earns (EC-03). Any fails the sweep. */
  readonly failures: readonly string[];
  /** A slice where no setting earns, so its least loss (running as little as it may) says nothing of I3: one for tuning (week 9). */
  readonly notes: readonly string[];
}

/** I3's verdicts on a slice: an interior optimum over headways and fares, the best fare under $5 there and on the starter's headways, a starved line at 60% of the best or less, and the night-heavy line below the best. */
export function i3Verdict(r: SliceResult): Verdict {
  const failures: string[] = [];
  const dollars = (c: number) => `$${(c / 100).toFixed(2)}`;
  const min = (s: number | null) => (s === null ? 'off' : `${s / 60}`);
  const where = `${r.slice.model}, tier ${r.slice.tier}${r.slice.works ? `, roadworks on ${r.street}` : ''}`;
  if (r.best.netCents <= 0) return { failures, notes: [`${where}: no setting earns (best ${dollars(r.best.netCents)} a day, every ${min(r.best.headways.peak)}/${min(r.best.headways.offpeak)} min at ${dollars(r.best.fareCents)})`] };
  const lo = HEADWAY_MINUTES[0]! * 60;
  const hi = HEADWAY_MINUTES[HEADWAY_MINUTES.length - 1]! * 60;
  for (const period of ['peak', 'offpeak'] as const) {
    if (r.best.headways[period] <= lo || r.best.headways[period] >= hi) failures.push(`${where}: best ${period} every ${min(r.best.headways[period])} min, at the end of the range`);
  }
  if (r.best.fareCents <= FARES_CENTS[0]! || r.best.fareCents >= FARES_CENTS[FARES_CENTS.length - 1]!) failures.push(`${where}: best fare ${dollars(r.best.fareCents)}, at the end of the range`);
  if (r.starterFareCents >= FARES_CENTS[FARES_CENTS.length - 1]!) failures.push(`${where}: best fare on the starter's headways ${dollars(r.starterFareCents)}`);
  if (r.starved.netCents > 0.6 * r.best.netCents) failures.push(`${where}: a starved line earns ${((100 * r.starved.netCents) / r.best.netCents).toFixed(0)}% of the best`);
  if (r.nightHeavy.netCents >= r.best.netCents) failures.push(`${where}: the night-heavy line earns the most`);
  return { failures, notes: [] };
}
