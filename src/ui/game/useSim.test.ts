// The page's side of the store (useSim): when the store refuses the backup of a save the start sets
// aside, the sim says so ('unbacked'), so the page never also says this browser keeps no saves: one
// failure, one notice. Another refused write still says it. There is no DOM here, so React's hooks are
// stood in for by a small runtime (state kept between renders, the one effect run once) and the
// platform by a worker and a store that refuses a backup too large for it.
import { describe, expect, it, vi } from 'vitest';
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
  // A full disk: a backup is refused, as a large one is (QuotaExceededError); smaller writes are kept.
  createWebSaveStore: () => ({
    read: async (key: string) => page.kept.get(key) ?? null,
    write: async (key: string, value: string) => {
      if (key.startsWith('interbus.backup.')) throw new Error('QuotaExceededError');
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
    expect(sim()).toMatchObject({ storeRefused: false, stored: 0, backup: 'checking' });
    expect(page.kept.get('interbus.save.boston')).toBe(older); // the remove after the refused backup never ran
    from({ type: 'unbacked', why: 'older-1' });
    expect(sim()).toMatchObject({ storeRefused: false, unbacked: 'older-1', backup: 'not-kept' });
    // A write the sim asks for later is the page's to report, as before.
    from({ type: 'store', effects: [{ op: 'write', key: 'interbus.backup.boston.newer', value: '{}' }] });
    await settle();
    expect(sim().storeRefused).toBe(true);
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
