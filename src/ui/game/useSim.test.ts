// The page's side of the store (useSim): when the store refuses the backup of a save the start sets
// aside, the sim says so ('unbacked'), so the page never also says this browser keeps no saves: one
// failure, one notice. Another refused write still says it, once, in words for why (no room, or no
// storage at all); a refused save of the game's own also holds Saves' line, and the page tells the sim
// its key, until it is kept; a refused Save here is said on its slot's row. There is no DOM here, so
// React's hooks are stood in for by a small runtime (state kept between renders, the one effect run once
// per page) and the platform by a worker and a store that refuses a backup too large for it, and any
// write beyond its room, as a full browser store does (QuotaExceededError), or every job, as blocked
// site data does (SecurityError).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { City } from '../../cities';
import type { FromWorker } from '../../sim/types';
import { useSim } from './useSim';

const page = vi.hoisted(() => {
  const cells: unknown[] = [];
  let at = 0;
  let mounted = false;
  const posted: unknown[] = [];
  const worker = { onmessage: null as ((event: { data: unknown }) => void) | null, onerror: null, postMessage: (m: unknown) => void posted.push(m), terminate: () => undefined };
  const kept = new Map<string, string>();
  return {
    cells,
    worker,
    kept,
    posted,
    /** How many characters of keys and values the store has room for, as a browser's quota. */
    room: Infinity,
    /** Whether the store keeps nothing at all, as with blocked site data. */
    blocked: false,
    /** The characters kept now, but for `but`'s. */
    used: (but?: string) => [...kept].reduce((n, [k, v]) => n + (k === but ? 0 : k.length + v.length), 0),
    /** A page opened afresh: no hooks' state, nothing posted, nothing kept, room for anything. */
    reset() {
      cells.length = 0;
      mounted = false;
      posted.length = 0;
      kept.clear();
      this.room = Infinity;
      this.blocked = false;
    },
    /** The cell for the next hook, made by `init` the first time. */
    cell<T>(init: () => T): number {
      const k = at++;
      if (!(k in cells)) cells[k] = init();
      return k;
    },
    get mounted() {
      return mounted;
    },
    render<T>(hook: () => T): T {
      at = 0;
      const out = hook();
      mounted = true;
      return out;
    },
  };
});

vi.mock('react', () => ({
  useState: (initial: unknown) => {
    const k = page.cell(() => (typeof initial === 'function' ? (initial as () => unknown)() : initial));
    return [page.cells[k], (next: unknown) => void (page.cells[k] = typeof next === 'function' ? (next as (v: unknown) => unknown)(page.cells[k]) : next)];
  },
  useRef: (initial: unknown) => page.cells[page.cell(() => ({ current: initial }))],
  useCallback: (fn: unknown) => fn,
  useEffect: (effect: () => void) => void (page.mounted ? undefined : effect()),
}));

vi.mock('../../platform', async () => ({
  applyEffects: (await import('../../platform/types')).applyEffects,
  storeRefusal: (await import('../../platform/web/saveStore')).storeRefusal,
  build: { sha: 'test', version: '0.0.0' },
  // A full disk: a backup is refused, as a large one is (QuotaExceededError), and so is a write beyond the room; smaller writes
  // are kept. Blocked site data refuses every job (SecurityError).
  createWebSaveStore: () => {
    const blocked = () => {
      if (page.blocked) throw new DOMException('The operation is insecure.', 'SecurityError');
    };
    return {
      read: async (key: string) => (blocked(), page.kept.get(key) ?? null),
      write: async (key: string, value: string) => {
        blocked();
        if (key.startsWith('interbus.backup.') || page.used(key) + key.length + value.length > page.room) throw new DOMException(`Setting the value of '${key}' exceeded the quota.`, 'QuotaExceededError');
        page.kept.set(key, value);
      },
      remove: async (key: string) => (blocked(), void page.kept.delete(key)),
    };
  },
  downloadText: () => undefined,
  pickTextFile: async () => null,
  readSimFile: async () => '{}',
  startSimWorker: async () => page.worker,
}));

