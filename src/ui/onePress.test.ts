// One press, one command (onePress.ts; D26, the systems audit's second round): a double-click that
// starts on a control is one press, its later clicks and its dblclick dropped wherever they land, and the
// next click that starts a run of its own ends the watch. The browser shows what it fixes
// (e2e/presses.spec.ts); this pins the rule itself. Shown failing (TS-04) on 2a00661, which has no such rule.
// A double-click that starts on the map keeps its later clicks only while they land on the map (the
// systems audit's third round): shown failing on 5f4bce3, which let the second click press a stop card's Take it down.
// A held key is one press too (the systems audit's fourth round): a repeat of Enter or Space on a control,
// or on the list that holds a dropdown's focus, goes nowhere. Shown failing on abb5f2f, whose rule heard
// no keys: every repeat went on.
import { describe, expect, it } from 'vitest';
import { onControl, onePress } from './onePress';

/** What a click lands on: a control (a button, a link, an option, a menu item), a card's text, the map's canvas, a control drawn on the canvas, or the boot splash; or, for a key, a dropdown's open list or a text field. */
type Under = 'button' | 'text' | 'canvas' | 'button on the canvas' | 'splash' | 'list' | 'field';

/** `closest` as what is under the pointer answers it. */
function closest(under: Under): (selector: string) => object | null {
  return (selector) => {
    if (selector.includes('maplibregl-canvas-container')) return under === 'canvas' || under === 'button on the canvas' ? {} : null;
    if (selector === '#boot') return under === 'splash' ? {} : null;
    if (under === 'list') return selector.includes('listbox') ? {} : null;
    return selector.includes('button') && (under === 'button' || under === 'button on the canvas') ? {} : null;
  };
}

/** An event the browser makes from the player's own press (isTrusted). */
class Players extends Event {
  override get isTrusted(): boolean {
    return true;
  }
}

/** The window as the rule hears it: a click lands on the window itself, which answers `closest` as what is under the pointer would. */
class Page extends EventTarget {
  under: Under = 'text';
  closest(selector: string): object | null {
    return closest(this.under)(selector);
  }
  /** Click `detail` of its run (0 for a key's) on `under`, or its dblclick, the player's or (`trusted` false) one the page makes itself; whether it goes on. */
  click(under: Under, detail: number, type: 'click' | 'dblclick' = 'click', trusted = true): boolean {
    this.under = under;
    const event = new (trusted ? Players : Event)(type, { cancelable: true });
    Object.defineProperty(event, 'detail', { value: detail });
    return this.dispatchEvent(event);
  }
  /** `key` down on `under`, held (`repeat`) or not; whether it goes on, its default and on past the window. */
  key(under: Under, key: string, repeat: boolean): boolean {
    this.under = under;
    const event = new Event('keydown', { cancelable: true });
    Object.defineProperties(event, { key: { value: key }, repeat: { value: repeat } });
    const done = this.dispatchEvent(event);
    return done && !event.cancelBubble;
  }
}

