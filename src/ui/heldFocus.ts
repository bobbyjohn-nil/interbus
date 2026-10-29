import { useEffect, useRef, type MutableRefObject, type RefObject } from 'react';

/**
 * The control the keyboard has inside `root` (:focus-visible), for a hand-on as it goes from under the keyboard: kept as the
 * focus comes to it, and let go as the focus comes anywhere else, or leaves it for the page while it stays on the page and on,
 * or at a press once the page took it away or turned it off. Off the page, it still holds the attributes that name its place.
 * A control the mouse focused is not kept, nor one a press on text left, which focuses nothing, nor one the mouse pressed once
 * the keyboard had it: handed on after the mouse, the control took Space, which pressed it in place of playing, Lines' tab
 * after the mouse's Close it (the review of #156), a line card's headway after Ctrl+Z (the review of the systems audit's
 * seventeenth round), and Cancel after Save route, reached by Tab and pressed by the mouse, was turned off by a later Ctrl+Z
 * (the review of the nineteenth round), where the page keeps the focus and Space plays. A press elsewhere that leaves the
 * focus where it was keeps it, as a drag of a panel by its heading does: let go at the press, the hand-on gave the page the
 * focus after the drag (the eighteenth round). The focus leaves a control the page takes
 * away while it is still on the page, and one turned off once it is off, so whether it stays is read a moment after the focus
 * left, before anything else runs: read a task after a press, a render in between gave a press on the route editor's words
 * back to its row's button, 1 press in 190 (the round's review). A press once the focus has gone with the control, as the
 * route editor's hand-on waits out a save on its way, is the player going on, as before. A window that loses the focus leaves
 * the page's where it was, and so the hold.
 */
export function useHeldFocus(root: RefObject<Element>): MutableRefObject<Element | null> {
  const held = useRef<Element | null>(null);
  useEffect(() => {
    const moved = (event: FocusEvent) => {
      const at = event.target;
      held.current = at instanceof Element && root.current?.contains(at) && at.matches(':focus-visible') ? at : null;
    };
    const left = (event: FocusEvent) => {
      const at = event.target;
      if (at !== held.current || event.relatedTarget || !(at instanceof Element)) return;
      queueMicrotask(() => {
        if (held.current === at && at.isConnected && !at.matches(':disabled') && document.activeElement !== at) held.current = null;
      });
    };
    const pressed = (event: PointerEvent) => {
      const was = held.current;
      const on = event.target instanceof Node && !!was?.contains(event.target);
      if (was && (on || !was.isConnected || was.matches(':disabled') || !was.contains(document.activeElement))) held.current = null;
    };
    document.addEventListener('focusin', moved, true);
    document.addEventListener('focusout', left, true);
    document.addEventListener('pointerdown', pressed, true);
    return () => {
      document.removeEventListener('focusin', moved, true);
      document.removeEventListener('focusout', left, true);
      document.removeEventListener('pointerdown', pressed, true);
    };
  }, [root]);
  return held;
}
