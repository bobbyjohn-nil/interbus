// The web preview's SaveStore: localStorage behind the async interface. Synchronous underneath, so
// a write made while the page hides still completes (V3 wrote on pagehide). A browser that refuses
// storage (private mode, blocked site data) throws here; the caller reports it and keeps playing.
import type { SaveStore, StoreRefusal } from '../types';

export function createWebSaveStore(storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = localStorage): SaveStore {
  return {
    read: async (key) => storage.getItem(key),
    write: async (key, value) => storage.setItem(key, value),
    remove: async (key) => storage.removeItem(key),
  };
}

/**
 * Why the store refused a job, by the error's name: a write beyond the origin's room throws a QuotaExceededError (so Chromium
 * names it in e2e/saves.spec.ts, the store filled by other keys of the origin; other browsers not measured); anything else,
 * such as a SecurityError from blocked site data, means the browser keeps nothing. A QuotaExceededError from a store with no
 * room at all reads as full too, so Saves' line for it names Export beside Delete.
 */
export function storeRefusal(error: unknown): StoreRefusal {
  return (error as { name?: unknown } | null)?.name === 'QuotaExceededError' ? 'full' : 'blocked';
}

/**
 * Says what another tab of this origin put under a key (null once it is removed), or that it cleared the store (key and text
 * null), as the window's 'storage' event tells it; this page's own writes are not said (the systems audit's fifth round: two tabs
 * of the game). Every key is said, a slot's as the autosave's (the seventh round). Returns the way to stop listening.
 */
export function onOtherTabWrites(then: (key: string | null, text: string | null) => void, target: Pick<Window, 'addEventListener' | 'removeEventListener'> = window): () => void {
  const heard = (event: StorageEvent) => then(event.key, event.key === null ? null : event.newValue);
  target.addEventListener('storage', heard);
  return () => target.removeEventListener('storage', heard);
}
