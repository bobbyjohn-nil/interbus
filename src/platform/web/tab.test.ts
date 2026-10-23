import { afterEach, describe, expect, it } from 'vitest';
import { firstInTab } from './tab';

function memory() {
  const kept = new Map<string, string>();
  return { getItem: (k: string) => kept.get(k) ?? null, setItem: (k: string, v: string) => void kept.set(k, v), kept };
}

describe('once a tab', () => {
  afterEach(() => {
    delete (globalThis as { sessionStorage?: unknown }).sessionStorage;
  });

  it('is the first time once, then not, each thing on its own', () => {
    const tab = memory();
    expect(firstInTab('boot-wipe', tab)).toBe(true);
    expect(firstInTab('boot-wipe', tab)).toBe(false);
    expect(firstInTab('something else', tab)).toBe(true);
    expect([...tab.kept.keys()]).toEqual(['interbus.tab.boot-wipe', 'interbus.tab.something else']);
  });

  it('is always the first time with no storage, or storage that refuses', () => {
    expect(firstInTab('boot-wipe', null)).toBe(true);
    const refusing = {
      getItem: () => {
        throw new Error('refused');
      },
      setItem: () => {},
    };
    expect(firstInTab('boot-wipe', refusing)).toBe(true);
  });

  // A browser blocking the site's data throws as the storage itself is read: shown failing (TS-04) with it read outside the
  // try, where the throw went on through the boot splash's end and unmounted the game (the review of #161).
  it('is the first time, and throws nothing, where the browser blocks the storage itself', () => {
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      get() {
        throw new DOMException('The operation is insecure.', 'SecurityError');
      },
    });
    expect(firstInTab('boot-wipe')).toBe(true);
  });

  it('reads the page’s own session storage when given none', () => {
    const tab = memory();
    Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: tab });
    expect(firstInTab('boot-wipe')).toBe(true);
    expect(firstInTab('boot-wipe')).toBe(false);
  });
});
