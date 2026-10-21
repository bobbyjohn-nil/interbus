// A busy company for the slow-laptop run (the M5 spec, item 9; PLAN §6's budgets on real laptops):
// 2D must hold 30 frames a second on the slowest machine with 200 buses. No company can own that many
// today: five depots of six buses park 30 (config/depots.ts). So this one steps past that one rule,
// and only that: its lines are drafted by the line rule with room in its depots for every bus, and
// written as Create writes them (commands/createLine.ts), every 5 minutes all day, the line card's
// shortest headway, every third in Metro 40s. They run along the corridors given, whole first, then
// their parts, then whole again the other way, until the buses number at least the ask. Then the game
// plays on to 08:00 on day 1, in the morning peak, so every bus is out. bench/scene.ts writes it as a
// save file to import.
import type { City } from './city/simfile';
import { DEBUG_STOPS } from './commands/debugLine';
import { createLine } from './commands/createLine';
import { placeDepot } from './commands/placeDepot';
import { REFERENCE_FARE_CENTS } from './config/economy';
import { BUS_MODELS, type BusModelId } from './config/fleet';
import { LINE_COLOURS } from './config/lines';
import { toCalendarTime } from './core/calendar';
import { distM, toLngLat, toXY, type LngLat } from './core/geo';
import { mint, type StopId } from './core/ids';
import { foundLedger } from './economy/ledger';
import { corridorCandidates, DEPOT_REACH_M, depotNear } from './pacing';
import { checkLineDraft } from './rules/line';
import { newGame, type CityRef } from './state';
import { advance } from './step';
import { createWorld, lineDraftContext, recompute, type World } from './world';

/** Every 5 minutes all day, the shortest headway the line card offers; overnight off. */
export const SCENE_HEADWAYS = { peak: 300, offpeak: 300, overnight: null } as const;
/** 08:00 on day 1, three hours after founding: the morning peak, every line running. */
export const SCENE_AT = 3 * 3_600;

/** The fixture's streets, for its scene: the debug line end to end, Copley to Kenmore, and two between. */
export const FIXTURE_CORRIDORS: readonly (readonly [name: string, from: LngLat, to: LngLat])[] = [
  ['Copley to Longwood', DEBUG_STOPS[0]!.at, DEBUG_STOPS[3]!.at],
  ['Copley to Kenmore', DEBUG_STOPS[0]!.at, [-71.09721, 42.34883]],
  ['Kenmore to Longwood', [-71.09721, 42.34883], DEBUG_STOPS[3]!.at],
  ['Symphony to Kenmore', DEBUG_STOPS[1]!.at, [-71.09721, 42.34883]],
];

export interface Scene {
  readonly world: World;
  readonly lines: number;
  readonly buses: number;
  readonly depots: number;
}

/** Draws `stops` as Create would, but with room for every bus; false if the line rule refuses it otherwise. */
function drawRoomy(world: World, stops: readonly LngLat[], model: BusModelId): boolean {
  const first = stops[0]!;
  const near = world.state.depots.some((d) => distM(world.city.frame, [d.lon, d.lat], first) <= DEPOT_REACH_M);
  if (!near) placeDepot(world, depotNear(world.city, toXY(world.city.frame, first))); // the nearest depot serves it if refused
  // A thousand times the depots: room for any line, and still none without a depot.
  const context = lineDraftContext(world);
  const verdict = checkLineDraft({ ...context, depots: context.depots * 1_000 }, stops.map((s) => toXY(world.city.frame, s)), SCENE_HEADWAYS, BUS_MODELS[model]);
  if (!verdict.ok) return false;
  const state = world.state;
  const stopIds: StopId[] = verdict.draft.stops.map((pick) => {
    if (pick.kind === 'join') return pick.stopId as StopId;
    const [id, next] = mint(state.nextIds, 'stop');
    state.nextIds = next;
    const [lon, lat] = toLngLat(world.city.frame, pick.at);
    state.stops.push({ id, lon, lat, tier: 1 });
    return id;
  });
  const [lineId, next] = mint(state.nextIds, 'line');
  state.nextIds = next;
  state.lines.push({ id: lineId, name: `Line ${lineId}`, colour: LINE_COLOURS[(lineId - 1) % LINE_COLOURS.length]!, stopIds, fareCents: REFERENCE_FARE_CENTS, headways: { ...SCENE_HEADWAYS }, boardedMilli: 0, model, buses: verdict.draft.buses });
  recompute(world);
  return true;
}

/**
 * A company with at least `buses` buses along `corridors` (each a name and its two ends); fewer if
 * the corridors run out first. It is founded with $50 million, so cash never refuses a line or a
 * depot, and buys only its depots: its lines are written without a purchase.
 */
export function busyScene(city: City, ref: CityRef, corridors: readonly (readonly [name: string, from: LngLat, to: LngLat, ...rest: unknown[]])[], buses: number, seed = 1): Scene {
  const world = createWorld(city, { ...newGame(ref, { name: 'Rush Hour Transit', colour: '#2471a3' }, seed), ledger: foundLedger(5_000_000_000) });
  const seen = new Set<string>();
  const candidates = corridorCandidates(world, corridors)
    .filter((c) => {
      const key = c.stops.map((s) => s.join(',')).join(' ');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => Number(b.name.includes('whole')) - Number(a.name.includes('whole')));
  const lines = [...candidates.map((c) => c.stops), ...candidates.filter((c) => c.name.includes('whole')).map((c) => [...c.stops].reverse())];
  const count = () => world.state.lines.reduce((sum, l) => sum + l.buses, 0);
  for (const stops of lines) {
    if (count() >= buses) break;
    drawRoomy(world, stops, (world.state.lines.length + 1) % 3 === 0 ? 'metro40' : 'sparrow');
  }
  advance(world, SCENE_AT - world.state.elapsed);
  if (toCalendarTime(world.state.elapsed).day !== 1) throw new Error('scene: past day 1');
  return { world, lines: world.state.lines.length, buses: count(), depots: world.state.depots.length };
}

/**
 * A late game within the rules (the systems audit's seventh round, the screens with many lines): five depots by the corridors'
 * first ends, then line after line along `corridors` both ways, drawn by Create's own rule (commands/createLine.ts), one
 * Sparrow every `headway` seconds all day, until `maxLines` or the corridors run out. Founded with $50 million, as busyScene
 * is, so cash never refuses a line. Paused at founding; on Inner Boston its 30 lines are the most a company can run (five
 * depots of six buses). Read by the fares and recompute benches and the many-lines e2e tests.
 */
export function lateScene(city: City, ref: CityRef, corridors: readonly (readonly [name: string, from: LngLat, to: LngLat, ...rest: unknown[]])[], maxLines: number, headway = 3_600): World {
  const world = createWorld(city, { ...newGame(ref, { name: 'Late Game Transit', colour: '#2471a3' }, 1), ledger: foundLedger(5_000_000_000) });
  const seen = new Set<string>();
  const candidates = corridorCandidates(world, corridors).filter((c) => {
    const key = c.stops.map((s) => s.join(',')).join(' ');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  for (const c of candidates) {
    if (world.state.depots.length >= 5) break;
    placeDepot(world, depotNear(world.city, toXY(world.city.frame, c.stops[0]!)));
  }
  for (const stops of [...candidates.map((c) => c.stops), ...candidates.map((c) => [...c.stops].reverse())]) {
    if (world.state.lines.length >= maxLines) break;
    createLine(world, stops, { peak: headway, offpeak: headway, overnight: null }, 'sparrow');
  }
  return world;
}
