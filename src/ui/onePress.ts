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
// that starts on the map keeps its second click while it lands on the map, which takes it as one with a
// tool out and zooms or tilts with none (loadMap.ts). One that lands off the map is dropped, and the rest
// of its run with it (the systems audit's third round): the first click opened a stop's card or the Lines panel under
// the pointer, and the second would press whatever button came there (Take it down, Make it a Shelter).
// No control in the game asks for a double-click. The press-away rule's twin (pressAway.ts).
// A held key is one press too (the systems audit's fourth round; DECISIONS 2026-10-15, "a held key
// acts once"): the browser presses a focused button again at each repeat of Enter, the demand menu
// turned a kind on or off again at each repeat of Enter, and a dropdown's list picked again at each
// repeat of Enter or Space. Before, only the page's Space and 1 to 5 (App.tsx), the tilt keys
// (tilt.ts), the demand menu's Space and the route editor's arrows (Enter) dropped their repeats, each
// with a guard of its own. Now a repeat of
// Enter or Space on a control, or on the list that holds a dropdown's focus, is stopped at the window
// in the capture phase, as a dropped click is, before anything hears it, and its default (the
// browser's press) with it; the demand menu's and the route editor's own guards went. Space presses a
// button as it is let go, and a repeat dropped never arms it, so a held Space presses once too. Other
// keys' repeats go on: an arrow held still moves and a text field types; the page's own Space and 1 to
// 5 drop their repeats themselves (App.tsx).

/** What a press presses: a button, a link, a dropdown's option or a menu's item. */
export const CONTROLS = 'button, a, [role="option"], [role="menuitem"]';
const CANVAS = '.maplibregl-canvas-container';
/** Where a key presses: a control, or a dropdown's open list, which holds the focus while its options are picked. */
const KEYED = `${CONTROLS}, [role="listbox"]`;

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

/** Whether a key down on `target` presses something (KEYED): on a control or a dropdown's list, but not on the map's canvas. */
function keyed(target: unknown): boolean {
  const at = target as { closest?: (selector: string) => unknown } | null;
  return typeof at?.closest === 'function' && at.closest(KEYED) !== null && !onCanvas(target);
}

/** Puts the rule on `page` (the window), once; returns what takes it off again. */
export function onePress(page: EventTarget = window): () => void {
  // What the rest of the run of clicks under way does: goes on ('keep'), goes on while it lands on the
  // map's canvas ('map', a run that started there), or is dropped ('drop', a run that started on a
  // control, or left the map).
  let rest: 'keep' | 'map' | 'drop' = 'keep';
  const heard = (event: Event) => {
    // A click the page makes itself from a press (Export's download link, Import's file picker) is no
    // press of the player's: it neither ends the watch nor is dropped.
    if (!event.isTrusted) return;
    const detail = (event as MouseEvent).detail;
    if (event.type === 'click' && detail <= 1) {
      rest = detail !== 1 ? 'keep' : onControl(event.target) ? 'drop' : onCanvas(event.target) ? 'map' : 'keep';
      return;
    }
    if (rest === 'keep' || (rest === 'map' && onCanvas(event.target))) return;
    rest = 'drop';
    event.stopPropagation();
    event.preventDefault();
  };
  // A held Enter's or Space's repeats on a control go nowhere.
  const held = (event: Event) => {
    const { key, repeat } = event as KeyboardEvent;
    if (!repeat || (key !== 'Enter' && key !== ' ') || !keyed(event.target)) return;
    event.stopPropagation();
    event.preventDefault();
  };
  page.addEventListener('click', heard, { capture: true });
  page.addEventListener('dblclick', heard, { capture: true });
  page.addEventListener('keydown', held, { capture: true });
  return () => {
    page.removeEventListener('click', heard, { capture: true });
    page.removeEventListener('dblclick', heard, { capture: true });
    page.removeEventListener('keydown', held, { capture: true });
  };
}
