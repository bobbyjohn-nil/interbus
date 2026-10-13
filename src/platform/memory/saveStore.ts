// A SaveStore in memory, for tests and for a session whose browser refuses storage.
import type { SaveStore } from '../types';

export function createMemorySaveStore(initial: Record<string, string> = {}): SaveStore & { readonly entries: Map<string, string> } {
  const entries = new Map(Object.entries(initial));
  return {
    entries,
    read: async (key) => entries.get(key) ?? null,
    write: async (key, value) => void entries.set(key, value),
    remove: async (key) => void entries.delete(key),
  };
}
