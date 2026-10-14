import { useLayoutEffect, useRef } from 'react';

/** How far a card sits from the pointer, and the room it leaves at the window's edge, in pixels. */
const [OFFSET, EDGE] = [14, 8];

/**
 * Where a card `w` by `h` goes beside the pointer at `x`, `y` in a window `width` by `height`: below
 * and to the right of the pointer, or on its other side where the window ends, so the whole card
 * shows. A dot's card and the cards of Place a stop and Place a depot share it.
 */
export function besidePointer([x, y]: readonly [number, number], [w, h]: readonly [number, number], [width, height]: readonly [number, number]): { readonly left: number; readonly top: number } {
  return {
    left: x + OFFSET + w <= width - EDGE ? x + OFFSET : Math.max(EDGE, x - OFFSET - w),
    top: y + OFFSET + h <= height - EDGE ? y + OFFSET : Math.max(EDGE, y - OFFSET - h),
  };
}

/**
 * A card's ref, which places the card beside the pointer at `screen` once its size is known, before
 * it is painted. `shows` is what it shows (the sim's answer it reads), or nothing while it is not
 * shown, so a card that opens or says something else is placed again.
 */
export function useBesidePointer(screen: readonly [number, number] | null, shows: unknown) {
  const card = useRef<HTMLDivElement>(null);
  const [x, y] = screen ?? [0, 0];
  useLayoutEffect(() => {
    const el = card.current;
    if (!el) return;
    const { left, top } = besidePointer([x, y], [el.offsetWidth, el.offsetHeight], [window.innerWidth, window.innerHeight]);
    Object.assign(el.style, { left: `${left}px`, top: `${top}px` });
  }, [x, y, shows]);
  return card;
}
