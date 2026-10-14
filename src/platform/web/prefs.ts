// A viewer's own map settings, not part of any game: which demand dots show (D25). They live in this
// browser only, under a key apart from the saves (interbus.save., .slot., .backup., .quarter.), so no
// save, export or set-aside ever carries them; a storage that refuses gives the defaults.

/** Which kinds of demand dot the map shows. */
export interface DotPrefs {
  readonly home: boolean;
  readonly job: boolean;
}

export const MAP_PREFS_KEY = 'interbus.prefs.map';
const DEFAULT: DotPrefs = { home: true, job: true };

type Store = Pick<Storage, 'getItem' | 'setItem'>;

function browserStore(): Store | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // a sandboxed frame or blocked site data throws on the getter
  }
}

/** The dots this viewer last chose, or both kinds. */
export function readDotPrefs(store: Store | null = browserStore()): DotPrefs {
  try {
    const raw = store?.getItem(MAP_PREFS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    const dots = (parsed as { dots?: Partial<Record<keyof DotPrefs, unknown>> } | null)?.dots;
    if (!dots) return DEFAULT;
    return { home: dots.home !== false, job: dots.job !== false };
  } catch {
    return DEFAULT;
  }
}

/** Remembers the dots chosen; a storage that refuses forgets them quietly. */
export function writeDotPrefs(dots: DotPrefs, store: Store | null = browserStore()): void {
  try {
    store?.setItem(MAP_PREFS_KEY, JSON.stringify({ dots: { home: dots.home, job: dots.job } }));
  } catch {
    // Private windows and full storage refuse; the choice holds for this visit.
  }
}
