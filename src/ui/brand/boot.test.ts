// The boot splash's end (boot.ts) and what the splash says (index.html). The splash itself, towed away in a browser, is
// e2e/boot.spec.ts's.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { copyProblem } from '../copyRules';
import { endBoot, holdKeys, WIPE_MS, type BootEnv } from './boot';

/** A splash that keeps its classes and whether it has gone, and the timers asked for, to run by hand. */
function page(over: Partial<BootEnv> = {}) {
  const classes = new Set<string>();
  const timers: { run: () => void; ms: number }[] = [];
  const state = { gone: false, asked: 0, hidden: null as string | null };
  const boot = {
    classList: { contains: (c: string) => classes.has(c), add: (c: string) => void classes.add(c) } as unknown as DOMTokenList,
    remove: () => void (state.gone = true),
    setAttribute: (name: string, value: string) => void (name === 'aria-hidden' && (state.hidden = value)),
  };
  const env: BootEnv = {
    boot,
    still: false,
    firstInTab: () => ++state.asked === 1,
    later: (run, ms) => void timers.push({ run, ms }),
    ...over,
  };
  return { env, classes, timers, state };
}

describe('the boot splash’s end', () => {
  it('the first time in a tab, its bus tows it away, saying nothing more, and it goes a little past the wipe', () => {
    const p = page();
    endBoot(true, p.env);
    expect(p.classes.has('leaving')).toBe(true);
    expect(p.state.hidden).toBe('true');
    expect(p.state.gone).toBe(false);
    expect(p.timers.map((t) => t.ms)).toEqual([WIPE_MS + 150]);
    p.timers[0]!.run();
    expect(p.state.gone).toBe(true);
  });

  it('later in the tab, it goes at once', () => {
    const p = page({ firstInTab: () => false });
    endBoot(true, p.env);
    expect(p.state.gone).toBe(true);
    expect(p.classes.has('leaving')).toBe(false);
    expect(p.timers).toEqual([]);
  });

  it('for anyone who asked for less motion, it goes at once and leaves the tab’s first time unspent', () => {
    const p = page({ still: true });
    endBoot(true, p.env);
    expect(p.state.gone).toBe(true);
    expect(p.classes.has('leaving')).toBe(false);
    expect(p.state.asked).toBe(0);
  });

  it('for a game that could not start, it goes at once and leaves the tab’s tow for the start that works', () => {
    const p = page();
    endBoot(false, p.env);
    expect(p.state.gone).toBe(true);
    expect(p.classes.has('leaving')).toBe(false);
    expect(p.state.asked).toBe(0);
  });

  it('called again while it leaves, or on a page with none, it does nothing more', () => {
    const p = page();
    endBoot(true, p.env);
    endBoot(true, p.env);
    expect(p.timers).toHaveLength(1);
    expect(p.state.asked).toBe(1);
    expect(() => endBoot(true, { ...p.env, boot: null })).not.toThrow();
  });
});

