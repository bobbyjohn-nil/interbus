import { useLayoutEffect, type RefObject } from 'react';

/** The gap kept between the card and a panel or the window's edge, in pixels, as between panels (Panels.tsx). */
const GAP = 12;
/** The day card's padding across, which its max-width leaves out (app.css .day-card: 16 px a side). */
const PADDING = 32;
/** The day card at its narrowest, padding in (app.css .day-card: min-width 260 px). */
const NARROWEST = 260 + PADDING;

/** A box's left and right edges across the window. */
interface Span {
  readonly left: number;
  readonly right: number;
}

/**
 * Where a card `w` wide, in the middle of a window `width` wide, goes so as to lie over none of `panels` (the left and right
 * edges of the open panels beside its rows): where it is, if it lies over none of them; else the place nearest the middle in a
 * gap between them and the window's edges, GAP inside the gap, as wide as the gap allows down to `narrowest`. Null where it
 * stays in the middle: nothing is in its way, or no gap holds it.
 */
export function besidePanels(w: number, panels: readonly Span[], width: number, narrowest = NARROWEST): { x: number; w: number } | null {
  const mid = (width - w) / 2;
  if (panels.every((p) => mid + w <= p.left || mid >= p.right)) return null;
  const spans = panels
    .map((p) => ({ left: Math.max(0, p.left), right: Math.min(width, p.right) }))
    .filter((p) => p.right > p.left)
    .sort((a, b) => a.left - b.left);
  const gaps: Span[] = [];
  let x = 0;
  for (const p of spans) {
    if (p.left > x) gaps.push({ left: x, right: p.left });
    x = Math.max(x, p.right);
  }
  if (width > x) gaps.push({ left: x, right: width });
  let best: { x: number; w: number; off: number } | null = null;
  for (const g of gaps) {
    const room = g.right - g.left - 2 * GAP;
    if (room < narrowest) continue;
    const cw = Math.min(w, room);
    const at = Math.min(Math.max((width - cw) / 2, g.left + GAP), g.right - GAP - cw);
    const off = Math.abs(at + cw / 2 - width / 2);
    if (!best || off < best.off) best = { x: Math.round(at), w: cw, off };
  }
  return best && { x: best.x, w: best.w };
}

/**
 * Keeps the day card (`card`, its element) beside the open panels where there is room for it. In the middle at the top it lay
 * over the second panel opened, and while time runs a close's card comes every 16 s at 5,400×: with Lines open, 73.5% of
 * Finance lay under it at 1152×720, its views among it, and a press on Breakdown landed on the card (the systems audit's
 * fifteenth round). Placed again as a panel opens, closes or is dragged, as the window changes size, and with each close's
 * card (`key`); in the middle, as before, where nothing is in its way or no gap holds it.
 */
export function useBesidePanels(card: RefObject<HTMLElement | null>, key: unknown): void {
  useLayoutEffect(() => {
    const el = card.current;
    if (!el) return;
    const place = () => {
      el.style.removeProperty('left');
      el.style.removeProperty('transform');
      el.style.removeProperty('max-width');
      const r = el.getBoundingClientRect();
      const panels = [...document.querySelectorAll('.panel-layer > [data-movable]')]
        .map((p) => p.getBoundingClientRect())
        .filter((p) => p.width > 0 && p.top < r.bottom && p.bottom > r.top);
      const at = besidePanels(r.width, panels, window.innerWidth);
      if (at) Object.assign(el.style, { left: `${at.x}px`, transform: 'none', maxWidth: `${at.w - PADDING}px` });
    };
    place();
    // A panel opened, closed or dragged (Panels sets its box's place in its style), and the window's size.
    const layer = document.querySelector('.panel-layer');
    const moved = new MutationObserver(place);
    if (layer) moved.observe(layer, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
    window.addEventListener('resize', place);
    return () => {
      moved.disconnect();
      window.removeEventListener('resize', place);
    };
  }, [card, key]);
}
