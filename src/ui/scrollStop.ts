import { useEffect, useState } from 'react';

/**
 * A box whose rows scroll and hold nothing focusable, a busy day's card's: while it scrolls it is a Tab stop and a named
 * region, so the keyboard's arrows reach it (axe-core's scrollable-region-focusable; the accessibility pass), and while it
 * does not, it is neither, so a short card adds no stop (the review of the hand-back). Some browsers let the keyboard reach
 * a scrolling box by themselves; this is for those that do not. Gives the box's ref and whether it scrolls.
 */
export function useScrollStop<T extends HTMLElement>(): [(box: T | null) => void, boolean] {
  const [box, setBox] = useState<T | null>(null);
  const [scrolls, setScrolls] = useState(false);
  useEffect(() => {
    if (!box) return;
    const measure = () => setScrolls(box.scrollHeight - box.clientHeight > 1);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    // The box and its rows, as the window changes size or a row wraps.
    const seen = new ResizeObserver(measure);
    seen.observe(box);
    for (const row of box.children) seen.observe(row);
    return () => seen.disconnect();
  }, [box]);
  return [setBox, scrolls];
}
