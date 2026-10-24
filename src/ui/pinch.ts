import { onCanvas } from './onePress';

/**
 * A trackpad's pinch zooms the map on the map's canvas, which MapLibre's own handler takes, and nothing anywhere else. Chrome
 * sends a pinch as wheel events with ctrlKey, as it sends Ctrl and a mouse's wheel: uncancelled over a panel or Home's card,
 * they zoomed the whole page, 1.6 times at a pinch, the chips, the dock and the map's credit out of view, and Chrome kept the page
 * zoomed through a reload (the systems audit's seventeenth round). The browser's own zoom stays on Ctrl and plus or minus.
 * Listened to on the way down, and marked not passive: a wheel listener on the window is passive by default, and could not
 * cancel.
 */
export function keepPinchOnMap(win: Window): void {
  win.addEventListener(
    'wheel',
    (event) => {
      if (event.ctrlKey && !onCanvas(event.target)) event.preventDefault();
    },
    { capture: true, passive: false },
  );
}
