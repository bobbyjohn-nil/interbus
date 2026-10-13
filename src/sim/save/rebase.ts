// A save from another bake of the same city (the M3 spec, item 8; D12, WD-10). Stops are anchored by
// place, so each goes onto the nearest street node of this bake within the stop rule's reach
// (150 m, config/lines.ts); depots keep their place and find their street again on recompute, as on
// every load. A stop that finds no street, or a line whose stops no longer join by street, refuses
// the save in words, and the host sets it aside rather than playing a broken network.
import { STOP_STREET_REACH_M } from '../config/lines';
import { toLngLat, toXY } from '../core/geo';
import { ok, refuse, type Result } from '../core/result';
import type { CityRef } from '../state';
import { recompute, type World } from '../world';

export type RebaseRefusal = 'stop_off_street' | 'line_off_street';

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
  recompute(world);
  const lost = state.lines.find((l) => !world.services.has(l.id));
  if (lost) return refuse('line_off_street', { lineId: lost.id });
  return ok({ moved });
}
