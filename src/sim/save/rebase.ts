// A save from another bake of the same city (the M3 spec, item 8; D12, WD-10). Stops are anchored by
// place, so each goes onto the nearest street node of this bake within the stop rule's reach
// (150 m, config/lines.ts); depots keep their place and find their street again on recompute, as on
// every load. A stop that finds no street, or a line whose stops no longer join by street, refuses
// the save in words, and the host sets it aside rather than playing a broken network. An event's
// street is the old bake's edges, so the event is called off (the M4 spec, item 2), and each line
// starts settled on its own day plan, its earlier versions being the old bake's (item 4).
import { STOP_STREET_REACH_M } from '../config/lines';
import { toLngLat, toXY } from '../core/geo';
import { ok, refuse, type Result } from '../core/result';
import type { CityRef } from '../state';
import { recompute, type World } from '../world';

export type RebaseRefusal = 'stop_off_street' | 'line_off_street';

/**
 * The first of a save's stops that finds no street of this bake within the stop rule's reach, or null. The line rule draws every
 * stop on a street, so in a save from this very bake such a stop is damage: one loaded, drawn off the streets, while its line
 * routed to whatever street lay nearest (the systems audit's seventh round).
 */
export function stopOffStreet(world: Pick<World, 'city' | 'nodes'>, stops: readonly { readonly id: number; readonly lon: number; readonly lat: number }[]): number | null {
  for (const stop of stops) if (!world.nodes.nearest(toXY(world.city.frame, [stop.lon, stop.lat]), STOP_STREET_REACH_M)) return stop.id;
  return null;
}

/** Puts the save's stops on this bake's streets and names the bake in the state; `moved` counts the stops that moved. */
export function rebase(world: World, ref: CityRef): Result<{ readonly moved: number }, RebaseRefusal, { stopId?: number; lineId?: number }> {
  const { state, city } = world;
  let moved = 0;
  for (const [k, stop] of state.stops.entries()) {
    const hit = world.nodes.nearest(toXY(city.frame, [stop.lon, stop.lat]), STOP_STREET_REACH_M);
    if (!hit) return refuse('stop_off_street', { stopId: stop.id });
    const [lon, lat] = toLngLat(city.frame, hit.p);
    if (lon !== stop.lon || lat !== stop.lat) moved++;
    state.stops[k] = { ...stop, lon, lat };
  }
  state.city = { ...ref };
  state.event = null;
  for (const line of state.lines) line.earlier = [];
  recompute(world);
  const lost = state.lines.find((l) => !world.services.has(l.id));
  if (lost) return refuse('line_off_street', { lineId: lost.id });
  return ok({ moved });
}