describe('one press, one command', () => {
  // The systems audit's eleventh round: the splash takes the pointer as its bus tows it away (round 10), and between a
  // double-click's two clicks the tow uncovered Home's New game under the pointer: its second click pressed it.
  it('drops the rest of a double-click that starts on the boot splash, as on a control', () => {
    const page = new Page();
    onePress(page);
    expect(page.click('splash', 1)).toBe(true);
    expect(page.click('button', 2)).toBe(false);
    expect(page.click('button', 0, 'dblclick')).toBe(false);
    // A run of its own after it presses as ever.
    expect(page.click('button', 1)).toBe(true);
  });

  it('drops the rest of a double-click that starts on a control, wherever it lands, and its dblclick', () => {
    const page = new Page();
    onePress(page);
    expect(page.click('button', 1)).toBe(true);
    // The card closed under it: the map, a card's text, the next row's button.
    expect([page.click('canvas', 2), page.click('canvas', 2, 'dblclick'), page.click('text', 3), page.click('button', 4)]).toEqual([false, false, false, false]);
  });

  it('keeps a double-click that starts off a control: the map takes its second click as one with a tool out, and zooms or tilts with none', () => {
    const page = new Page();
    onePress(page);
    expect([page.click('canvas', 1), page.click('canvas', 2), page.click('canvas', 2, 'dblclick')]).toEqual([true, true, true]);
    expect([page.click('text', 1), page.click('button', 2)]).toEqual([true, true]);
  });

  it('drops the rest of a double-click that starts on the map once a click lands off it, on a card or a button that opened under the pointer', () => {
    const page = new Page();
    onePress(page);
    // The first click opened a stop's card under the pointer: the second click and the dblclick land on Take it down.
    expect([page.click('canvas', 1), page.click('button', 2), page.click('button', 2, 'dblclick')]).toEqual([true, false, false]);
    // Off the map on a card's text, then back on the map: the run left the map, and the rest of it goes nowhere.
    expect([page.click('canvas', 1), page.click('text', 2), page.click('canvas', 3), page.click('canvas', 3, 'dblclick')]).toEqual([true, false, false, false]);
    // The next run on the map is the map's again.
    expect([page.click('canvas', 1), page.click('canvas', 2), page.click('canvas', 2, 'dblclick')]).toEqual([true, true, true]);
  });

  it('ends the watch at the next click that starts a run of its own, or a key’s click, so no later click is lost', () => {
    const page = new Page();
    onePress(page);
    page.click('button', 1);
    expect([page.click('canvas', 1), page.click('canvas', 2)]).toEqual([true, true]);
    page.click('button', 1);
    expect([page.click('button', 0), page.click('canvas', 2)]).toEqual([true, true]);
    // The next button pressed on its own works, and arms the watch again.
    page.click('button', 1);
    expect([page.click('button', 1), page.click('canvas', 2)]).toEqual([true, false]);
  });

  it('neither ends the watch for nor drops a click the page makes itself, such as Export’s download link', () => {
    const page = new Page();
    onePress(page);
    page.click('button', 1);
    expect(page.click('button', 0, 'click', false)).toBe(true);
    expect(page.click('button', 2)).toBe(false);
  });

  // The browser presses a focused button again at each repeat of Enter (a key's click), the demand menu turned a kind
  // on or off again at each repeat of Enter, and a dropdown's list picked again at each repeat of Enter or Space;
  // Space's own press comes as it is let go, and a repeat dropped never arms the button, so a held Space presses once too.
  it('drops a held Enter’s or Space’s repeats on a control or a dropdown’s list, and nothing else', () => {
    const page = new Page();
    onePress(page);
    expect([page.key('button', 'Enter', false), page.key('button', 'Enter', true), page.key('button', ' ', true)]).toEqual([true, false, false]);
    expect([page.key('list', ' ', false), page.key('list', ' ', true), page.key('list', 'Enter', true)]).toEqual([true, false, false]);
    // A held arrow still moves, a held 1 to 5 and Space reach the page, which drops their repeats itself (App.tsx), and a held Space types in a text field.
    expect([page.key('list', 'ArrowDown', true), page.key('button', '3', true), page.key('field', ' ', true), page.key('text', ' ', true)]).toEqual([true, true, true, true]);
  });

  it('drops nothing once taken off', () => {
    const page = new Page();
    onePress(page)();
    page.click('button', 1);
    expect([page.click('canvas', 2), page.key('button', 'Enter', true)]).toEqual([true, true]);
  });

  it('counts a control anywhere but on the map’s canvas, and nothing that is not an element', () => {
    expect([onControl({ closest: closest('button') }), onControl({ closest: closest('text') })]).toEqual([true, false]);
    expect([onControl({ closest: closest('canvas') }), onControl({ closest: closest('button on the canvas') })]).toEqual([false, false]);
    expect([onControl(null), onControl({})]).toEqual([false, false]);
  });
});