// The review of round 11: the hold itself, which the e2e tests reach only while the splash stands (e2e/base.ts takes the tow away
// elsewhere), so a hold that never let go would have passed them all and left a first visit's keyboard dead. It stands from the
// page's first script (main.tsx), as the game loads under the splash (the systems audit's twelfth round).
describe('the keys held while the splash stands', () => {
  const W = 1152;
  const H = 720;
  /** A screen 1152×720 whose splash stands from `x` to its right edge (x = 0 before the tow, more as its bus tows it away). */
  function page() {
    const listeners: ((e: KeyboardEvent) => void)[] = [];
    const state = { boot: true, display: 'grid', x: 0 };
    const rect = (left: number, top: number, right: number, bottom: number) => ({ left, top, right, bottom, x: left, y: top, width: right - left, height: bottom - top }) as DOMRect;
    const win = {
      innerWidth: W,
      innerHeight: H,
      addEventListener: (_type: string, l: (e: KeyboardEvent) => void) => void listeners.push(l),
      removeEventListener: (_type: string, l: (e: KeyboardEvent) => void) => void listeners.splice(listeners.indexOf(l), 1),
      document: { getElementById: (id: string) => (id === 'boot' && state.boot ? { getBoundingClientRect: () => rect(state.x, 0, state.x + W, H) } : null) },
      getComputedStyle: () => ({ display: state.display }),
    } as unknown as Window;
    /** A control from `left` to `right` across the screen's middle, inside `inside` if given. */
    const control = (left: number, right: number, inside: string | null = null) => ({
      tagName: 'BUTTON',
      closest: (selector: string) => (inside && selector.includes(inside) ? {} : null),
      getBoundingClientRect: () => rect(left, 300, right, 340),
    });
    const body = { tagName: 'BODY', closest: () => null, getBoundingClientRect: () => rect(0, 0, W, H) };
    /** What became of `key` (with `mods`) on `target`: its default stopped, and its way on to the page's own keys. */
    const press = (key: string, mods: Partial<KeyboardEvent> = {}, target: object = body) => {
      const e = { key, ctrlKey: false, metaKey: false, altKey: false, ...mods, target, prevented: false, stopped: false };
      Object.assign(e, { preventDefault: () => void (e.prevented = true), stopImmediatePropagation: () => void (e.stopped = true) });
      for (const l of [...listeners]) l(e as unknown as KeyboardEvent);
      return { prevented: e.prevented, stopped: e.stopped };
    };
    const HELD = { prevented: true, stopped: true };
    const OWN = { prevented: false, stopped: true };
    const FREE = { prevented: false, stopped: false };
    return { win, state, press, control, listeners, HELD, OWN, FREE };
  }

  it('holds plain keys while it stands, never the browser’s own, and lets go once it has gone', () => {
    const p = page();
    holdKeys(p.win);
    for (const key of ['Tab', 'Enter', ' ', '?', '2', 't', 'ArrowLeft']) expect(p.press(key), key).toEqual(p.HELD);
    expect(p.press('r', { ctrlKey: true })).toEqual(p.FREE);
    expect(p.press('r', { metaKey: true })).toEqual(p.FREE);
    expect(p.press('ArrowLeft', { altKey: true })).toEqual(p.FREE);
    expect(p.press('F5')).toEqual(p.FREE);
    // Gone at once with less motion asked for mid-tow (app.css): nothing held.
    p.state.display = 'none';
    expect(p.press('Tab')).toEqual(p.FREE);
    p.state.display = 'grid';
    expect(p.press('Tab')).toEqual(p.HELD);
    // Gone: the next key goes on, and the hold with it.
    p.state.boot = false;
    expect(p.press('Tab')).toEqual(p.FREE);
    expect(p.listeners).toHaveLength(0);
  });

  // The twelfth round: ? on the corner's credit opened Help under the standing splash.
  it('leaves the corner and the replaced build’s card their own keys, but not the page’s', () => {
    const p = page();
    holdKeys(p.win);
    for (const inside of ['.corner', '.replaced']) {
      for (const key of ['Enter', 'Tab', '?', 't']) expect(p.press(key, {}, p.control(900, 1100, inside)), `${key} in ${inside}`).toEqual(p.OWN);
    }
  });

  // The twelfth round: a press on New game, uncovered at 2.1 s of the 2.4 s tow, opened the founding card, and the name typed into
  // it was held till the splash went.
  it('leaves what the tow has uncovered, wholly or in part, its own keys, and holds what it still covers or what is off the screen', () => {
    const p = page();
    holdKeys(p.win);
    p.state.x = 750;
    const card = p.control(406, 746);
    for (const key of ['B', ' ', 'Enter', 'Tab', '?']) expect(p.press(key, {}, card), key).toEqual(p.OWN);
    expect(p.press('Enter', {}, p.control(436, 900)), 'half uncovered').toEqual(p.OWN);
    expect(p.press('Enter', {}, p.control(800, 900)), 'still under it').toEqual(p.HELD);
    expect(p.press('Enter', {}, p.control(-10_000, -9_000)), 'off the screen').toEqual(p.HELD);
    expect(p.press('Enter'), 'nothing focused').toEqual(p.HELD);
    // Before the tow the splash covers the whole screen, the card with it.
    p.state.x = 0;
    expect(p.press('B', {}, card)).toEqual(p.HELD);
  });

  it('lets every key go once the tow has taken the splash off the screen, before its timer takes it away', () => {
    const p = page();
    holdKeys(p.win);
    p.state.x = W;
    for (const key of ['Tab', 'Enter', '?']) expect(p.press(key), key).toEqual(p.FREE);
  });
});

describe('what the splash says', () => {
  const html = readFileSync(new URL('../../../index.html', import.meta.url), 'utf8');
  const chatter = [...html.matchAll(/^\s*'([^']+…)',$/gm)].map((m) => m[1]!);
  const stuck = /var stuck = '([^']+)';/.exec(html)?.[1];

  it('holds a dozen lines of depot chatter, and what it says when nothing comes', () => {
    expect(chatter).toHaveLength(12);
    expect(new Set(chatter).size).toBe(12);
    expect(stuck).toBe('Still loading. Reload the page if this stays.');
  });

  it('keeps the copy convention, in US English, in every line it can show', () => {
    for (const line of [...chatter, stuck!, 'Interbus', 'Loading']) expect(copyProblem(line), line).toBeNull();
    expect(chatter.join(' ')).not.toMatch(/tyre|colour|centre|kerb/i);
    // The first line shows before the chatter starts, and the chatter starts from one of its own.
    expect(chatter).toContain(/<span class="boot-line" aria-hidden="true">([^<]+)<\/span>/.exec(html)?.[1]);
  });
});
