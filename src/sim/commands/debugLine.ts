// M1's debug line (docs/specs/m1-first-dollar.md): four stops from Back Bay to Longwood, every 20 minutes by
// day, overnight off, $2.25. The seed of M2's line tool, cut when the tool lands. In M1 it runs its
// timetable with no bus and no cost; week 4 gives every line buses and their costs (K42).
import { toXY, type LngLat } from '../core/geo';
import { mint, type LineId } from '../core/ids';
import { ok, refuse, type Result } from '../core/result';
import { REFERENCE_FARE_CENTS } from '../config/economy';
import { nearestNode, recompute, type World } from '../world';

export const DEBUG_STOPS: readonly { readonly name: string; readonly at: LngLat }[] = [
  { name: 'Copley', at: [-71.077, 42.3499] },
  { name: 'Symphony', at: [-71.0857, 42.3424] },
  { name: 'Museum of Fine Arts', at: [-71.095, 42.3375] },
  { name: 'Longwood', at: [-71.1035, 42.336] },
];
export const DEBUG_HEADWAY_SECONDS = 20 * 60;

export type DebugLineRefusal = 'already_running' | 'off_the_map';

export function addDebugLine(world: World): Result<{ lineId: LineId }, DebugLineRefusal> {
  const state = world.state;
  if (state.lines.some((l) => l.name === 'Debug line')) return refuse('already_running');
  const nodes = DEBUG_STOPS.map((s) => nearestNode(world, toXY(world.city.frame, s.at)));
  if (nodes.some((n) => n === null)) return refuse('off_the_map');
  const stopIds = DEBUG_STOPS.map((s) => {
    const [id, next] = mint(state.nextIds, 'stop');
    state.nextIds = next;
    state.stops.push({ id, lon: s.at[0], lat: s.at[1] });
    return id;
  });
  const [lineId, next] = mint(state.nextIds, 'line');
  state.nextIds = next;
  state.lines.push({
    id: lineId,
    name: 'Debug line',
    colour: '#c0392b',
    stopIds,
    fareCents: REFERENCE_FARE_CENTS,
    headways: { peak: DEBUG_HEADWAY_SECONDS, offpeak: DEBUG_HEADWAY_SECONDS, overnight: null },
    boardedMilli: 0,
  });
  recompute(world);
  return ok({ lineId });
}
