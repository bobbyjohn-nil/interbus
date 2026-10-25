import { useEffect, useRef, type MutableRefObject, type RefObject } from 'react';

/**
 * The control the keyboard has inside `root` (:focus-visible), for a hand-on as it goes from under the keyboard: kept as the
 * focus comes to it, and let go as the focus comes anywhere else or a press outside it takes the focus from it. Off the page,
 * it still holds the attributes that name its place. A control the mouse focused is not kept, nor one a press on text left,
 * which focuses nothing: handed on after the mouse, the control took Space, which pressed it in place of playing, Lines' tab
 * after the mouse's Close it (the review of #156) and a line card's headway after Ctrl+Z (the review of the systems audit's
 * seventeenth round), where the page keeps the focus and Space plays. A press that leaves the focus where it was keeps it, as a
 * drag of the panel by its heading does: let go at the press, the hand-on gave the page the focus after the drag (the
 * eighteenth round). The press's focus has moved, or not, by the task after it.
 */
export function useHeldFocus(root: RefObject<Element>): MutableRefObject<Element | null> {
  const held = useRef<Element | null>(null);
  useEffect(() => {
    const moved = (event: FocusEvent) => {
      const at = event.target;
      held.current = at instanceof Element && root.current?.contains(at) && at.matches(':focus-visible') ? at : null;
    };
    let wait: ReturnType<typeof setTimeout> | undefined;
    const press = (event: PointerEvent) => {
      const was = held.current;
      if (!was || (event.target instanceof Node && was.contains(event.target))) return;
      clearTimeout(wait);
      wait = setTimeout(() => {
        if (held.current === was && !was.contains(document.activeElement)) held.current = null;
      });
    };
    document.addEventListener('focusin', moved, true);
    document.addEventListener('pointerdown', press, true);
    return () => {
      clearTimeout(wait);
      document.removeEventListener('focusin', moved, true);
      document.removeEventListener('pointerdown', press, true);
    };
  }, [root]);
  return held;
}
