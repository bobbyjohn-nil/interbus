// Refusals in words (the M2 spec, item 3; UX-03): every reason code a rule or command returns, as
// copy of 8 words or fewer, in money where money is short. Never a raw code on screen (V3 showed
// `insufficient_funds`).
import type { RefusalView } from '../sim/types';
import { usd } from './format';

type Copy = (r: RefusalView) => string;

const metres = (m: number | undefined) => (m === undefined ? '' : ` ${Math.round(m).toLocaleString('en-US')} m`);

export const REFUSAL_COPY: Readonly<Record<string, Copy>> = {
  // Depots (sim/rules/depot.ts)
  depot_limit: () => 'Five depots is the most',
  not_depot_land: () => 'Depots stand on industrial land',
  too_far_from_street: (r) => `No street within${metres(r.limitM)}`,
  too_close_to_depot: (r) => `Another depot is${metres(r.nearestM)} away`,
  // Lines (sim/rules/line.ts, sim/rules/stop.ts)
  needs_depot: () => 'Place a depot first',
  no_street_near: (r) => `No street within${metres(r.limitM)}`,
  stop_twice: () => 'A line stops here only once',
  no_route: () => 'No street leads to this stop',
  too_few_stops: () => 'Add a second stop',
  headway_not_whole_seconds: () => 'Headways are whole minutes',
  daytime_headway_too_long: () => 'By day, run at least hourly',
  overnight_more_often_than_offpeak: () => 'Overnight runs no more often than off-peak',
  depot_full: (r) => (r.room ? `Depots have room for ${r.room} more` : 'Your depots are full'),
  insufficient_funds: (r) => `${usd(r.shortCents ?? 0)} short`,
  no_such_line: () => 'That line is gone',
  // The worker
  not_started: () => 'The city is still loading',
  already_running: () => 'The test line is already running',
  off_the_map: () => 'Those stops are off this map',
};

/** A refusal as words; an unknown code still reads as a sentence, never as itself. */
export function refusalText(r: RefusalView): string {
  return (REFUSAL_COPY[r.reason] ?? (() => 'That can’t be done here'))(r);
}
