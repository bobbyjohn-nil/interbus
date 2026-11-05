/**
 * What lies over the middle of `target`, a control in `box`, where a key pressed what no one could see; null where the control
 * shows there itself. Tabbed to a change's Buy and run, then Finance dragged over it, or raised over it by a press on its heading,
 * Enter bought the change for $190,000 unseen, 30 runs of 30, and so did Space after a Tab away and back (the systems audit's
 * twenty-second round; #199's review held only Space straight after the press); and under the day's card, which stood over three
 * panels at 1152×720, Enter bought it for $380,000 (the fix's review). A panel's box (Panels) and the chips (TopBar) hold a key's
 * press on a control so covered.
 */
export function coverOf(box: Element, target: EventTarget | null): Element | null {
  if (!(target instanceof Element) || !box.contains(target)) return null;
  const r = target.getBoundingClientRect();
  const at = document.elementFromPoint?.(r.left + r.width / 2, r.top + r.height / 2);
  return at && !box.contains(at) ? at : null;
}

