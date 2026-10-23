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
  const state = { gone: false, asked: 0, hidden: null as string | null, holds: 0 };
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
    holdKeys: () => void state.holds++,
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
    // While it is towed the keyboard reaches nothing it hides (holdKeys, for as long as it stands): Tab reached Home's buttons
    // under it, and Enter pressed New game unseen (the systems audit's eleventh round).
    expect(p.state.holds).toBe(1);
    p.timers[0]!.run();
    expect(p.state.gone).toBe(true);
  });

  it('later in the tab, it goes at once', () => {
    const p = page({ firstInTab: () => false });
    endBoot(true, p.env);
    expect(p.state.gone).toBe(true);
    expect(p.classes.has('leaving')).toBe(false);
    expect(p.timers).toEqual([]);
    expect(p.state.holds).toBe(0);
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
// elsewhere), so a hold that never let go would have passed them all and left a first visit's keyboard dead.
describe('the keys held while the splash is towed away', () => {
  function page() {
    const listeners: ((e: KeyboardEvent) => void)[] = [];
    const state = { boot: true, display: 'grid' };
    const win = {
      addEventListener: (_type: string, l: (e: KeyboardEvent) => void) => void listeners.push(l),
      removeEventListener: (_type: string, l: (e: KeyboardEvent) => void) => void listeners.splice(listeners.indexOf(l), 1),
      document: { getElementById: (id: string) => (id === 'boot' && state.boot ? {} : null) },
      getComputedStyle: () => ({ display: state.display }),
    } as unknown as Window;
    /** Whether `key` (with `mods`, on something inside `inside`) is held: its default and its way on both stopped. */
    const held = (key: string, mods: Partial<KeyboardEvent> = {}, inside: string | null = null) => {
      const e = { key, ctrlKey: false, metaKey: false, altKey: false, ...mods, target: { closest: (s: string) => (inside && s.includes(inside) ? {} : null) }, prevented: false, stopped: false };
      Object.assign(e, { preventDefault: () => void (e.prevented = true), stopImmediatePropagation: () => void (e.stopped = true) });
      for (const l of [...listeners]) l(e as unknown as KeyboardEvent);
      return e.prevented && e.stopped;
    };
    return { win, state, held, listeners };
  }

  it('holds plain keys while it stands, never the browser’s own or the corner’s, and lets go once it has gone', () => {
    const p = page();
    holdKeys(p.win);
    for (const key of ['Tab', 'Enter', ' ', '?', '2', 't']) expect(p.held(key), key).toBe(true);
    expect(p.held('r', { ctrlKey: true })).toBe(false);
    expect(p.held('r', { metaKey: true })).toBe(false);
    expect(p.held('ArrowLeft', { altKey: true })).toBe(false);
    expect(p.held('F5')).toBe(false);
    expect(p.held('Enter', {}, '.corner')).toBe(false);
    expect(p.held('Enter', {}, '.replaced')).toBe(false);
    // Gone at once with less motion asked for mid-tow (app.css): nothing held.
    p.state.display = 'none';
    expect(p.held('Tab')).toBe(false);
    p.state.display = 'grid';
    expect(p.held('Tab')).toBe(true);
    // Gone: the next key goes on, and the hold with it.
    p.state.boot = false;
    expect(p.held('Tab')).toBe(false);
    expect(p.listeners).toHaveLength(0);
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
