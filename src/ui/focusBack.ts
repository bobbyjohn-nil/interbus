import { useLayoutEffect, useRef } from 'react';
import { focusLost } from './focusLost';

type Target = () => HTMLElement | null | undefined;
/** `handBack(from, to)`: see useFocusBack. */
export type HandBack = (from: HTMLElement, to: Target) => void;

/**
 * Hands the focus on as the button pressed goes with its card (the accessibility pass, PLAN §8). A change card's Keep as is,
 * Sell them or Close line's Keep it took the focus with it, and the focus fell to the page, so a keyboard player started again
 * from its top. `handBack(from, to)`, called as `from` is pressed, waits for it to go while it still holds the focus, a render
 * later or a snapshot later, then focuses what `to` gives. If the focus moved anywhere else first, it is left where the player
 * put it, and a press that left the focus elsewhere, as a mouse's can, hands nothing on.
 */
export function useFocusBack(): HandBack {
  const pending = useRef<{ from: HTMLElement; to: Target } | null>(null);
  useLayoutEffect(() => {
    const held = pending.current;
    if (!held || (held.from.isConnected && document.activeElement === held.from)) return;
    pending.current = null;
    if (!held.from.isConnected && focusLost()) held.to()?.focus();
  });
  return (from, to) => {
    pending.current = document.activeElement === from ? { from, to } : null;
  };
}
