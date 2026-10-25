/**
 * Scrolls `scroller` as little as shows `from` to `to` whole, or `from`'s top when together they are taller than it shows.
 * Its own scrollTop only: scrollIntoView would also scroll the app's ancestors that hide their overflow.
 */
export function showWhole(scroller: HTMLElement, from: Element, to: Element = from): void {
  const view = scroller.getBoundingClientRect();
  const top = from.getBoundingClientRect().top;
  const bottom = to.getBoundingClientRect().bottom;
  if (bottom > view.bottom) scroller.scrollTop += Math.min(bottom - view.bottom, top - view.top);
  else if (top < view.top) scroller.scrollTop -= view.top - top;
}

/** The event showInBody sends from what it shows, for a panel past the window's edge to come in as far as shows it (Panels). */
export const SHOWN = 'interbus:shown';

/**
 * Shows `el` whole in the panel body it sits in (`.panel-body`, under the panel's heading and Close), if it is in one, and
 * asks its panel, past the window's edge with the keyboard in it, to come in as far as shows it whole (SHOWN): Close line's
 * ask opened 67% on the window, and came in only as Tab reached Close it (the systems audit's eighteenth round).
 */
export function showInBody(el: Element | null): void {
  const body = el?.closest<HTMLElement>('.panel-body');
  if (el && body) showWhole(body, el);
  el?.dispatchEvent(new Event(SHOWN, { bubbles: true }));
}
