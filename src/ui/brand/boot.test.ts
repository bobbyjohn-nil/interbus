// The boot splash's end (boot.ts) and what the splash says (index.html). The splash itself, towed away in a browser, is
// e2e/boot.spec.ts's.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { copyProblem } from '../copyRules';
import { endBoot, WIPE_MS, type BootEnv } from './boot';

/** A splash that keeps its classes and whether it has gone, and the timers asked for, to run by hand. */
function page(over: Partial<BootEnv> = {}) {
  const classes = new Set<string>();
  const timers: { run: () => void; ms: number }[] = [];
  const state = { gone: false, asked: 0 };
  const boot = {
    classList: { contains: (c: string) => classes.has(c), add: (c: string) => void classes.add(c) } as unknown as DOMTokenList,
    remove: () => void (state.gone = true),
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
  it('the first time in a tab, its bus tows it away, and it goes a little past the wipe', () => {
    const p = page();
    endBoot(p.env);
    expect(p.classes.has('leaving')).toBe(true);
    expect(p.state.gone).toBe(false);
    expect(p.timers.map((t) => t.ms)).toEqual([WIPE_MS + 150]);
    p.timers[0]!.run();
    expect(p.state.gone).toBe(true);
  });

  it('later in the tab, it goes at once', () => {
    const p = page({ firstInTab: () => false });
    endBoot(p.env);
    expect(p.state.gone).toBe(true);
    expect(p.classes.has('leaving')).toBe(false);
    expect(p.timers).toEqual([]);
  });

  it('for anyone who asked for less motion, it goes at once and leaves the tab’s first time unspent', () => {
    const p = page({ still: true });
    endBoot(p.env);
    expect(p.state.gone).toBe(true);
    expect(p.classes.has('leaving')).toBe(false);
    expect(p.state.asked).toBe(0);
  });

  it('called again while it leaves, or on a page with none, it does nothing more', () => {
    const p = page();
    endBoot(p.env);
    endBoot(p.env);
    expect(p.timers).toHaveLength(1);
    expect(p.state.asked).toBe(1);
    expect(() => endBoot({ ...p.env, boot: null })).not.toThrow();
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
