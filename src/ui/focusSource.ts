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
// A silent key (Escape, a modifier alone) counts for the focus that arrives as it is heard, as the menu's hand-back does, and
// no longer: kept until the next key or press, it gave a later arrival, the game's hand-on to Build as Ctrl+Z's answer took
// Lines from under the keyboard, Build's source as the mouse had last left it, so Build showed the ring and Space played, 15
// runs of 15 with a Shift pressed as the answer was on its way (the systems audit's twenty-first round). And only heard where
// the focus is, as a menu's Escape is: an Escape heard on the page, its control gone with Lines, ran the game's hand-on in its
// own dispatch, React putting its waiting effects through before the Escape's own update, and Build got the mouse's source
// again, 3 runs of 3 with a real key (the round's review). A press on the heading of the panel the keyboard is in drags it,
// keeping the focus on its control (Panels), so it keeps the focus's source too: read as the pointer's, Enter on the control
// then opened Lines without the focus, which fell to the page, 30 runs of 30 (the round).
import { CONTROLS } from './onePress';

/**
 * A modifier or a lock alone, which presses nothing and moves no focus: AltGr, Caps Lock, Num Lock, Scroll Lock and Fn as
 * Chrome names them (each heard as a keydown of that name, the twenty-first round), with Alt, Control, ⌘ and Shift.
 */
export const MODIFIERS: readonly string[] = ['Alt', 'AltGraph', 'CapsLock', 'Control', 'Fn', 'Meta', 'NumLock', 'ScrollLock', 'Shift'];
/** Keys that move no focus of the player's: a modifier alone, and Escape. */
const SILENT = [...MODIFIERS, 'Escape'];
/** An event's phase once its dispatch is over (Event.NONE). */
const DISPATCHED = 0;

export interface FocusSource {
  /** A pointer press or a key, as the window hears it, with its phase (`eventPhase`, read again as the focus arrives). */
  input(event: { readonly type: string; readonly key?: string; readonly target?: unknown; readonly eventPhase?: number }): void;
  /** The last pointer press dragged the panel the focus is in by its heading, which leaves the focus where it was and as it came. */
  dragged(): void;
  /** The window itself lost the focus, `active` holding it. */
  left(active: unknown): void;
  /** The focus arrived on `target`. */
  arrived(target: unknown): void;
  /** Whether the keyboard moved the focus where it is. */
  readonly byKey: boolean;
}

export function focusSource(): FocusSource {
  let pressedByKey = false;
  // The last silent key heard where the focus last arrived, while it is the last key or press: silent for an arrival only while
  // the window still dispatches it (one with no phase, as a test's, until the next key or press).
  let silentKey: { readonly eventPhase?: number } | null = null;
  // The sources as they stood before the last pointer press, for a drag that leaves them so.
  let beforePress: { readonly pressedByKey: boolean; readonly byKey: boolean } | null = null;
  let returning: unknown = null;
  let byKey = false;
  // The element the focus is on, and each one's source as the focus last left it, for a silent key that hands
  // the focus back to it (held weakly: an element the page drops goes from here too).
  let at: unknown = null;
  const was = new WeakMap<object, boolean>();
  const element = (target: unknown): target is object => typeof target === 'object' && target !== null;
  return {
    input(event) {
      const silent = event.type !== 'pointerdown' && SILENT.includes(event.key ?? '');
      silentKey = silent && event.target === at ? event : null;
      beforePress = null;
      if (event.type === 'pointerdown') {
        beforePress = { pressedByKey, byKey };
        pressedByKey = byKey = false;
        const pressed = (event.target as { closest?: (selector: string) => unknown } | null)?.closest?.(CONTROLS);
        if (element(pressed)) was.set(pressed, false);
      } else if (!silent) pressedByKey = true;
    },
    dragged() {
      if (beforePress) ({ pressedByKey, byKey } = beforePress);
      beforePress = null;
    },
    left(active) {
      returning = active;
    },
    arrived(target) {
      const back = returning !== null && target === returning;
      returning = null;
      if (element(at) && at !== target) was.set(at, byKey);
      at = target;
      const silent = silentKey !== null && silentKey.eventPhase !== DISPATCHED;
      if (!back) byKey = silent && element(target) && was.has(target) ? was.get(target)! : pressedByKey;
    },
    get byKey() {
      return byKey;
    },
  };
}
