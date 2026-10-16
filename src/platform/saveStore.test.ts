import { describe, expect, it } from 'vitest';
import { createMemorySaveStore } from './memory/saveStore';
import { applyEffects } from './types';
import { createWebSaveStore, onOtherTabWrite, storeRefusal } from './web/saveStore';

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

  // A store with no room left is told apart from one that keeps nothing, by the error's name, so the game can name the way
  // out: delete a save. Shown failing (TS-04) on 029387a, which had one word for both ("This browser isn’t keeping saves").
  it('tells a store with no room left from one that keeps nothing', async () => {
    const full = {
      ...fakeStorage(),
      setItem: () => {
        throw new DOMException("Setting the value of 'k' exceeded the quota.", 'QuotaExceededError');
      },
    };
    expect(storeRefusal(await createWebSaveStore(full).write('k', 'v').catch((e: unknown) => e))).toBe('full');
    expect(storeRefusal(new DOMException('The operation is insecure.', 'SecurityError'))).toBe('blocked');
    expect(storeRefusal(new Error('QuotaExceededError'))).toBe('blocked'); // its name, not its words
    expect(storeRefusal(undefined)).toBe('blocked');
  });

  // Another tab's save, as the window's 'storage' event tells it (the systems audit's fifth round: two tabs of the game): the
  // key's new text, null once it is removed or the store is cleared; other keys are not said, and nothing once stopped.
  it('says what another tab put under a key, until stopped', () => {
    const target = new EventTarget() as unknown as Window;
    const said: (string | null)[] = [];
    const stop = onOtherTabWrite('interbus.save.boston', (text) => said.push(text), target);
    const storage = (key: string | null, newValue: string | null) => target.dispatchEvent(Object.assign(new Event('storage'), { key, newValue }));
    storage('interbus.save.boston', 'A1');
    storage('interbus.slot.boston.1', 'S1');
    storage('interbus.save.boston', null);
    storage(null, null);
    stop();
    storage('interbus.save.boston', 'A2');
    expect(said).toEqual(['A1', null, null]);
  });
});
