// The fare band the line card prints (the M3 spec, item 4; EC-09): the day's net at every fare a line
// may charge, with the rest of the network as it stands, and the fares within 5% of the best, so the
// card names a band rather than one argmax. Asked for when a line's card is open, never on the
// recompute path: it is one assignment per fare, each visiting only the cell pairs the line serves,
// on catchments worked out once. The worker works it out a step at a time (fareBandSteps).
import { assign, catchments } from '../demand/assign';
import { FARE_BAND_SHARE } from '../config/economy';
import type { LineId } from '../core/ids';
import { FARES_CENTS, subsidyCents } from '../rules/fare';
import { commutersToday, runningPlans, type World } from '../world';
import { forecastDay } from './costs';

export interface FareBand {
  /** The day's net at each fare in FARES_CENTS, in cents: whole paid boardings at that fare and its subsidy, less the day's costs. */
  readonly netCents: readonly number[];
  readonly bestCents: number;
  /** The cheapest and dearest fares within the band. */
  readonly fromCents: number;
  readonly toCents: number;
}

/**
 * The band a step at a time: the first step works out who can walk to which stop, and each after it one fare's assignment, on
 * the network and the day's riders as they stood at the first; the last returns the band. On a late game's network the
 * seventeen assignments took up to 1.1 s together, and the worker's clock and every command waited for them (the systems
 * audit's seventh round, `npm run bench fares`), so the worker takes a few steps between its ticks.
 */
export function* fareBandSteps(world: World, lineId: LineId): Generator<void, FareBand | null, void> {
  const service = world.services.get(lineId);
  if (!service || service.timing.buses === 0) return null;
  const plans = runningPlans(world);
  const commuters = commutersToday(world);
  const costs = forecastDay(service.costs);
  const dayCost = costs.running + costs.wages + costs.deadhead;
  // Only the fare changes from try to try, so who can walk to which stop is worked out once.
  const reach = catchments(world.city, plans);
  const netCents: number[] = [];
  for (const fare of FARES_CENTS) {
    yield;
    const tried = plans.map((p) => (p.id === lineId ? { ...p, fareCents: fare } : p));
    const riders = assign(world.city, commuters, tried, { only: lineId, reach }).lines.get(lineId)?.paidPerDay ?? 0;
    netCents.push(Math.floor(riders) * (fare + subsidyCents(fare)) - dayCost);
  }
  const top = Math.max(...netCents);
  const within = FARES_CENTS.filter((_, k) => netCents[k]! >= top - FARE_BAND_SHARE * Math.abs(top));
  return { netCents, bestCents: FARES_CENTS[netCents.indexOf(top)]!, fromCents: within[0]!, toCents: within[within.length - 1]! };
}

/** The band for one line, all at once, or null for a line that does not run. */
export function fareBand(world: World, lineId: LineId): FareBand | null {
  const steps = fareBandSteps(world, lineId);
  let step = steps.next();
  while (!step.done) step = steps.next();
  return step.value;
}
