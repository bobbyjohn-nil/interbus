import { describe, expect, it } from 'vitest';
import { firstInTab } from './tab';

function memory() {
  const kept = new Map<string, string>();
  return { getItem: (k: string) => kept.get(k) ?? null, setItem: (k: string, v: string) => void kept.set(k, v), kept };
}

describe('once a tab', () => {
  it('is the first time once, then not, each thing on its own', () => {
    const tab = memory();
    expect(firstInTab('boot-wipe', tab)).toBe(true);
    expect(firstInTab('boot-wipe', tab)).toBe(false);
    expect(firstInTab('something else', tab)).toBe(true);
    expect([...tab.kept.keys()]).toEqual(['interbus.tab.boot-wipe', 'interbus.tab.something else']);
  });

  it('is always the first time with no storage, or storage that refuses', () => {
    expect(firstInTab('boot-wipe', undefined)).toBe(true);
    const refusing = {
      getItem: () => {
        throw new Error('refused');
      },
      setItem: () => {},
    };
    expect(firstInTab('boot-wipe', refusing)).toBe(true);
  });
});
