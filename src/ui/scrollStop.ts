import { useLayoutEffect, useRef, useState } from 'react';

/**
 * A box whose rows scroll and hold nothing focusable, a busy day's card's: while it scrolls it is a Tab stop and a named
 * region, so the keyboard's arrows reach it (axe-core's scrollable-region-focusable; the accessibility pass), and while it
 * does not, it is neither, so a short card adds no stop (the review of the hand-back). Some browsers let the keyboard reach
 * a scrolling box by themselves; this is for those that do not. Gives the box's ref and whether it scrolls.
 *
 * `content` names what the box holds, a day card's day: as it changes, the box starts again at its top and is measured afresh,
 * the box kept, so a focus on it stays. As its rows stop scrolling under the focus, `handOff` gives what takes the focus, as the
 * box stops being a stop: the next day's card had been built anew, and the focus on it fell to the page (the systems audit's
 * fourteenth round).
 */
export function useScrollStop<T extends HTMLElement>(content?: unknown, handOff?: () => HTMLElement | null): [(box: T | null) => void, boolean] {
  const [box, setBox] = useState<T | null>(null);
  const [scrolls, setScrolls] = useState(false);
  const off = useRef(handOff);
  useLayoutEffect(() => {
    off.current = handOff;
  });
  useLayoutEffect(() => {
    if (!box) return;
    box.scrollTo(0, 0);
    const measure = () => {
      const now = box.scrollHeight - box.clientHeight > 1;
      if (!now && document.activeElement === box) off.current?.()?.focus();
      setScrolls(now);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    // The box and its rows, as the window changes size or a row wraps.
    const seen = new ResizeObserver(measure);
    seen.observe(box);
    for (const row of box.children) seen.observe(row);
    return () => seen.disconnect();
  }, [box, content]);
  return [setBox, scrolls];
}
