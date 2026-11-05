/**
 * Scrolls `scroller` as little as shows `from` to `to` whole, or `from`'s top when together they are taller than it shows, clear
 * of its scroll padding, which keeps rows out from under a body's sticky headings: shown within the box alone, a line's name in
 * Finance's Lines stayed under the headings, and a key's press there worked it unseen (the systems audit's twenty-third round).
 * Its own scrollTop only: scrollIntoView would also scroll the app's ancestors that hide their overflow.
 */
export function showWhole(scroller: HTMLElement, from: Element, to: Element = from): void {
  const box = scroller.getBoundingClientRect();
  const style = getComputedStyle(scroller);
  const view = { top: box.top + (parseFloat(style.scrollPaddingTop) || 0), bottom: box.bottom - (parseFloat(style.scrollPaddingBottom) || 0) };
  const top = from.getBoundingClientRect().top;
  const bottom = to.getBoundingClientRect().bottom;
  if (bottom > view.bottom) scroller.scrollTop += Math.min(bottom - view.bottom, top - view.top);
  else if (top < view.top) scroller.scrollTop -= view.top - top;
}

/** The event showInBody sends from what it shows, for a panel past the window's edge to come in as far as shows it (Panels). */
export const SHOWN = 'interbus:shown';

/**
 * Shows `el` whole in the panel body it sits in (`.panel-body`, under the panel's heading and Close), or in its panel's own box
 * where the panel scrolls whole (`.panel`: Saves, Contracts, a stop's card, Lines here, the route editor and the new line's
 * card), and asks its panel, past the window's edge with the keyboard in it, to come in as far as shows it whole (SHOWN): Close
 * line's ask opened 67% on the window, and came in only as Tab reached Close it (the systems audit's eighteenth round). Shown in a
 * `.panel-body` alone, a key's press on Back to Home scrolled out of Saves went Home unseen, and on slot 2's Save here, under the
 * map's credit, it was held for good (the twenty-third round).
 */
export function showInBody(el: Element | null): void {
  const body = el?.closest<HTMLElement>('.panel-body, .panel');
  if (el && body) showWhole(body, el);
  el?.dispatchEvent(new Event(SHOWN, { bubbles: true }));
}
