import { onCanvas } from './onePress';

/**
 * A trackpad's pinch zooms the map on the map's canvas, which MapLibre's own handler takes, and nothing anywhere else. Chrome
 * sends a pinch as wheel events with ctrlKey, as it sends Ctrl and a mouse's wheel: uncancelled over a panel or Home's card,
 * they zoomed the whole page, 1.6 times at a pinch, the chips, the dock and the map's credit out of view, and Chrome kept the page
 * zoomed through a reload (the systems audit's seventeenth round). The browser's own zoom stays on Ctrl and plus or minus.
 * Listened to on the way down, and marked not passive: a wheel listener on the window is passive by default, and could not
 * cancel. A page zoomed already can be pinched back out: zoomed by a pinch before this ran, over the splash as the game's code
 * loaded, or on a build before it, the page stayed zoomed, every pinch back cancelled (the eighteenth round). Over the map too,
 * kept from MapLibre's handler, which cancels every wheel it takes: with only the map in view, as founding leaves a page zoomed
 * over the splash, every pinch back zoomed the map, and the page stayed at 1.6, its chips, dock and credit out of view (the
 * nineteenth round). A wheel event cannot tell a pinch from Ctrl and a mouse's wheel, so while the page is zoomed Ctrl and a
 * wheel turned down go through too, and on Windows and Linux Chrome steps its own zoom out for them; and the rest of a pinch
 * whose first event went through come uncancellable, so one that turns back in zooms the page in (the eighteenth round's
 * review; DECISIONS, Measured).
 */
export function keepPinchOnMap(win: Window): void {
  win.addEventListener(
    'wheel',
    (event) => {
      if (!event.ctrlKey) return;
      if (event.deltaY > 0 && (win.visualViewport?.scale ?? 1) > 1) {
        event.stopPropagation();
        return;
      }
      if (!onCanvas(event.target)) event.preventDefault();
    },
    { capture: true, passive: false },
  );
}
