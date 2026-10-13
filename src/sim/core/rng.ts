// The sim's only randomness, ported from V2 (`Intralines_City_dep@archive/intralines-city-v1:
// Gaming/src/10-core.js:427-460`, S11): mulberry32, seeded through FNV-1a and salted by purpose, so
// adding a draw in one system never shifts another's sequence. Changed on the way in: the state is
// one uint32 the save holds (PLAN §6: "clock and RNG"), where V2 and V3 kept it in a closure.

/** FNV-1a, 32-bit: V2's `IL.hash`. */
export function hashString(text: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** The starting state of the stream for one purpose, as V2's `IL.rng(seed + '|' + purpose)`. */
export function seedFor(seed: number | string, purpose: string): number {
  return hashString(`${seed}|${purpose}`);
}

export interface Rng {
  /** A float in [0, 1). */
  next(): number;
  /** A whole number in [lo, hi], both included. */
  int(lo: number, hi: number): number;
  /** A float in [lo, hi). */
  range(lo: number, hi: number): number;
  pick<T>(items: readonly T[]): T;
  /** Fisher–Yates, in place. */
  shuffle<T>(items: T[]): T[];
  /** The whole state: `createRng(rng.state)` continues the same sequence. */
  readonly state: number;
}

export function createRng(state: number): Rng {
  if (!Number.isInteger(state) || state < 0 || state > 0xffffffff) throw new RangeError(`bad RNG state ${state}`);
  let a = state >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (lo, hi) => Math.floor(lo + next() * (hi - lo + 1)),
    range: (lo, hi) => lo + next() * (hi - lo),
    pick: <T>(items: readonly T[]) => {
      if (items.length === 0) throw new RangeError('pick from an empty list');
      return items[Math.floor(next() * items.length) % items.length] as T;
    },
    shuffle: <T>(items: T[]) => {
      for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [items[i], items[j]] = [items[j] as T, items[i] as T];
      }
      return items;
    },
    get state() {
      return a;
    },
  };
}
