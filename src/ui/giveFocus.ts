/**
 * Gives `el` the keyboard's focus, made focusable until the focus leaves it where it no longer takes it. A panel's box holds
 * the focus only so: always focusable, it took the focus from a press on a panel's text, so the keys no longer scrolled the
 * panel (the review of the ninth audit round). So do a contract's row Take it hands the focus to and the row a close puts in
 * a withdrawn offer's place (Contracts.tsx). Handed back to, any of them could no longer take the focus, which fell to the
 * page: Help, opened with ? from Lines' box (the review of round 10) or from the row (round 11), and closed; and the day
 * card's Continue, the focus come to it from the row (the systems audit's fifteenth round).
 */
export function giveFocus(el: HTMLElement): void {
  el.focus();
  if (document.activeElement === el) return;
  el.tabIndex = -1;
  // Only its own: a tabindex the page set since (a scrolling region's) stays.
  const unset = () => void (el.getAttribute('tabindex') === '-1' && el.removeAttribute('tabindex'));
  el.focus();
  if (document.activeElement === el) el.addEventListener('blur', unset, { once: true });
  else unset();
}
