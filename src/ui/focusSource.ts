// Whether the keyboard (Tab, an arrow), not the pointer, moved the focus where it is, decided as it
// arrives (the systems audit, D26): a button pressed with the mouse keeps the focus, and :focus-visible
// matches it too once a key is down, so neither says how it came. App gives a focused button Space only
// when the keyboard brought the focus there. The window's pointer and key listeners run in the capture
// phase, so a key a menu keeps to itself still counts; a modifier alone moves no focus (Alt or ⌘ before
// leaving the window); and the focus the browser hands back to the same element when the window or tab
// comes back is no new arrival, so it keeps the source it came by. A pointer press says the pointer acts
// now even where no focus moves: a button Tab once reached and the mouse then pressed keeps the focus
// with no new arrival, and kept Space too, so Space pressed it again. Escape moves no focus of the player's
// either (the systems audit's fourth round): the focus a menu hands back to its button as Escape closes it
// comes as the button had it when the menu opened, by the mouse or by the keyboard, whatever keys moved
// through the menu since (its arrows, Home, End). So after a menu the mouse opened, Space plays and pauses,
// where it opened the menu again; one the keyboard opened (Tab to its button, then Space or Enter) still hands
// its button Space, and one the mouse opened on a button Tab had reached hands it back to the mouse. A press
// records the control it lands on as the pointer's, for the browsers that focus no button a press lands on
// (Safari, and Firefox on macOS), where the menu's button had no focus to leave before the menu took it.
import { CONTROLS } from './onePress';

/** Keys that move no focus of the player's: a modifier alone, and Escape. */
const SILENT = ['Alt', 'Control', 'Meta', 'Shift', 'Escape'];

export interface FocusSource {
  /** A pointer press or a key, as the window hears it. */
  input(event: { readonly type: string; readonly key?: string; readonly target?: unknown }): void;
  /** The window itself lost the focus, `active` holding it. */
  left(active: unknown): void;
  /** The focus arrived on `target`. */
  arrived(target: unknown): void;
  /** Whether the keyboard moved the focus where it is. */
  readonly byKey: boolean;
}

export function focusSource(): FocusSource {
  let pressedByKey = false;
  let silent = false;
  let returning: unknown = null;
  let byKey = false;
  // The element the focus is on, and each one's source as the focus last left it, for a silent key that hands
  // the focus back to it (held weakly: an element the page drops goes from here too).
  let at: unknown = null;
  const was = new WeakMap<object, boolean>();
  const element = (target: unknown): target is object => typeof target === 'object' && target !== null;
  return {
    input(event) {
      silent = event.type !== 'pointerdown' && SILENT.includes(event.key ?? '');
      if (event.type === 'pointerdown') {
        pressedByKey = byKey = false;
        const pressed = (event.target as { closest?: (selector: string) => unknown } | null)?.closest?.(CONTROLS);
        if (element(pressed)) was.set(pressed, false);
      } else if (!silent) pressedByKey = true;
    },
    left(active) {
      returning = active;
    },
    arrived(target) {
      const back = returning !== null && target === returning;
      returning = null;
      if (element(at) && at !== target) was.set(at, byKey);
      at = target;
      if (!back) byKey = silent && element(target) && was.has(target) ? was.get(target)! : pressedByKey;
    },
    get byKey() {
      return byKey;
    },
  };
}
