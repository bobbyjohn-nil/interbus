// Refusals in words (the M2 spec, item 3; UX-03): every reason code a rule or command returns, as
// copy of 8 words or fewer, in money where money is short. Never a raw code on screen (V3 showed
// `insufficient_funds`).
import type { LoadView, RefusalView } from '../sim/types';
import { usd } from './format';

type Copy = (r: RefusalView) => string;

const metres = (m: number | undefined) => (m === undefined ? '' : ` ${Math.round(m).toLocaleString('en-US')} m`);

export const REFUSAL_COPY: Readonly<Record<string, Copy>> = {
  // Depots (sim/rules/depot.ts)
  depot_limit: () => 'You can have at most five depots',
  not_depot_land: () => 'Depots stand on industrial land',
  too_far_from_street: (r) => `No street within${metres(r.limitM)}`,
  too_close_to_depot: (r) => `Another depot is${metres(r.nearestM)} away`,
  // Lines (sim/rules/line.ts, sim/rules/stop.ts)
  needs_depot: () => 'Place a depot first',
  model_locked: () => 'A silver medal unlocks this bus',
  same_model: () => 'The line already runs these',
  no_street_near: (r) => `No street within${metres(r.limitM)}`,
  stop_twice: () => 'A line stops here only once',
  no_route: () => 'No street leads to this stop',
  too_few_stops: () => 'Add a second stop',
  headway_not_whole_seconds: () => 'Headways are whole minutes',
  daytime_headway_too_long: () => 'By day, run at least hourly',
  overnight_more_often_than_offpeak: () => 'Overnight can’t run more often than off-peak',
  same_headways: () => 'The line already runs this often',
  depot_full: (r) => (r.room ? `Depots have room for ${r.room} more` : 'Your depots are full'),
  insufficient_funds: (r) => `${usd(r.shortCents ?? 0)} short`,
  no_such_line: () => 'That line is gone',
  // Fares (sim/rules/fare.ts)
  fare_out_of_range: () => 'Fares run from $1.00 to $5.00',
  fare_not_a_step: () => 'Fares go up in 25¢ steps',
  same_fare: () => 'The line already charges that',
  // Stop tiers (sim/rules/stopTier.ts)
  same_tier: () => 'The stop is already this kind',
  no_such_tier: () => 'No such kind of stop',
  needs_lines: (r) => `Needs ${r.limit ?? 3} lines stopping here`,
  no_such_stop: () => 'That stop is gone',
  // Route edits (sim/rules/route.ts)
  not_on_line: () => 'The line doesn’t stop here',
  line_keeps_two: (r) => `A line keeps at least ${r.limit ?? 2} stops`,
  no_new_stops: () => 'Click the map beyond the line',
  no_leg_near: (r) => `Click within ${r.limitM ?? 300} m of the line`,
  no_change: () => 'The route is as it was',
  // Stops placed alone (sim/rules/stop.ts, sim/rules/route.ts; D25)
  stop_near: (r) => `A stop stands within${metres(r.limitM)}`,
  stop_in_use: (r) => (r.limit === 1 ? 'A line still stops here' : `${r.limit ?? 2} lines still stop here`),
  // Undo (sim/undo.ts)
  time_has_run: () => 'Time has passed since then',
  nothing_to_undo: () => 'Nothing to undo',
  // Saves: slots and files (the M3 spec, item 8)
  empty_slot: () => 'That slot is empty',
  no_such_slot: () => 'No such slot',
  save_unreadable: () => 'A save this game can’t read',
  save_newer: () => 'Saved by a newer build',
  save_older: () => 'Saved by an older build',
  save_other_city: () => 'A save from another city',
  save_off_street: () => 'Its stops aren’t on this map',
  save_none: () => 'A save this game can’t read',
  // Contracts (sim/rules/contract.ts)
  no_such_contract: () => 'That contract is gone',
  already_held: () => 'You hold this contract already',
  // The failure floor (sim/rules/credit.ts)
  run_ended: () => 'The lender has called in the loan',
  no_quarter_save: () => 'No save from this quarter’s start',
  no_session: () => 'Name your company first',
  // Founding (sim/rules/company.ts)
  already_founded: () => 'The company is already founded',
  name_empty: () => 'Give the company a name',
  name_too_long: (r) => `At most ${r.limit ?? 32} characters`,
  colour_not_offered: () => 'Pick one of these colors',
  // The worker
  not_started: () => 'The city is still loading',
};

