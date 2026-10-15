// Test helpers on the mini-Boston fixture: the baked city, a new game on it, and a spot on its
// depot land. Imported only by tests.
import { bakeSim } from '../../tools/bake/sim.mjs';
import { loadCity, type City } from './city/simfile';
import { acceptContract } from './commands/acceptContract';
import { createLine } from './commands/createLine';
import { addDebugLine, DEBUG_STOPS } from './commands/debugLine';
import { placeDepot } from './commands/placeDepot';
import { SECONDS_PER_DAY, SECONDS_PER_HOUR } from './config/time';
import { toCalendarTime } from './core/calendar';
import { pointInRing, toLngLat, type LngLat, type XY } from './core/geo';
import { landmarkFigures, rollOffers } from './economy/contracts';
import { foundLedger } from './economy/ledger';
import { contractMet } from './rules/contract';
import { festivalOn } from './rules/event';
import { busesNeeded } from './rules/cycle';
import { newGame } from './state';
import { advance, type SimEvent } from './step';
import { createWorld, recompute, type World } from './world';

let city: City | null = null;

export function fixtureCity(): City {
  if (city) return city;
  const loaded = loadCity(bakeSim('boston', 'mini-boston').text);
  if (!loaded.ok) throw new Error(loaded.problem);
  return (city = loaded.city);
}

export function fixtureGame(seed = 7): World {
  return createWorld(fixtureCity(), newGame({ id: 'boston', revision: 'mini-boston', hash: '-' }, { name: 'Back Bay Transit', colour: '#c0392b' }, seed));
}

/** A point inside the fixture's largest parcel of depot land. */
export function onDepotLand(): LngLat {
  const c = fixtureCity();
  const ring = [...c.depotLand].sort((a, b) => b.length - a.length)[0]!;
  const [cx, cy] = ring.reduce(([x, y], p) => [x + p[0] / ring.length, y + p[1] / ring.length], [0, 0]);
  for (let t = 0; t <= 1; t += 0.05) {
    const p: XY = [cx + (ring[0]![0] - cx) * t, cy + (ring[0]![1] - cy) * t];
    if (pointInRing(ring, p)) return toLngLat(c.frame, p);
  }
  throw new Error('no point inside the parcel');
}

/** The fixture's Copley Square stop on the debug line, and a stop at Kenmore (e2e/transfer.spec.ts). */
export const COPLEY: LngLat = [-71.077, 42.3499];
export const KENMORE: LngLat = [-71.09721, 42.34883];

/** A game with a depot on the fixture's largest parcel. */
export function gameWithDepot(seed = 7): World {
  const world = fixtureGame(seed);
  const placed = placeDepot(world, onDepotLand());
  if (!placed.ok) throw new Error(placed.reason);
  return world;
}

/**
 * I11's company (the M3 spec, item 11; the M4 spec, item 1): the debug line and a line from Copley to
 * Kenmore, both every 10 minutes all day, so it serves every fixture landmark and meets any HEADWAY ask
 * and RIDERSHIP's 150 at Copley and Kenmore, with the buses snow needs, taking every offer it meets at each day's start,
 * but a RIDERSHIP ask never on a festival's riders (they last a day or two). A company
 * that serves only some landmarks earns by where the asks land, not by how they are dealt (GD-04:
 * "comparable play"; DECISIONS, Measured). Its contract income over `days`, in cents: the test holds
 * 10 seeds within 30% of their median; `npm run bench contracts` measures more.
 */
export function contractIncome(seed: number, days: number): number {
  const world = gameWithDepot(seed);
  if (!addDebugLine(world).ok) throw new Error('no debug line');
  if (!createLine(world, [COPLEY, KENMORE]).ok) throw new Error('no Kenmore line');
  rollOffers(world, 1);
  for (const line of world.state.lines) line.headways = { peak: 600, offpeak: 600, overnight: null };
  // Buses for the round trip in snow, so the weather never stretches its headways: a company that
  // plans for it, as one meeting HEADWAY asks must (the M4 spec, item 2; DECISIONS, Measured).
  const today = toCalendarTime(world.state.elapsed).day;
  world.state.event = { kind: 'snow', startDay: today, endDay: today, street: '', edges: [], at: null };
  recompute(world);
  for (const line of world.state.lines) line.buses = busesNeeded(world.services.get(line.id)!.timing.cycles!, line.headways);
  world.state.event = null;
  recompute(world);
  for (let day = 1; day <= days; day++) {
    // Never a RIDERSHIP ask on a festival's riders, who last a day or two: the marker says so.
    const festival = festivalOn(world.state.event, toCalendarTime(world.state.elapsed).day) !== null;
    const figures = landmarkFigures(world);
    for (const c of world.state.contracts) {
      if (c.acceptedDay === null && !(festival && c.kind === 'ridership') && contractMet(c.kind, figures.get(c.landmark)?.[c.kind] ?? null, c.ask)) acceptContract(world, c.id);
    }
    advance(world, SECONDS_PER_DAY);
  }
  return world.state.ledger.rows.filter((r) => r.kind === 'contract').reduce((s, r) => s + r.amountCents, 0);
}

