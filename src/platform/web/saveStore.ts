// The web preview's SaveStore: localStorage behind the async interface. Synchronous underneath, so
// a write made while the page hides still completes (V3 wrote on pagehide). A browser that refuses
// storage (private mode, blocked site data) throws here; the caller reports it and keeps playing.
import type { SaveStore } from '../types';

export function createWebSaveStore(storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = localStorage): SaveStore {
  return {
    read: async (key) => storage.getItem(key),
    write: async (key, value) => storage.setItem(key, value),
    remove: async (key) => storage.removeItem(key),
  };
}
