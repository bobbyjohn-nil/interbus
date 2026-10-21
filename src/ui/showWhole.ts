/**
 * Scrolls `scroller` as little as shows `from` to `to` whole, or `from`'s top when together they are taller than it shows.
 * Its own scrollTop only: scrollIntoView would also scroll the app's ancestors that hide their overflow.
 */
/** Shows `el` whole in the panel body it sits in (`.panel-body`, under the panel's heading and Close), if it is in one. */
export function showInBody(el: Element | null): void {
  const body = el?.closest<HTMLElement>('.panel-body');
  if (el && body) showWhole(body, el);
}

export function showWhole(scroller: HTMLElement, from: Element, to: Element = from): void {
  const view = scroller.getBoundingClientRect();
  const top = from.getBoundingClientRect().top;
  const bottom = to.getBoundingClientRect().bottom;
  if (bottom > view.bottom) scroller.scrollTop += Math.min(bottom - view.bottom, top - view.top);
  else if (top < view.top) scroller.scrollTop -= view.top - top;
}
