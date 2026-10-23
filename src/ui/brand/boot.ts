// The end of the page's boot splash (index.html; S18, V1's `Intralines@7af45b1:src/ui/BusWipe.tsx`). The game calls it once it
// has a screen to show (App.tsx): the splash's bus tows the splash away the first time in a tab that a game starts in (GD-08),
// and later in the tab, for anyone who asked for less motion, in a tab no one is looking at, or for a game that could not
// start, it goes at once, as a wipe then would only be in the way, or unseen.
import { firstInTab } from '../../platform';

/** The wipe's length (app.css, boot-away and boot-engine). */
export const WIPE_MS = 2400;

/** What ending the splash reads and does, the page's own by default, so a test can hand it its own. */
export interface BootEnv {
  /** The splash, or null once it has gone, or on a page with none. */
  readonly boot: Pick<Element, 'classList' | 'remove' | 'setAttribute'> | null;
  /** Whether no one should see it move: the player asked for less motion, or the tab is in the background. */
  readonly still: boolean;
  /** Whether this is the first time in the tab, which counts it (the platform's firstInTab). */
  readonly firstInTab: () => boolean;
  /** Runs `run` in `ms`, by a timer, so a tab put in the background, where animations wait, ends it too. */
  readonly later: (run: () => void, ms: number) => void;
}

/**
 * Keeps the keyboard from what the splash hides for as long as it stands, from the page's first script (main.tsx):
 * - While the game loaded under it, T tilted the map, the arrows moved it, Tab reached its canvas and ? opened Help, all unseen
 *   (the systems audit's twelfth round); as its bus towed it away, Tab reached Home's buttons under it and Enter pressed New game
 *   unseen (the eleventh), where a press of the pointer on it presses nothing (app.css). Such a key is held: its default and its
 *   way on both stopped. With nothing focused the key is the page's, and the page stands under the splash.
 * - A key on a control the splash leaves in sight is that control's alone: typed into a field, Enter on a button, Tab on from it.
 *   The page's own keys wait (? on the corner opened Help under the splash: the twelfth round). In sight are the corner and the
 *   replaced build's card, drawn over the splash, and what its tow has uncovered, wholly or in part, which takes the pointer's
 *   presses at once (app.css): held instead, the name typed into the founding card that a press on the uncovered New game opened
 *   was lost, for the 0.65 s to the splash's going (the twelfth round).
 * - The browser's own keys pass (with Ctrl, ⌘ or Alt, and F1 to F12), and every key once the tow has taken the splash off the
 *   screen, or once it is gone at once with less motion asked for mid-tow (app.css); gone, the hold goes at the next key.
 */
export function holdKeys(win: Window = window): void {
  const held = (event: KeyboardEvent) => {
    const boot = win.document.getElementById('boot');
    if (!boot) return win.removeEventListener('keydown', held, true);
    if (win.getComputedStyle(boot).display === 'none') return;
    if (event.ctrlKey || event.metaKey || event.altKey || /^F\d+$/.test(event.key)) return;
    const splash = boot.getBoundingClientRect();
    if (splash.left >= win.innerWidth) return;
    if (!inSight(event.target, splash, win)) event.preventDefault();
    event.stopImmediatePropagation();
  };
  win.addEventListener('keydown', held, true);
}

/** Whether `target` is a control the splash leaves in sight: drawn over it, or on the screen and not wholly under it. */
function inSight(target: EventTarget | null, splash: DOMRect, win: Window): boolean {
  const at = target as { tagName?: string; closest?: (selector: string) => unknown; getBoundingClientRect?: () => DOMRect } | null;
  if (typeof at?.closest !== 'function' || typeof at.getBoundingClientRect !== 'function' || at.tagName === 'BODY' || at.tagName === 'HTML') return false;
  if (at.closest('.corner, .replaced')) return true;
  const r = at.getBoundingClientRect();
  const [left, top, right, bottom] = [Math.max(r.left, 0), Math.max(r.top, 0), Math.min(r.right, win.innerWidth), Math.min(r.bottom, win.innerHeight)];
  if (right <= left || bottom <= top) return false;
  return left < splash.left || right > splash.right || top < splash.top || bottom > splash.bottom;
}

function pageBoot(): BootEnv {
  return {
    boot: document.getElementById('boot'),
    still: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true || document.visibilityState === 'hidden',
    firstInTab: () => firstInTab('boot-wipe'),
    later: (run, ms) => void window.setTimeout(run, ms),
  };
}

/**
 * Ends the splash: towed away by its bus, gone a little past the wipe, or gone at once. `tow` is whether a game starts: a game
 * that could not start (its card says so) or a page with no city takes the splash at once and leaves the tab's tow for the
 * Reload that works (the review of #161). Towed, it says nothing more to a screen reader or axe-core, as the game it waited for
 * stands under it: its words outside the page's landmarks were axe-core's "region" on a screen tested as the wipe ran
 * (e2e/many.spec.ts, #161's CI). Called again, it does nothing more.
 */
export function endBoot(tow: boolean, env: BootEnv = pageBoot()): void {
  const { boot } = env;
  if (!boot || boot.classList.contains('leaving')) return;
  if (!tow || env.still || !env.firstInTab()) {
    boot.remove();
    return;
  }
  boot.setAttribute('aria-hidden', 'true');
  boot.classList.add('leaving');
  env.later(() => boot.remove(), WIPE_MS + 150);
}
