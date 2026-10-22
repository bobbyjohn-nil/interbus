// Undo while paused (the M3 spec, item 7; I9; UX-09, X-11). Every command taken while paused keeps
// the game as it stood just before it, and Undo puts the newest back: state and cash to the cent,
// with no Refund row, since no time has run in between. Unpausing lets them go, so an undo after
// time has run is refused in words: V2's undo restored a snapshot from days before and rewound the
// income earned since (`Intralines_City_dep@archive/intralines-city-v1:Gaming/src/60-main.js:602-695`).
// Undo lives in the worker, not the save: a reload starts with nothing to undo.
import { ok, refuse, type Result } from './core/result';
import { fromSaveData, toSaveData } from './save/save';
import type { SaveData } from './save/schema';
import { recompute, type World } from './world';

export type UndoCommand =
  | 'place-depot'
  | 'place-stop'
  | 'take-down-stop'
  | 'create-line'
  | 'extend-line'
  | 'insert-stop'
  | 'set-route'
  | 'set-headways'
  | 'set-model'
  | 'sell-spares'
  | 'close-line'
  | 'set-fare'
  | 'set-stop-tier'
  | 'remove-stop'
  | 'accept-contract';

/** What an undo would take back: the command and what it acted on, such as "Line 2" or "Stop 3". */
export interface UndoLabel {
  readonly command: UndoCommand;
  readonly subject: string;
}

export interface UndoStack {
  readonly entries: (UndoLabel & { readonly before: SaveData })[];
  /** Set when time ran with commands still on the stack, so an undo then says why it cannot. */
  timeRan: boolean;
}

export function newUndo(): UndoStack {
  return { entries: [], timeRan: false };
}

/** The game as it stands, to keep before a command that may be undone. */
export function before(world: World): SaveData {
  return toSaveData(world.state);
}

/** Keeps a command that went through while paused. */
export function remember(stack: UndoStack, label: UndoLabel, state: SaveData): void {
  stack.entries.push({ ...label, before: state });
  stack.timeRan = false;
}

/** Time starts to run: nothing taken before it can be undone. */
export function timeRuns(stack: UndoStack): void {
  if (stack.entries.length > 0) stack.timeRan = true;
  stack.entries.length = 0;
}

/** The command an undo would take back, or null. */
export function nextUndo(stack: UndoStack): UndoLabel | null {
  const top = stack.entries.at(-1);
  return top ? { command: top.command, subject: top.subject } : null;
}

/** Puts the newest command back: the world's state is the one kept before it, recomputed. */
export function undo(world: World, stack: UndoStack): Result<{ readonly undone: UndoLabel }, 'time_has_run' | 'nothing_to_undo'> {
  const top = stack.entries.pop();
  if (!top) return refuse(stack.timeRan ? 'time_has_run' : 'nothing_to_undo');
  world.state = fromSaveData(top.before);
  recompute(world);
  return ok({ undone: { command: top.command, subject: top.subject } });
}
