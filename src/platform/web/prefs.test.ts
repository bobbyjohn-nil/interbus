// A viewer's dot choice (D25) is read back as written, outside the save keys, and a storage that
// refuses gives both kinds rather than an error.
import { describe, expect, it } from 'vitest';
import { MAP_PREFS_KEY, readDotPrefs, writeDotPrefs } from './prefs';

const memory = () => {
  const items = new Map<string, string>();
  return { getItem: (k: string) => items.get(k) ?? null, setItem: (k: string, v: string) => void items.set(k, v), items };
};

describe('the map preferences', () => {
  it('reads back what was written', () => {
    const store = memory();
    expect(readDotPrefs(store)).toEqual({ home: true, job: true });
    writeDotPrefs({ home: false, job: true }, store);
    expect(readDotPrefs(store)).toEqual({ home: false, job: true });
    expect([...store.items.keys()]).toEqual([MAP_PREFS_KEY]);
    expect(MAP_PREFS_KEY.startsWith('interbus.prefs.')).toBe(true);
  });

  it('gives both kinds when the storage throws, holds nothing, or holds something else', () => {
    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(readDotPrefs(throwing)).toEqual({ home: true, job: true });
    expect(() => writeDotPrefs({ home: false, job: false }, throwing)).not.toThrow();
    expect(readDotPrefs(null)).toEqual({ home: true, job: true });
    const odd = memory();
    odd.setItem(MAP_PREFS_KEY, '{not json');
    expect(readDotPrefs(odd)).toEqual({ home: true, job: true });
  });
});