/** A grown company's lines on the fixture: the three the systems audit's third round played, from Copley, Kenmore and Longwood, then four more. */
const GROWN_LINES: readonly (readonly [LngLat, LngLat])[] = [
  [COPLEY, DEBUG_STOPS[3]!.at],
  [COPLEY, KENMORE],
  [KENMORE, DEBUG_STOPS[3]!.at],
  [[-71.0866, 42.3427], [-71.0985, 42.3452]],
  [DEBUG_STOPS[1]!.at, KENMORE],
  [DEBUG_STOPS[2]!.at, COPLEY],
  [[-71.0985, 42.3452], COPLEY],
];

/**
 * A company kept for a long game (save/size.test.ts, `npm run bench savesize`): `lines` of GROWN_LINES
 * (up to seven) at the founding headways, with a depot on the next parcel when one is full. The starting
 * cash buys three; seven want `capitalCents` of about $5 million.
 */
export function grownCompany(lines: number, capitalCents?: number, seed = 7): World {
  const c = fixtureCity();
  const world = createWorld(c, { ...newGame({ id: 'boston', revision: 'mini-boston', hash: '-' }, { name: 'Long Haul', colour: '#1e8449' }, seed), ledger: foundLedger(capitalCents) });
  if (!placeDepot(world, onDepotLand()).ok) throw new Error('no depot');
  const parcels = [...c.depotLand].sort((a, b) => b.length - a.length).slice(1);
  for (const ends of GROWN_LINES.slice(0, lines)) {
    let made = createLine(world, ends);
    while (!made.ok && made.reason === 'depot_full' && parcels.length > 0) {
      const ring = parcels.shift()!;
      const mid = ring.reduce(([x, y], p) => [x + p[0] / ring.length, y + p[1] / ring.length], [0, 0]) as XY;
      if (placeDepot(world, toLngLat(c.frame, mid)).ok) made = createLine(world, ends);
    }
    if (!made.ok) throw new Error(`grown company: line ${world.state.lines.length + 1} refused (${made.reason})`);
  }
  return world;
}

/**
 * The second of the day a save is at its largest. The game autosaves every game hour, and a day's rows
 * merge only at its close (economy/ledger.ts closeDay): at 23:00 the day holds 23 hours' rows unmerged,
 * five a line and the two upkeeps each hour, where at 05:00 it holds five hours' upkeep.
 */
export const LARGEST_SAVE_SECOND = 23 * SECONDS_PER_HOUR;

/**
 * One game day from the day's start at 05:00, as a player keeping the company plays it: every contract
 * it meets taken, then on to the next day's start, with `atLargest` shown the game at 23:00
 * (LARGEST_SAVE_SECOND) on the way.
 */
export function playDay(world: World, atLargest?: (world: World) => void): SimEvent[] {
  const figures = landmarkFigures(world);
  for (const c of world.state.contracts) {
    if (c.acceptedDay === null && contractMet(c.kind, figures.get(c.landmark)?.[c.kind] ?? null, c.ask)) acceptContract(world, c.id);
  }
  const toLargest = LARGEST_SAVE_SECOND - toCalendarTime(world.state.elapsed).secondOfDay;
  if (toLargest <= 0) throw new RangeError('playDay plays from the start of a day, and it is past 23:00');
  const events = advance(world, toLargest);
  atLargest?.(world);
  return [...events, ...advance(world, SECONDS_PER_DAY - toLargest)];
}

/**
 * The most characters a save of grownCompany's seven lines may reach: 90 KB, 26% headroom over the
 * largest `npm run bench savesize` measured in 1,000 days (73,177 at 23:00 on day 522; 41,597 at 05:00).
 * save/size.test.ts holds it for 48 days in the PR checks and the bench for 1,000 nightly, and
 * e2e/storage.spec.ts finds room for five copies in Chromium.
 */
export const GROWN_SAVE_MOST_CHARS = 90 * 1024;
