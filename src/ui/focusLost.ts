/**
 * Whether the keyboard's focus is nowhere the player put it: on the page itself, or on a control taken away or turned off
 * under it, before the browser hands it to the page. The end of a run turns off the control the keyboard was on (runOver),
 * and the focus fell to the page, so a keyboard player started again from its top to reach the card the end brings (the
 * review of #142); that card takes it instead, and it takes nothing from a control still on.
 */
export function focusLost(at: Element | null = document.activeElement): boolean {
  return !at || at === document.body || !at.isConnected || ((at instanceof HTMLButtonElement || at instanceof HTMLInputElement) && at.disabled);
}
