import { describe, expect, it } from 'vitest';
import { createMemorySaveStore } from './memory/saveStore';
import { applyEffects } from './types';
import { createWebSaveStore } from './web/saveStore';

function fakeStorage() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

describe('save stores', () => {
  it('read, write and remove alike, web and memory', async () => {
    const storage = fakeStorage();
    for (const store of [createWebSaveStore(storage), createMemorySaveStore()]) {
      expect(await store.read('k')).toBeNull();
      await store.write('k', 'v');
      expect(await store.read('k')).toBe('v');
      await store.remove('k');
      expect(await store.read('k')).toBeNull();
    }
  });

  it('writes the backup before removing the live key', async () => {
    const store = createMemorySaveStore({ live: 'old' });
    await applyEffects(store, [
      { op: 'write', key: 'backup', value: 'old' },
      { op: 'remove', key: 'live' },
    ]);
    expect(Object.fromEntries(store.entries)).toEqual({ backup: 'old' });
  });
});
