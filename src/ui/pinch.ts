import { onCanvas } from './onePress';

/**
 * A trackpad's pinch zooms the map on the map's canvas, which MapLibre's own handler takes, and nothing anywhere else. Chrome
 * sends a pinch as wheel events with ctrlKey, as it sends Ctrl and a mouse's wheel: uncancelled over a panel or Home's card,
 * they zoomed the whole page, 1.6 times at a pinch, the chips, the dock and the map's credit out of view, and Chrome kept the page
 * zoomed through a reload (the systems audit's seventeenth round). The browser's own zoom stays on Ctrl and plus or minus.
 * Listened to on the way down, and marked not passive: a wheel listener on the window is passive by default, and could not
 * cancel. A page zoomed already can be pinched back out, off the map: zoomed by a pinch before this ran, over the splash as the
 * game's code loaded, or on a build before it, the page stayed zoomed, every pinch back cancelled (the eighteenth round).
 */
export function keepPinchOnMap(win: Window): void {
  win.addEventListener(
    'wheel',
    (event) => {
      if (!event.ctrlKey || onCanvas(event.target)) return;
      if (event.deltaY > 0 && (win.visualViewport?.scale ?? 1) > 1) return;
      event.preventDefault();
    },
    { capture: true, passive: false },
  );
}
