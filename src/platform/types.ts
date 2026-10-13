// The contracts every platform flavour (web now, desktop from Feb 8) fulfils (PLAN §6 "Platform seams").

/**
 * Where saves live: browser storage on the web preview and in the demo, disk with the full release.
 * Async, so a desktop flavour can write files; the export file equals a desktop save.
 */
export interface SaveStore {
  read(key: string): Promise<string | null>;
  write(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

/** A write or removal the sim's save decoder asks for (a backup before a refusal, say). */
export type StoreEffect = { readonly op: 'write'; readonly key: string; readonly value: string } | { readonly op: 'remove'; readonly key: string };

/** Carries out effects in order: the backup is written before the live key is removed. */
export async function applyEffects(store: SaveStore, effects: readonly StoreEffect[]): Promise<void> {
  for (const effect of effects) {
    if (effect.op === 'write') await store.write(effect.key, effect.value);
    else await store.remove(effect.key);
  }
}
