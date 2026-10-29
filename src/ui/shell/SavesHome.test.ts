// Back to Home in a tab another tab's saves have left behind (the systems audit's sixth round): Home goes on with the browser's
// game, the other tab's, so where this game has moved on since (useSim's `movedOn`) Back to Home asks first, as Load and Import a
// save file do, naming what is lost and the way to keep it, with "Replace this game / Keep playing" in place of its row's
// buttons; with nothing lost it goes straight to Home, as before. There is no DOM here, so React's hooks are stood in for by
// state kept between renders (no effect runs) and a press calls its button's onClick. Shown failing (TS-04) on c3c2d9a, whose
// Back to Home went to Home at once, asking nothing.
import type { ReactElement, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Snapshot } from '../../sim/types';
import { BACK_HOME_ASK_COPY } from '../copy';
import type { Sim } from '../game/useSim';
import { Saves } from './Saves';

const hooks = vi.hoisted(() => ({ cells: [] as unknown[], at: 0 }));

vi.mock('react', async (original) => ({
  ...(await original<object>()),
  useState: (initial: unknown) => {
    const k = hooks.at++;
    if (!(k in hooks.cells)) hooks.cells[k] = initial;
    return [hooks.cells[k], (next: unknown) => void (hooks.cells[k] = typeof next === 'function' ? (next as (v: unknown) => unknown)(hooks.cells[k]) : next)];
  },
  useRef: (initial: unknown) => {
    const k = hooks.at++;
    if (!(k in hooks.cells)) hooks.cells[k] = { current: initial };
    return hooks.cells[k];
  },
  useEffect: () => undefined,
  useLayoutEffect: () => undefined,
  // The one context Saves reads, whether the keyboard moved the focus (heldFocus), is read only from effects, which never run here.
  useContext: () => () => true,
}));

type El = ReactElement<{ children?: ReactNode; onClick?: (event: unknown) => void; 'data-testid'?: string }>;
/** Every element in the tree Saves returned, its own components' insides left out. */
const elements = (node: ReactNode): El[] => (Array.isArray(node) ? node.flatMap(elements) : node && typeof node === 'object' && 'props' in node ? [node as El, ...elements((node as El).props.children)] : []);
const text = (node: ReactNode): string => (Array.isArray(node) ? node.map(text).join('') : typeof node === 'string' || typeof node === 'number' ? String(node) : node && typeof node === 'object' && 'props' in node ? text((node as El).props.children) : '');

describe('Back to Home in a tab left behind', () => {
  beforeEach(() => void (hooks.cells.length = 0));

  let homes = 0;
  /** Saves as it renders now, for a game with Back Bay Transit founded and nothing in the slots. */
  const saves = (more: Partial<Sim>): El => {
    hooks.at = 0;
    const sim = { snapshot: { company: { name: 'Back Bay Transit' } } as unknown as Snapshot, slots: [], setAside: [], slotsRefused: new Map(), send: () => undefined, newer: false, movedOn: false, ...more } as unknown as Sim;
    return Saves({ sim, onClose: () => undefined, onHome: () => void homes++ }) as El;
  };
  const buttons = (tree: El) => elements(tree).flatMap((e) => (e.type === 'button' ? [text(e.props.children)] : []));
  /** A press of the mouse (a click's detail 1) on the button named `name`. */
  const press = (tree: El, name: string) => elements(tree).find((e) => e.type === 'button' && text(e.props.children) === name)!.props.onClick!({ detail: 1 });

  it('asks first where Home would drop this game’s play since another tab changed the autosave, and goes straight there where it would drop none', () => {
    homes = 0;
    const behind = { newer: true, movedOn: true, autosave: { day: 3, hour: 9, minute: 0, company: 'Back Bay Transit', cashCents: 47_605_600, lines: 1, buses: 3 } } as Partial<Sim>;
    press(saves(behind), 'Back to Home');
    expect(homes).toBe(0);
    let tree = saves(behind);
    expect(text(elements(tree).find((e) => e.props['data-testid'] === 'saves-home-ask')?.props.children)).toBe(BACK_HOME_ASK_COPY);
    expect(buttons(tree).slice(-4)).toEqual(['Export this game', 'Import a save file', 'Replace this game', 'Keep playing']);
    // Keep playing keeps the game, and Back to Home comes back.
    press(tree, 'Keep playing');
    tree = saves(behind);
    expect(homes).toBe(0);
    expect(buttons(tree).slice(-2)).toEqual(['Export session', 'Back to Home']);
    // One question at a time: Import's closes it.
    press(tree, 'Back to Home');
    press(saves(behind), 'Import a save file');
    expect(buttons(saves(behind)).slice(-4)).toEqual(['Replace this game', 'Keep playing', 'Export session', 'Back to Home']);
    // Answered yes, Home, which goes on with the browser's game.
    press(saves(behind), 'Keep playing');
    press(saves(behind), 'Back to Home');
    press(saves(behind), 'Replace this game');
    expect(homes).toBe(1);
    // Nothing played since the change, or no change at all: nothing to lose, so no question. Nor with no company founded yet, as
    // Load and Import ask nothing then, nor with an autosave this build can't play (another build's, or removed), which Home
    // leaves where it is, going on with this game: shown failing (TS-04) on the lane's first cut (the review of the sixth round).
    const unfounded = { ...behind, snapshot: { company: { name: '' } } as unknown as Snapshot };
    for (const nothingLost of [{ newer: true, movedOn: false }, {}, unfounded, { ...behind, autosave: null }]) {
      hooks.cells.length = 0;
      press(saves(nothingLost), 'Back to Home');
      expect(buttons(saves(nothingLost))).not.toContain('Replace this game');
    }
    expect(homes).toBe(5);
  });
});