const SIM = { file: 'sim.json', url: '', sha256: '0'.repeat(64), bytes: 2, extent: 'fixture' };
const CITY = { id: 'boston', sim: SIM, fixture: SIM } as unknown as City;
const sim = () => page.render(() => useSim(CITY));
const from = (m: FromWorker) => page.worker.onmessage!({ data: m });
const settle = () => new Promise((done) => setTimeout(done, 0));

describe('the page’s store', () => {
  beforeEach(() => page.reset());

  // Shown failing (TS-04) with every refused write saying the browser keeps no saves: after the notice
  // that a save was not set aside, "This browser isn’t keeping saves" followed for the same failure.
  it('leaves a refused backup of the start’s set-aside to the sim to say, and says another refused write', async () => {
    const older = '{"format":1}';
    page.kept.set('interbus.save.boston', older);
    sim();
    await settle();
    from({ type: 'ready', dots: null, depotLand: [], snapshot: null, load: 'older', checking: true } as unknown as FromWorker);
    from({
      type: 'store',
      effects: [
        { op: 'write', key: 'interbus.backup.boston.older-1', value: older },
        { op: 'remove', key: 'interbus.save.boston' },
      ],
      setAside: true,
    });
    await settle();
    expect(sim()).toMatchObject({ storeRefused: null, storeNotice: null, stored: 0, backup: 'checking' });
    expect(page.kept.get('interbus.save.boston')).toBe(older); // the remove after the refused backup never ran
    from({ type: 'unbacked', why: 'older-1' });
    expect(sim()).toMatchObject({ storeRefused: null, storeNotice: null, unbacked: 'older-1', backup: 'not-kept' });
    // A write the sim asks for later is the page's to report, as before: the notice says so, with why.
    from({ type: 'store', effects: [{ op: 'write', key: 'interbus.backup.boston.newer', value: '{}' }] });
    await settle();
    expect(sim().storeNotice).toBe('full');
  });

  const LIVE = 'interbus.save.boston';
  const QUARTER = 'interbus.quarter.boston';
  const SLOT = 'interbus.slot.boston.1';
  /** A write the sim asks for: with `owed` one of the game's own saves, the autosave or the quarter's start. */
  const write = (key: string, size: number, owed?: 'autosave' | 'quarter') => from({ type: 'store', effects: [{ op: 'write', key, value: 'x'.repeat(size) }], ...(owed ? { owed } : {}) });
  const own = (key: string, size: number) => write(key, size, key === QUARTER ? 'quarter' : 'autosave');
  /** A slot's Save here, and its Delete, as the sim asks for them: each names its slot. */
  const saveHere = (slot: number, size: number) => from({ type: 'store', effects: [{ op: 'write', key: `interbus.slot.boston.${slot}`, value: 'x'.repeat(size) }], slot });
  const deleteSlot = (slot: number) => from({ type: 'store', effects: [{ op: 'remove', key: `interbus.slot.boston.${slot}` }], slot });
  const refusals = () => page.posted.filter((m) => (m as { type: string }).type === 'store-refused');
  const opened = async () => {
    sim();
    await settle();
    from({ type: 'ready', dots: null, depotLand: [], snapshot: null, load: 'ok' } as unknown as FromWorker);
  };

  // A delete in Saves is the natural answer to "This browser isn’t keeping saves", but its job only removes a key, which a
  // full disk never refuses: Saves' line stays until the save refused, owed by the sim since, is kept. Shown failing (TS-04) on
  // 5f4bce3, where any job kept took it down, a delete's too, though nothing was saved and a reload lost the game since.
  it('says the browser keeps saves again only once the save it refused is kept, never for a delete, and tells the sim its key', async () => {
    await opened();
    page.kept.set(SLOT, 'x'.repeat(500));
    page.kept.set(LIVE, 'x'.repeat(100));
    page.room = page.used(); // full
    own(LIVE, 150);
    await settle();
    expect(sim()).toMatchObject({ storeRefused: 'full', autosaveRefused: true });
    from({ type: 'store', effects: [{ op: 'remove', key: SLOT }] });
    await settle();
    expect(page.kept.has(SLOT)).toBe(false);
    expect(sim()).toMatchObject({ storeRefused: 'full', autosaveRefused: true });
    expect(refusals()).toEqual([{ type: 'store-refused', keys: [LIVE] }]);
    own(LIVE, 150);
    await settle();
    expect(sim()).toMatchObject({ storeRefused: null, autosaveRefused: false });
  });

  // At a quarter's close the quarter's start, which needs a quarter's growth of room over the last one, may be refused, and
  // the autosave a moment later, which needs an hour's, kept: Saves still says so, as the quarter's start is not kept. Shown
  // failing (TS-04) on 5f4bce3, where the autosave kept took Saves' line down at once, the quarter's start unwritten.
  it('keeps saying the browser keeps no saves while the quarter’s start it refused is not kept, though the autosave is', async () => {
    await opened();
    page.kept.set(QUARTER, 'x'.repeat(100)); // the last quarter's start
    page.kept.set(LIVE, 'x'.repeat(800)); // the autosave of an hour ago
    page.kept.set(SLOT, 'x'.repeat(1_000));
    page.room = page.used() + 100;
    own(QUARTER, 820);
    own(LIVE, 820);
    await settle();
    expect(page.kept.get(LIVE)).toHaveLength(820);
    // The game is saving itself, so the Saves chip says "Saves"; Saves' line says the quarter's start is not kept.
    expect(sim()).toMatchObject({ storeRefused: 'full', autosaveRefused: false });
    expect(refusals()).toEqual([{ type: 'store-refused', keys: [QUARTER] }]);
    // A delete makes room, and the quarter's start the sim owes is kept.
    from({ type: 'store', effects: [{ op: 'remove', key: SLOT }] });
    own(QUARTER, 820);
    await settle();
    expect(sim().storeRefused).toBeNull();
  });

  // A Save here kept, into a slot it shrinks, keeps nothing the browser refused: while the autosave is owed, Saves still says
  // so. Shown failing (TS-04) on 5f4bce3, where the slot's save kept took Saves' line down while the autosave was owed.
  it('keeps saying so while the autosave it refused is owed, though a slot’s save is kept', async () => {
    await opened();
    page.kept.set(SLOT, 'x'.repeat(500));
    page.kept.set(LIVE, 'x'.repeat(100));
    page.room = page.used(); // full
    own(LIVE, 150);
    saveHere(1, 300);
    await settle();
    expect(page.kept.get(SLOT)).toHaveLength(300);
    expect(sim().storeRefused).toBe('full');
    own(LIVE, 150);
    await settle();
    expect(sim().storeRefused).toBeNull();
  });

  // Only the game's own saves hold Saves' line until each is kept. A Save here refused owes the sim nothing, and is said on its
  // slot's row, where it was pressed, until that slot is saved, a delete in Saves is kept (it made room, so the row's advice
  // is followed) or another game loads: not by the page's one notice, which may be spent already, nor by Saves' line, which
  // the next autosave kept takes down (every 0.67 s at 5,400×). Shown failing (TS-04) on 029387a, where it raised the notice
  // once a page and held the line only until a write was kept, so a second Save here refused said nothing at all (the systems
  // audit's third round). This test pinned that before.
  it('says a refused Save here on its slot’s row until the slot is saved, a delete makes room, or another game loads', async () => {
    await opened();
    page.kept.set('interbus.slot.boston.2', 'x'.repeat(500));
    page.kept.set(LIVE, 'x'.repeat(100));
    page.room = page.used(); // full
    saveHere(1, 300); // Save here into Slot 1, Empty: refused
    await settle();
    expect(sim()).toMatchObject({ storeRefused: null, storeNotice: null, slotsRefused: new Map([[1, 'full']]) });
    own(LIVE, 100); // the autosave, no larger than the last: kept
    saveHere(1, 300); // pressed again: refused again
    await settle();
    expect(page.kept.has(SLOT)).toBe(false);
    expect(page.kept.get(LIVE)).toHaveLength(100);
    expect(sim()).toMatchObject({ storeRefused: null, storeNotice: null, slotsRefused: new Map([[1, 'full']]) });
    expect(refusals()).toEqual([]);
    // Slot 2 deleted makes room: Slot 1's row no longer tells the player to make some, and its Save here is kept.
    deleteSlot(2);
    await settle();
    expect(sim().slotsRefused).toEqual(new Map());
    saveHere(1, 300);
    await settle();
    expect(page.kept.get(SLOT)).toHaveLength(300);
    expect(sim().slotsRefused).toEqual(new Map());
    // Refused into a full slot, the slot keeps its save and says so until it is saved; another slot saved leaves it so.
    page.room = page.used();
    saveHere(1, 400);
    saveHere(2, 400);
    await settle();
    expect(page.kept.get(SLOT)).toHaveLength(300);
    expect(sim().slotsRefused).toEqual(new Map([[1, 'full'], [2, 'full']]));
    page.room += 500; // room for Slot 2's save, key and all
    saveHere(2, 400);
    await settle();
    expect(sim().slotsRefused).toEqual(new Map([[1, 'full']]));
    // A delete kept takes every row's words down; another game loading too: each row's words were for the game that played.
    deleteSlot(2);
    await settle();
    expect(sim().slotsRefused).toEqual(new Map());
    page.room = page.used();
    saveHere(2, 400);
    await settle();
    expect(sim().slotsRefused).toEqual(new Map([[2, 'full']]));
    from({ type: 'loaded', from: 'file', load: 'ok' });
    expect(sim().slotsRefused).toEqual(new Map());
  });

  // A store with no room is said as such, with the way out (delete a save), and storage that keeps nothing as before. Shown
  // failing (TS-04) on 029387a, where both read "This browser isn’t keeping saves" (storeRefused true): the browser did keep
  // saves, but the game's own copies filled the origin's 5.24M characters (the systems audit's third round).
  it('tells a full store from one that keeps nothing, for the notice and for Saves’ line', async () => {
    await opened();
    page.kept.set(LIVE, 'x'.repeat(100));
    page.room = page.used(); // full
    own(LIVE, 150);
    await settle();
    expect(sim()).toMatchObject({ storeRefused: 'full', storeNotice: 'full' });
    // Blocked site data: a read is refused too. Saves' line says so, the worse of the two; the notice keeps its first words.
    page.blocked = true;
    from({ type: 'read-save', key: LIVE });
    await settle();
    expect(sim()).toMatchObject({ storeRefused: 'blocked', storeNotice: 'full' });
    page.reset();
    await opened();
    page.blocked = true;
    own(LIVE, 100);
    await settle();
    expect(sim()).toMatchObject({ storeRefused: 'blocked', storeNotice: 'blocked' });
  });
});

describe('the undos', () => {
  // Every undo the page sends has one answer, in the order sent: 'undone' when it took a command back, or
  // its refusal (time has run, nothing to undo). `done` is the place of the newest the sim did among those
  // sent, so a Create or a Save route on its way lets go only on an undo sent after its press that the sim
  // did. Shown failing (TS-04) on 5f4bce3, which counted the undos sent alone: `undos` read 3.
  it('counts the undos sent, and the newest the sim did by its place among them', async () => {
    sim();
    await settle();
    for (let k = 0; k < 3; k++) sim().send({ type: 'undo' });
    from({ type: 'refused', command: 'undo', reason: 'time_has_run' });
    from({ type: 'undone' });
    from({ type: 'refused', command: 'undo', reason: 'nothing_to_undo' });
    expect(sim().undos).toEqual({ sent: 3, done: 2 });
    sim().send({ type: 'undo' });
    expect(sim().undos).toEqual({ sent: 4, done: 2 }); // on its way
    from({ type: 'undone' });
    expect(sim().undos).toEqual({ sent: 4, done: 4 });
  });
});
