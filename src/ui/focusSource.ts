// Whether the keyboard (Tab, an arrow), not the pointer, moved the focus where it is, decided as it
// arrives (the systems audit, D26): a button pressed with the mouse keeps the focus, and :focus-visible
// matches it too once a key is down, so neither says how it came. App gives a focused button Space only
// when the keyboard brought the focus there. The window's pointer and key listeners run in the capture
// phase, so a key a menu keeps to itself still counts; a modifier alone moves no focus (Alt or ⌘ before
// leaving the window); and the focus the browser hands back to the same element when the window or tab
// comes back is no new arrival, so it keeps the source it came by. A pointer press says the pointer acts
// now even where no focus moves: a button Tab once reached and the mouse then pressed keeps the focus
// with no new arrival, and kept Space too, so Space pressed it again.

const MODIFIERS = ['Alt', 'Control', 'Meta', 'Shift'];

export interface FocusSource {
  /** A pointer press or a key, as the window hears it. */
  input(event: { readonly type: string; readonly key?: string }): void;
  /** The window itself lost the focus, `active` holding it. */
  left(active: unknown): void;
  /** The focus arrived on `target`. */
  arrived(target: unknown): void;
  /** Whether the keyboard moved the focus where it is. */
  readonly byKey: boolean;
}

export function focusSource(): FocusSource {
  let pressedByKey = false;
  let returning: unknown = null;
  let byKey = false;
  return {
    input(event) {
      if (event.type === 'pointerdown') pressedByKey = byKey = false;
      else if (!MODIFIERS.includes(event.key ?? '')) pressedByKey = true;
    },
    left(active) {
      returning = active;
    },
    arrived(target) {
      const back = returning !== null && target === returning;
      returning = null;
      if (!back) byKey = pressedByKey;
    },
    get byKey() {
      return byKey;
    },
  };
}