/** A refusal as words; an unknown code still reads as a sentence, never as itself. */
export function refusalText(r: RefusalView): string {
  return (REFUSAL_COPY[r.reason] ?? (() => 'That can’t be done here'))(r);
}

/** A slot or a file that became the game, in one line. */
export function loadedText(loaded: { readonly from: 'slot' | 'file' | 'quarter'; readonly load: LoadView }): string {
  if (loaded.load === 'rebaked') return 'Save carried onto the new map';
  return loaded.from === 'slot' ? 'Slot loaded' : loaded.from === 'file' ? 'Save file loaded' : 'Back to the start of the quarter';
}

/** What Undo would take back, named (the M3 spec, item 7): "Create Line 2", "Line 2’s fare". A change is named by what it changed, without "Change", which would widen the chip past I13 (D25's copy pass). */
const UNDO_COPY: Readonly<Record<string, (subject: string) => string>> = {
  'place-depot': (s) => `Place ${s}`,
  'place-stop': (s) => `Place ${s}`,
  'take-down-stop': (s) => `Take down ${s}`,
  'set-route': (s) => `${s}’s route`,
  'create-line': (s) => `Create ${s}`,
  'extend-line': (s) => `Extend ${s}`,
  'insert-stop': (s) => `Insert a stop on ${s}`,
  'set-headways': (s) => `${s}’s headways`,
  'set-model': (s) => `${s}’s buses`,
  'set-fare': (s) => `${s}’s fare`,
  'set-stop-tier': (s) => `${s}’s kind`,
  'remove-stop': (s) => `Remove ${s}`,
  'accept-contract': (s) => `Take the ${s} contract`,
};

export function undoText(u: { readonly command: string; readonly subject: string }): string {
  return `Undo: ${(UNDO_COPY[u.command] ?? ((s: string) => s))(u.subject)}`;
}

/** Said once when the browser refuses to read or keep a save (blocked site data, a full disk). */
export const STORE_REFUSED_COPY = 'This browser isn’t keeping saves';

/** Why the game could not go on, other than a replaced build: it never started (its city's sim file or its worker unread), or its worker stopped mid-game. */
export type GameFailure = 'start' | 'stopped';

/** The failure card's words (ReplacedCard), with the city's own name. */
export function failedText(failed: GameFailure, city: string): string {
  return failed === 'start' ? `${city} couldn’t be loaded` : 'The game stopped working';
}

/** Said, until the player opens Saves, when a save could not be set aside (a full disk), so the game keeps it where it is and saves nothing over it: what that means for the player, and where to look. Untimed chrome at rest, so short: I13. */
export const UNBACKED_COPY = 'Not autosaving: see Saves';

/** That save's row in Saves, after its name there ("A save from an older build (format 15)"), beside Export and Delete. */
export const unbackedRowText = (name: string): string => `${name}, not set aside · this game isn’t saving itself`;

/** That row's tooltip: the way out. */
export const UNBACKED_ROW_TITLE = 'Export the old save to keep it, and Save here to keep this game meanwhile. Once the old save is deleted here, this game saves itself again.';

/** A save the game could not start from, in one line (D12): kept under a backup key, never overwritten. */
export const LOAD_COPY: Readonly<Record<LoadView, string | null>> = {
  none: null,
  ok: null,
  rebaked: 'Save carried onto the new map',
  older: 'Save from an older build set aside',
  newer: 'Save from a newer build set aside',
  unreadable: 'Unreadable save set aside',
  'other-city': 'Save from another city set aside',
  'off-street': 'Save set aside: stops off the new map',
};
