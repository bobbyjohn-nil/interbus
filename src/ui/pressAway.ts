// A press outside an open menu closes it (the systems audit). On the map that is all it does: the
// click the press goes on to make is dropped before the map hears it, so the press that closes the
// Build menu or a dropdown never also places a stop, adds one to a line's draft or buys a depot. A
// press on another control closes the menu and still works that control. The Build menu, the
// dropdowns and the demand menu share it.

/** A window pointerdown listener that closes the menu when a press lands where `inside` says it is not. */
export function closeOnPressAway(inside: (target: Node) => boolean, close: () => void): (event: PointerEvent) => void {
  return (event) => {
    if (inside(event.target as Node)) return;
    close();
    if (!(event.target instanceof Element) || !event.target.closest('.map')) return;
    // The press's click goes nowhere. A press that makes no click (a drag off the page, a right-click)
    // leaves the next press's click alone, and so does a key, whose Enter or Space clicks with no press.
    const drop = (click: MouseEvent) => {
      click.stopPropagation();
      click.preventDefault();
      done();
    };
    const done = () => {
      window.removeEventListener('click', drop, true);
      window.removeEventListener('pointerdown', done, true);
      window.removeEventListener('keydown', done, true);
    };
    window.addEventListener('click', drop, true);
    window.addEventListener('pointerdown', done, true);
    window.addEventListener('keydown', done, true);
  };
}
