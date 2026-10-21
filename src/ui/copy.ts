// Refusals in words (the M2 spec, item 3; UX-03): every reason code a rule or command returns, as
// copy of 8 words or fewer, in money where money is short. Never a raw code on screen (V3 showed
// `insufficient_funds`).
import type { StoreRefusal } from '../platform';
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
  headway_too_short: () => 'Run at most once a minute',
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
  // "Take Stop 2 off Line 1" (host.ts names the stop and the line): "Remove Stop 2 from Line 1", about 30 px wider, took the
  // shell at rest past 6% at 1152×720 beside the held save's notice (the systems audit's third round).
  'remove-stop': (s) => `Take ${s}`,
  'accept-contract': (s) => `Take the ${s} contract`,
};

export function undoText(u: { readonly command: string; readonly subject: string }): string {
  return `Undo: ${(UNDO_COPY[u.command] ?? ((s: string) => s))(u.subject)}`;
}

/** Said once when the browser refuses to read or keep a save (blocked site data). */
export const STORE_REFUSED_COPY = 'This browser isn’t keeping saves';

/**
 * Said once when the browser has no room left for a save (src/platform's `full`), with the way out. It names no control: the
 * Saves chip may read "Autosave off" by then (App), and Saves' line names Export too.
 */
export const STORE_FULL_COPY = 'No room for saves: delete a save';

/** Saves' line while a save of the game's own is not kept, by why: what it means, and the way out. */
export const STORE_LINE_COPY: Readonly<Record<StoreRefusal, string>> = {
  blocked: `${STORE_REFUSED_COPY}. Export this game to keep it.`,
  // Export too: the room may be taken by other data of the same origin, with nothing in Saves to delete.
  full: 'No room for saves. Delete a save, or export this game to keep it.',
};

/**
 * A slot's row after the browser refused its Save here, below its line, until the slot is saved, any delete in Saves is kept
 * (it made room, so the advice is followed) or another game loads: why, and the way out, in 8 words at most beside its buttons.
 */
export const SLOT_REFUSED_COPY: Readonly<Record<StoreRefusal, string>> = {
  blocked: 'Not kept: this browser isn’t keeping saves',
  full: 'Didn’t fit: delete a save to make room',
};

/** Why the game could not go on, other than a replaced build: it never started (its city's sim file or its worker unread), or its worker stopped mid-game. */
export type GameFailure = 'start' | 'stopped';

/** The failure card's words (ReplacedCard), with the city's own name. */
export function failedText(failed: GameFailure, city: string): string {
  return failed === 'start' ? `${city} couldn’t be loaded` : 'The game stopped working';
}

/**
 * Said for a few seconds in the game when another tab has changed this city's autosave (saved its game there, or removed it)
 * since this one last read or wrote it: this tab then writes none of its own saves over it (useSim), the Saves chip reads
 * "Autosave off", and Home carries on with the other tab's game when this build can play it. "Changed", not "saved a newer
 * game": a removal saves nothing, and a Load or a New game there is no further on (the review of the fifth round).
 */
export const NEWER_COPY = 'Another tab changed the autosave';

/** Saves' line meanwhile, in place of a full or blocked store's: why the game isn't saving itself (the Saves chip's tooltip sends the player here), and the way out, in a blocked store's two rows. */
export const NEWER_LINE_COPY = `${NEWER_COPY}. Export this game to keep it.`;

/**
 * Back to Home's question in Saves while another tab's change to the autosave lasts, this build can play that autosave, and this
 * game has moved on since (useSim's `movedOn`), above "Replace this game / Keep playing" as Load's and Import's: Home takes up the
 * autosave, which its row in Saves names, so this game's play since would be lost; Saves' line above says another tab changed it
 * and that Export this game, on the row above, keeps this one (the systems audit's sixth round).
 */
export const BACK_HOME_ASK_COPY = 'Go to Home? It takes up the autosave, and your play here since it changed will be lost.';

/** Said on Home, until the player opens Saves, when a save could not be set aside (a full disk), so the game keeps it where it is and saves nothing over it: what that means for the player, and where to look. */
export const UNBACKED_COPY = 'Not autosaving: see Saves';

/**
 * In the game, the Saves chip says the game isn't autosaving, in place of "Saves", for as long as that lasts: while that save is
 * held, or while the browser has refused the autosave and not kept one since. 33 px wider, which the chip row gives up, so the
 * shell at rest stays within I13 with the row full (a notice of its own took 0.63% more, past 6% beside a full row at
 * 1152×720). Its name keeps "Saves", and its tooltip says where to see why.
 */
export const AUTOSAVE_OFF_CHIP = 'Autosave off';
export const AUTOSAVE_OFF_NAME = `Saves: ${AUTOSAVE_OFF_CHIP.toLowerCase()}`;
export const AUTOSAVE_OFF_TITLE = 'This game isn’t saving itself: open Saves to see why';

/**
 * The GPU ladder's cards (the no-GPU card, the lost-graphics card; MapView) while the game isn't saving itself ("Autosave off"),
 * or the browser keeps nothing at all: said where they say "your game is saved" otherwise, with `keep`'s button alone on the
 * no-GPU card and before the lost card's Reload. True alike of blocked site data, which keeps nothing, a full store, whose
 * autosave is older than the game, and another tab's change to the autosave.
 */
export const MAP_UNSAVED_COPY = { words: 'This game isn’t saving itself: export it before you reload.', keep: 'Export this game' } as const;

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
