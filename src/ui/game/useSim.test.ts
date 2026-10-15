// The page's side of the store (useSim): when the store refuses the backup of a save the start sets
// aside, the sim says so ('unbacked'), so the page never also says this browser keeps no saves: one
// failure, one notice. Another refused write still says it, once; a refused save of the game's own also
// holds Saves' line, and the page tells the sim its key, until it is kept. There is no DOM here, so
// React's hooks are stood in for by a small runtime (state kept between renders, the one effect run once
// per page) and the platform by a worker and a store that refuses a backup too large for it, and any
// write beyond its room.
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
    /** The characters kept now, but for `but`'s. */
    used: (but?: string) => [...kept].reduce((n, [k, v]) => n + (k === but ? 0 : k.length + v.length), 0),
    /** A page opened afresh: no hooks' state, nothing posted, nothing kept, room for anything. */
    reset() {
      cells.length = 0;
      mounted = false;
      posted.length = 0;
      kept.clear();
      this.room = Infinity;
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
  build: { sha: 'test', version: '0.0.0' },
  // A full disk: a backup is refused, as a large one is (QuotaExceededError), and so is a write beyond the room; smaller writes are kept.
  createWebSaveStore: () => ({
    read: async (key: string) => page.kept.get(key) ?? null,
    write: async (key: string, value: string) => {
      if (key.startsWith('interbus.backup.') || page.used(key) + key.length + value.length > page.room) throw new Error('QuotaExceededError');
      page.kept.set(key, value);
    },
    remove: async (key: string) => void page.kept.delete(key),
  }),
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
    expect(sim()).toMatchObject({ storeRefused: false, storeRefusals: 0, stored: 0, backup: 'checking' });
    expect(page.kept.get('interbus.save.boston')).toBe(older); // the remove after the refused backup never ran
    from({ type: 'unbacked', why: 'older-1' });
    expect(sim()).toMatchObject({ storeRefused: false, storeRefusals: 0, unbacked: 'older-1', backup: 'not-kept' });
    // A write the sim asks for later is the page's to report, as before: the notice says so.
    from({ type: 'store', effects: [{ op: 'write', key: 'interbus.backup.boston.newer', value: '{}' }] });
    await settle();
    expect(sim().storeRefusals).toBe(1);
  });

  const LIVE = 'interbus.save.boston';
  const QUARTER = 'interbus.quarter.boston';
  const SLOT = 'interbus.slot.boston.1';
  /** A write the sim asks for: a Save here's, or with `owed` one of the game's own saves (the autosave, the quarter's start). */
  const write = (key: string, size: number, owed = false) => from({ type: 'store', effects: [{ op: 'write', key, value: 'x'.repeat(size) }], ...(owed ? { owed } : {}) });
  const own = (key: string, size: number) => write(key, size, true);
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
    expect(sim().storeRefused).toBe(true);
    from({ type: 'store', effects: [{ op: 'remove', key: SLOT }] });
    await settle();
    expect(page.kept.has(SLOT)).toBe(false);
    expect(sim().storeRefused).toBe(true);
    expect(refusals()).toEqual([{ type: 'store-refused', keys: [LIVE] }]);
    own(LIVE, 150);
    await settle();
    expect(sim().storeRefused).toBe(false);
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
    expect(sim().storeRefused).toBe(true);
    expect(refusals()).toEqual([{ type: 'store-refused', keys: [QUARTER] }]);
    // A delete makes room, and the quarter's start the sim owes is kept.
    from({ type: 'store', effects: [{ op: 'remove', key: SLOT }] });
    own(QUARTER, 820);
    await settle();
    expect(sim().storeRefused).toBe(false);
  });

  // A Save here kept, into a slot it shrinks, keeps nothing the browser refused: while the autosave is owed, Saves still says
  // so. Shown failing (TS-04) on 5f4bce3, where the slot's save kept took Saves' line down while the autosave was owed.
  it('keeps saying so while the autosave it refused is owed, though a slot’s save is kept', async () => {
    await opened();
    page.kept.set(SLOT, 'x'.repeat(500));
    page.kept.set(LIVE, 'x'.repeat(100));
    page.room = page.used(); // full
    own(LIVE, 150);
    write(SLOT, 300);
    await settle();
    expect(page.kept.get(SLOT)).toHaveLength(300);
    expect(sim().storeRefused).toBe(true);
    own(LIVE, 150);
    await settle();
    expect(sim().storeRefused).toBe(false);
  });

  // Only the game's own saves hold Saves' line until each is kept. A Save here refused owes the sim nothing: it raises the notice
  // once, as any refused save does, and holds the line only until a write is kept, as every refusal did before, so it goes with
  // the autosave kept. Shown failing (TS-04) with a slot's refused key held as the game's own are (every refused write's key
  // kept until written or removed), where the line stayed after the autosave was kept, for as long as the page did; and with a
  // slot's refusal holding nothing, where a Save here refused while paused left Saves without a word (the notice already said).
  it('says once that a slot’s Save here was refused, and holds Saves’ line for it only until a write is kept', async () => {
    await opened();
    page.kept.set('interbus.slot.boston.2', 'x'.repeat(500));
    page.kept.set(LIVE, 'x'.repeat(100));
    page.room = page.used(); // full
    write(SLOT, 300); // Save here into Slot 1, Empty: refused
    await settle();
    expect(sim().storeRefused).toBe(true);
    own(LIVE, 100); // the autosave, no larger than the last: kept
    await settle();
    expect(page.kept.has(SLOT)).toBe(false);
    expect(page.kept.get(LIVE)).toHaveLength(100);
    expect(sim().storeRefused).toBe(false);
    expect(sim().storeRefusals).toBe(1);
    expect(refusals()).toEqual([]);
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
