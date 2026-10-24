// A viewer's own settings, not part of any game: which demand dots show, and the speed Play resumes (D25). They live in this
// browser only, under keys apart from the saves (interbus.save., .slot., .backup., .quarter.), so no save, export or set-aside
// ever carries them; a storage that refuses gives the defaults.

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

export const PLAY_PREFS_KEY = 'interbus.prefs.play';

/** The speed this viewer last played at, as kept (App checks it is one), or null. */
export function readPlaySpeed(store: Store | null = browserStore()): unknown {
  try {
    const raw = store?.getItem(PLAY_PREFS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return (parsed as { speed?: unknown } | null)?.speed ?? null;
  } catch {
    return null;
  }
}

/** Remembers the speed last played at; a storage that refuses forgets it quietly. */
export function writePlaySpeed(speed: number, store: Store | null = browserStore()): void {
  try {
    store?.setItem(PLAY_PREFS_KEY, JSON.stringify({ speed }));
  } catch {
    // Private windows and full storage refuse; the speed holds for this visit.
  }
}
