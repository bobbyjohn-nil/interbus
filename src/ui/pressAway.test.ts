// A press outside an open menu closes it (pressAway.ts; the systems audit, D26): on the map's canvas
// that is all it does, its click going nowhere, and on a control it still works the control, the
// compass and the lost-graphics card's Reload in the map's box among them. Shown failing (TS-04) on
// 7d5ca2b, which dropped the click of any press in the map's box: the compass's and Reload's too.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeOnPressAway } from './pressAway';

/** What a press lands on: the map's canvas, a control in the map's box (the compass, Reload), a control elsewhere (Finance), a panel's text, or the open menu itself. */
type Under = 'canvas' | 'compass' | 'finance' | 'text' | 'menu';

/** The element under the pointer, as `closest` answers for it. */
class Spot {
  constructor(readonly under: Under) {}
  closest(selector: string): object | null {
    if (selector.includes('maplibregl-canvas-container')) return this.under === 'canvas' ? {} : null;
    // The map's box holds its canvas, the compass and the lost-graphics card.
    if (selector === '.map') return this.under === 'canvas' || this.under === 'compass' ? {} : null;
    if (selector.includes('button')) return this.under === 'compass' || this.under === 'finance' || this.under === 'menu' ? {} : null;
    return null;
  }
}

/** The window as the rule hears it. A capture listener comes off with `true`, as in a browser (Node's own EventTarget reads only `{ capture: true }`). */
class Page extends EventTarget {
  override removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions): void {
    super.removeEventListener(type, listener, typeof options === 'boolean' ? { capture: options } : options);
  }
}

/** The window, in place of the browser's; and `Element` stands for the spots, so a rule that asks whether a target is an element (7d5ca2b's did) reads them as the page's. */
const scope = globalThis as unknown as { window?: EventTarget; Element?: unknown };
let page: EventTarget;
beforeEach(() => {
  page = new Page();
  scope.window = page;
  scope.Element = Spot;
});
afterEach(() => {
  delete scope.window;
  delete scope.Element;
});

/** A press on `under` with a menu open: whether it closed the menu, and whether the click it makes, and a click after it, go on. */
function press(under: Under): { closed: boolean; click: boolean; next: boolean } {
  let closed = false;
  const away = closeOnPressAway((target) => (target as unknown as Spot).under === 'menu', () => void (closed = true));
  away({ target: new Spot(under) } as unknown as PointerEvent);
  const click = page.dispatchEvent(new Event('click', { cancelable: true }));
  page.dispatchEvent(new Event('pointerdown'));
  const next = page.dispatchEvent(new Event('click', { cancelable: true }));
  return { closed, click, next };
}

describe('a press away from an open menu', () => {
  it('on the map’s canvas closes the menu and does nothing more: its click goes nowhere, and the next press’s click goes on', () => {
    expect(press('canvas')).toEqual({ closed: true, click: false, next: true });
  });

  it('on a control in the map’s box (the compass, the lost-graphics card’s Reload) closes the menu and still works that control', () => {
    expect(press('compass')).toEqual({ closed: true, click: true, next: true });
  });

  it('on any other control or a panel’s text closes the menu and leaves its click alone', () => {
    expect(press('finance')).toEqual({ closed: true, click: true, next: true });
    expect(press('text')).toEqual({ closed: true, click: true, next: true });
  });

  it('inside the menu leaves it open', () => {
    expect(press('menu')).toEqual({ closed: false, click: true, next: true });
  });
});
