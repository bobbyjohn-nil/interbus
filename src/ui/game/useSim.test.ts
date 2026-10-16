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
import type { FromWorker, Snapshot } from '../../sim/types';
import { useSim } from './useSim';

const page = vi.hoisted(() => {
  const cells: unknown[] = [];
  let at = 0;
  let mounted = false;
  const posted: unknown[] = [];
  const worker = { onmessage: null as ((event: { data: unknown }) => void) | null, onerror: null, postMessage: (m: unknown) => void posted.push(m), terminate: () => undefined };
  const kept = new Map<string, string>();
  /** The window's 'storage' listeners (src/platform's onOtherTabWrite), by key. */
  const heard = new Map<string, (text: string | null) => void>();
  return {
    cells,
    worker,
    kept,
    heard,
    posted,
    /** Another tab of the game writes `text` under `key` (removes it with null), and this page hears it as the browser tells it. */
    otherTab(key: string, text: string | null) {
      if (text === null) kept.delete(key);
      else kept.set(key, text);
      heard.get(key)?.(text);
    },
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
      heard.clear();
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
  onOtherTabWrite: (key: string, then: (text: string | null) => void) => {
    page.heard.set(key, then);
    return () => page.heard.delete(key);
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

// Two tabs of the game on one browser (the systems audit's fifth round; D12 keeps an old tab open across a deploy): the page
// keeps the live key's text as it last read or wrote it, and writes none of the game's own saves while the key holds another
// tab's save since, whether the browser said so ('storage') or a read before the write finds it; Home takes that save up as
// the game. Shown failing (TS-04) on 050dbdd, which wrote whatever this page's game was over the other tab's newer save.
describe('another tab’s save', () => {
  beforeEach(() => page.reset());

  const LIVE = 'interbus.save.boston';
  const QUARTER = 'interbus.quarter.boston';
  const takes = () => page.posted.filter((m) => (m as { type: string }).type === 'take-save');
  /** A page opened on `text` under the live key, read and ready. */
  const opened = async (text: string) => {
    page.kept.set(LIVE, text);
    sim();
    await settle();
    from({ type: 'read-save', key: LIVE });
    await settle();
    from({ type: 'ready', dots: null, depotLand: [], snapshot: null, load: 'ok' } as unknown as FromWorker);
  };
  const own = (key: string, value: string) => from({ type: 'store', effects: [{ op: 'write', key, value }], owed: key === QUARTER ? 'quarter' : 'autosave' });

  it('writes none of the game’s own saves over a save another tab made since, heard or found, and says so, owing nothing', async () => {
    await opened('A0');
    own(LIVE, 'B1'); // this page's own save over what it read: kept
    await settle();
    expect(page.kept.get(LIVE)).toBe('B1');
    page.otherTab(LIVE, 'A1'); // the other tab plays on and saves
    own(LIVE, 'B2');
    own(QUARTER, 'B2 quarter');
    await settle();
    expect(page.kept.get(LIVE)).toBe('A1');
    expect(page.kept.has(QUARTER)).toBe(false);
    // Said, but not as a refusal: no room is owed, and the store's line and notice stay as they were.
    expect(sim()).toMatchObject({ newer: true, storeRefused: null, storeNotice: null, autosaveRefused: false });
    expect(page.posted.filter((m) => (m as { type: string }).type === 'store-refused')).toEqual([]);

    // A save the browser did not tell this page of is found by the read before the write.
    page.reset();
    await opened('A0');
    page.kept.set(LIVE, 'A1');
    own(LIVE, 'B1');
    await settle();
    expect(page.kept.get(LIVE)).toBe('A1');
    expect(sim().newer).toBe(true);
  });

  it('says so as soon as the browser tells of another tab’s save, before any write', async () => {
    await opened('A0');
    expect(sim().newer).toBe(false);
    page.otherTab(LIVE, 'A1');
    expect(sim().newer).toBe(true);
  });

  it('takes the other tab’s save up as the game while Home stands, and saves over it again from there', async () => {
    await opened('A0');
    page.otherTab(LIVE, 'A1');
    expect(takes()).toEqual([]); // in the game: said, not taken
    sim().followNewest?.(true); // Home
    await settle();
    expect(takes()).toEqual([{ type: 'take-save', text: 'A1' }]);
    from({ type: 'took-save', ok: true });
    expect(sim().newer).toBe(false);
    // Each save the other tab makes while Home stands is taken up, one take at a time, each reading the newest.
    page.otherTab(LIVE, 'A2');
    page.otherTab(LIVE, 'A3');
    await settle();
    expect(takes()).toEqual([{ type: 'take-save', text: 'A1' }, { type: 'take-save', text: 'A3' }]);
    page.otherTab(LIVE, 'A4'); // while that take is on its way: the next goes once it is answered
    from({ type: 'took-save', ok: true });
    await settle();
    expect(takes().at(-1)).toEqual({ type: 'take-save', text: 'A4' });
    from({ type: 'took-save', ok: true });
    await settle();
    expect(takes()).toHaveLength(3);
    expect(sim().newer).toBe(false);
    sim().followNewest(false); // Continue
    own(LIVE, 'B4');
    await settle();
    expect(page.kept.get(LIVE)).toBe('B4');
    expect(sim().newer).toBe(false);
    // A save this build can't play is left where it is: the game is as it was, and still writes nothing over it.
    page.otherTab(LIVE, 'C1');
    sim().followNewest(true);
    await settle();
    from({ type: 'took-save', ok: false });
    expect(sim().newer).toBe(true);
    own(LIVE, 'B5');
    await settle();
    expect(page.kept.get(LIVE)).toBe('C1');
  });

  it('takes the other tab’s save up when Home opens over a game it was found newer than', async () => {
    await opened('A0');
    page.kept.set(LIVE, 'A1');
    own(LIVE, 'B1');
    await settle();
    sim().followNewest?.(true);
    await settle();
    expect(takes()).toEqual([{ type: 'take-save', text: 'A1' }]);
  });

  // Home reads the key as it opens: a page the browser told nothing (one back from its cache) still names the browser's game.
  // Shown failing (TS-04) on the first cut of this fix, which took only a save it had heard of or found before a write.
  it('takes up a save the browser told this page nothing of, as Home opens', async () => {
    await opened('A0');
    page.kept.set(LIVE, 'A1'); // no 'storage' event, and no write since
    sim().followNewest(true);
    await settle();
    expect(takes()).toEqual([{ type: 'take-save', text: 'A1' }]);
    from({ type: 'took-save', ok: true });
    sim().followNewest(false);
    sim().followNewest(true); // Home again, nothing changed: nothing to take
    await settle();
    expect(takes()).toHaveLength(1);
  });

  // A take on its way as the player presses Continue is the last: one more saved meanwhile by the other tab is said in the
  // game, never taken up there. Shown failing (TS-04) on the first cut of this fix, whose next take went after Continue and
  // replaced the game in play (the review of the fifth round).
  it('takes nothing more once Home is gone, though the other tab saved again during the last take', async () => {
    await opened('A0');
    sim().followNewest(true);
    page.otherTab(LIVE, 'A1');
    await settle();
    expect(takes()).toEqual([{ type: 'take-save', text: 'A1' }]);
    page.otherTab(LIVE, 'A2'); // while that take is on its way
    sim().followNewest(false); // Continue
    from({ type: 'took-save', ok: true });
    await settle();
    expect(takes()).toHaveLength(1);
    expect(sim().newer).toBe(true); // said instead: the browser's game is A2
    // And a take read before Continue but not yet sent stays unsent.
    sim().followNewest(true);
    sim().followNewest(false);
    await settle();
    expect(takes()).toHaveLength(1);
  });

  // A Load, a New game or Restart this quarter asked for from Home brings its own game: a take posted after it replaced that
  // game with the other tab's (7 Loads in 25 with a tab saving every 0.67 s). None goes until the ask is refused or Home goes,
  // which it does once that game comes. Shown failing (TS-04) on 8d3d85f, which took up A1 over each (the review of #133).
  it('takes up no other tab’s save while a game Home asked for is on its way, and follows again once it is refused', async () => {
    for (const ask of [{ type: 'load-slot', slot: 1 }, { type: 'new-game' }, { type: 'restart-quarter' }] as const) {
      page.reset();
      await opened('A0');
      sim().followNewest(true);
      await settle();
      sim().send(ask);
      page.otherTab(LIVE, 'A1');
      await settle();
      expect(takes(), ask.type).toEqual([]);
      // The game came; Home goes as it shows, a moment after: still none.
      from({ type: 'loaded', from: ask.type === 'load-slot' ? 'slot' : ask.type === 'new-game' ? 'new' : 'quarter', load: 'ok' } as unknown as FromWorker);
      page.otherTab(LIVE, 'A2');
      await settle();
      expect(takes(), ask.type).toEqual([]);
      sim().followNewest(false);
    }
    page.reset();
    await opened('A0');
    sim().followNewest(true);
    await settle();
    sim().send({ type: 'load-slot', slot: 2 });
    page.otherTab(LIVE, 'A1');
    await settle();
    expect(takes()).toEqual([]);
    from({ type: 'refused', command: 'load-slot', reason: 'empty_slot' } as unknown as FromWorker);
    await settle();
    expect(takes()).toEqual([{ type: 'take-save', text: 'A1' }]);
  });

  // While Home stands, another tab's save is said only if Home cannot take it up: said at once, Saves' line and the GPU
  // cards' words came and went at each of the other tab's saves, every 0.67 s, and the slots' rows jumped 44 px under the
  // pointer. Shown failing (TS-04) on 8d3d85f, where `newer` turned true at once (the review of #133).
  it('says nothing of another tab’s save while Home takes it up, and says it if the take fails', async () => {
    await opened('A0');
    sim().followNewest(true);
    await settle();
    page.otherTab(LIVE, 'A1');
    expect(sim().newer).toBe(false);
    await settle();
    expect(takes()).toEqual([{ type: 'take-save', text: 'A1' }]);
    expect(sim().newer).toBe(false);
    from({ type: 'took-save', ok: true });
    expect(sim().newer).toBe(false);
    page.otherTab(LIVE, 'C1');
    await settle();
    from({ type: 'took-save', ok: false });
    expect(sim().newer).toBe(true);
  });

  // What Back to Home in a tab left behind would lose (the systems audit's sixth round): the game has moved on since the page
  // found the other tab's change if its clock has run since, or the page has held back a save of the game's own since (the sim
  // saves after every command it takes, at a pause and each game hour), found by the 'storage' event or by that save's own
  // read. With neither, or once Home has taken the browser's game up, nothing is lost, and Back to Home asks nothing. Shown
  // failing (TS-04) on c3c2d9a, which had no such word: `movedOn` read undefined.
  // The ways Saves names to keep this game, a Save here and Export this game, keep it as it stands, so Back to Home asks only of
  // play since. Shown failing (TS-04) on the lane's first cut, which still said the kept play would be lost (the review of the
  // sixth round).
  it('times what Back to Home would lose from the last Save here kept or Export this game', async () => {
    const clock = (elapsed: number) => from({ type: 'snapshot', snapshot: { elapsed } as unknown as Snapshot });
    await opened('A0');
    clock(7_200);
    page.otherTab(LIVE, 'A1');
    clock(7_260);
    expect(sim().movedOn).toBe(true);
    from({ type: 'store', effects: [{ op: 'write', key: 'interbus.slot.boston.1', value: 'B1' }], slot: 1 });
    await settle();
    expect(sim().movedOn).toBe(false);
    clock(7_320);
    expect(sim().movedOn).toBe(true);
    sim().send({ type: 'export' });
    expect(sim().movedOn).toBe(false);
    clock(7_320);
    expect(sim().movedOn).toBe(false);
    clock(7_380);
    expect(sim().movedOn).toBe(true);
  });

  it('knows whether the game has moved on since another tab changed the autosave: its clock run, or a save of its own held back', async () => {
    const clock = (elapsed: number) => from({ type: 'snapshot', snapshot: { elapsed } as unknown as Snapshot });
    await opened('A0');
    clock(7_200);
    page.otherTab(LIVE, 'A1');
    expect(sim()).toMatchObject({ newer: true, movedOn: false });
    clock(7_200); // a snapshot of the game as it stood, and a Save here: neither moves it on
    from({ type: 'store', effects: [{ op: 'write', key: 'interbus.slot.boston.1', value: 'B0' }], slot: 1 });
    await settle();
    expect(sim().movedOn).toBe(false);
    clock(7_260); // played on a minute
    expect(sim()).toMatchObject({ newer: true, movedOn: true });
    // Home takes the browser's game up: nothing of this one is left to lose.
    sim().followNewest(true);
    await settle();
    from({ type: 'took-save', ok: true });
    clock(9_000);
    expect(sim()).toMatchObject({ newer: false, movedOn: false });
    sim().followNewest(false); // Continue
    // Left behind again, paused: a fare changed, which the sim saves, held back. The clock stands still.
    page.otherTab(LIVE, 'A2');
    expect(sim()).toMatchObject({ newer: true, movedOn: false });
    own(LIVE, 'B1');
    await settle();
    expect(page.kept.get(LIVE)).toBe('A2');
    expect(sim()).toMatchObject({ newer: true, movedOn: true });
    // A change the browser told this page nothing of is found by the read before that save, which is held back as play kept nowhere.
    page.reset();
    await opened('A0');
    clock(7_200);
    page.kept.set(LIVE, 'A1');
    expect(sim().movedOn).toBe(false);
    own(LIVE, 'B1');
    await settle();
    expect(sim()).toMatchObject({ newer: true, movedOn: true });
    // Another save during a take from Home is timed by the taken game's clock, not the replaced game's.
    page.reset();
    await opened('A0');
    clock(7_200);
    sim().followNewest(true);
    page.otherTab(LIVE, 'A1');
    await settle();
    page.otherTab(LIVE, 'A2'); // while that take is on its way
    from({ type: 'took-save', ok: true });
    clock(90_000); // the taken game
    expect(sim().movedOn).toBe(false);
    sim().followNewest(false); // Continue, the take of A2 unsent
    await settle();
    expect(sim()).toMatchObject({ newer: true, movedOn: false });
    clock(90_060);
    expect(sim().movedOn).toBe(true);
  });

  // Saves lists again when the browser's autosave changes, so its row names the game Continue names; and a take, as a load,
  // drops the replaced game's refused Save here.
  it('has Saves list again at another tab’s change, and drops a refused Save here with the game a take replaces', async () => {
    await opened('A0');
    const before = sim().stored;
    page.otherTab(LIVE, 'A1');
    expect(sim().stored).toBe(before + 1);
    page.room = page.used();
    from({ type: 'store', effects: [{ op: 'write', key: 'interbus.slot.boston.1', value: 'x'.repeat(50) }], slot: 1 });
    await settle();
    expect(sim().slotsRefused).toEqual(new Map([[1, 'full']]));
    sim().followNewest(true);
    await settle();
    from({ type: 'took-save', ok: true });
    expect(sim().slotsRefused).toEqual(new Map());
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
