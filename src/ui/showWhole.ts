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
