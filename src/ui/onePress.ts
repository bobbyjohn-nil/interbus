// One press, one command (D26, the systems audit's second round). A double-click on a button is one
// press: its second click, and the dblclick after it, go nowhere, wherever they land. By the time the
// second click comes, the first has often changed what is under the pointer: the next row of a stop's
// card (Remove from Line 2 where Remove from Line 1 was), its next step down or Take it down, the Undo
// chip naming the command before, or the map under a menu or a card that closed (a stop placed where the
// Build menu stood). Or the button is still there and its first command has not landed yet (Create
// buying a second line, Found the company or Take it refused as done already).
// One window listener, in the capture phase, so neither React's handlers nor the map's hear a dropped
// click: a click that starts a run of clicks (event.detail 1) on a control (a button, a link, a
// dropdown's option or a menu's item, but nothing on the map's canvas) arms it, and the clicks after it
// in that run (detail 2 and up) and their dblclick are dropped. The next click that starts a run of its
// own, or a key's click (detail 0), disarms it, and arms it again if it is on a control. A double-click
// that starts on the map keeps its second click, which the map takes as one with a tool out and which
// zooms or tilts with none (loadMap.ts). No control in the game asks for a double-click. The press-away
// rule's twin (pressAway.ts).

const CONTROLS = 'button, a, [role="option"], [role="menuitem"]';
const CANVAS = '.maplibregl-canvas-container';

/** Whether `target` is on the map's canvas, where a press is the map's: the compass and the map's Reload sit beside it in the map's box, and are controls. */
export function onCanvas(target: unknown): boolean {
  const at = target as { closest?: (selector: string) => unknown } | null;
  return typeof at?.closest === 'function' && at.closest(CANVAS) !== null;
}

/** Whether a click on `target` presses a control: inside a button, a link, an option or a menu item, and not on the map's canvas (onCanvas). */
export function onControl(target: unknown): boolean {
  const at = target as { closest?: (selector: string) => unknown } | null;
  if (typeof at?.closest !== 'function') return false;
  return at.closest(CONTROLS) !== null && !onCanvas(target);
}

/** Puts the rule on `page` (the window), once; returns what takes it off again. */
export function onePress(page: EventTarget = window): () => void {
  let armed = false;
  const heard = (event: Event) => {
    // A click the page makes itself from a press (Export's download link, Import's file picker) is no
    // press of the player's: it neither ends the watch nor is dropped.
    if (!event.isTrusted) return;
    const detail = (event as MouseEvent).detail;
    if (event.type === 'click' && detail <= 1) {
      armed = detail === 1 && onControl(event.target);
      return;
    }
    if (!armed) return;
    event.stopPropagation();
    event.preventDefault();
  };
  page.addEventListener('click', heard, { capture: true });
  page.addEventListener('dblclick', heard, { capture: true });
  return () => {
    page.removeEventListener('click', heard, { capture: true });
    page.removeEventListener('dblclick', heard, { capture: true });
  };
}
