// The end of the page's boot splash (index.html; S18, V1's `Intralines@7af45b1:src/ui/BusWipe.tsx`). The game calls it once it
// has a screen to show (App.tsx): the splash's bus tows the splash away the first time in a tab that a game starts in (GD-08),
// and later in the tab, for anyone who asked for less motion, in a tab no one is looking at, or for a game that could not
// start, it goes at once, as a wipe then would only be in the way, or unseen.
import { firstInTab } from '../../platform';
import { keyed } from '../onePress';

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

/** What else hears the keys the hold stops: App's focus source, which tells a focus the keyboard moved from the pointer's. */
const hearers = new Set<(event: KeyboardEvent) => void>();

/** Has `hear` hear every key the splash's hold stops, as the window's own listeners, which it stops, would have; returns what stops it. */
export function hearHeldKeys(hear: (event: KeyboardEvent) => void): () => void {
  hearers.add(hear);
  return () => void hearers.delete(hear);
}

/** What Tab can reach: what takes the focus in the page's order, a radio group by its checked radio. */
const TABBABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]';

/**
 * Keeps the keyboard from what the splash hides for as long as it stands, from the page's first script (main.tsx):
 * - While the game loaded under it, T tilted the map, the arrows moved it, Tab reached its canvas and ? opened Help, all unseen
 *   (the systems audit's twelfth round); as its bus towed it away, Tab reached Home's buttons under it and Enter pressed New game
 *   unseen (the eleventh), where a press of the pointer on it presses nothing (app.css). Such a key is held: its default and its
 *   way on both stopped. With nothing focused the key is the page's, and the page stands under the splash.
 * - What the splash leaves in sight keeps the keyboard: the corner and the replaced build's card, drawn over it, and what its tow
 *   has uncovered, wholly or in part, which takes the pointer's presses at once (app.css). Tab and Shift+Tab move among these
 *   alone, round and round, so the keyboard reaches the card's Reload and the corner's credits while the city loads, and never
 *   what the splash covers (the review of the twelfth round's fixes). A key on one of them does what the browser does with it:
 *   typed into a field, Enter on a button or a link. Held instead, the name typed into the founding card that a press on the
 *   uncovered New game opened was lost for the 0.65 s to the splash's going (the twelfth round). A held Enter's or Space's
 *   repeats on a control go nowhere, as onePress.ts has every press once. The page's keys wait, and the controls' own key
 *   handlers with them, as React hears keys below the window: ? on the corner opened Help under the splash (the twelfth round).
 * - The browser's own keys pass (with Ctrl, ⌘ or Alt, but not AltGr, which types ? on some keyboards, and F1 to F12), and every
 *   key once the tow has taken the splash off the screen, or once it is gone at once with less motion asked for mid-tow
 *   (app.css); gone, the hold goes at the next key. The keys it stops still reach its hearers (hearHeldKeys).
 */
export function holdKeys(win: Window = window): void {
  const held = (event: KeyboardEvent) => {
    const boot = win.document.getElementById('boot');
    if (!boot) return win.removeEventListener('keydown', held, true);
    if (win.getComputedStyle(boot).display === 'none') return;
    const altGr = event.getModifierState?.('AltGraph') === true;
    if ((!altGr && (event.ctrlKey || event.metaKey || event.altKey)) || /^F\d+$/.test(event.key)) return;
    const splash = boot.getBoundingClientRect();
    if (splash.left >= win.innerWidth) return;
    for (const hear of hearers) hear(event);
    event.stopImmediatePropagation();
    if (event.key === 'Tab') {
      event.preventDefault();
      const shown = [...win.document.querySelectorAll<HTMLElement>(TABBABLE)].filter((el) => tabStop(el) && inSight(el, splash, win));
      const k = shown.indexOf(event.target as HTMLElement);
      const next = event.shiftKey ? shown[(k <= 0 ? shown.length : k) - 1] : shown[(k + 1) % shown.length];
      next?.focus();
    } else if (!inSight(event.target, splash, win) || (event.repeat && (event.key === 'Enter' || event.key === ' ') && keyed(event.target))) {
      event.preventDefault();
    }
  };
  win.addEventListener('keydown', held, true);
}

/** Whether Tab stops at `el`: not taken out of the order, and in a radio group only its checked radio, or its first if none is. */
function tabStop(el: HTMLElement): boolean {
  if (el.tabIndex < 0) return false;
  const radio = el as HTMLInputElement;
  if (radio.type !== 'radio' || radio.checked || !radio.name) return true;
  return !radio.form?.querySelector(`input[type="radio"][name="${radio.name}"]:checked`);
}

/** Whether `target` is a control the splash leaves in sight: drawn over it, or on the screen and not wholly under it. */
function inSight(target: EventTarget | null, splash: DOMRect, win: Window): boolean {
  const at = target as { tagName?: string; closest?: (selector: string) => unknown; getBoundingClientRect?: () => DOMRect } | null;
  if (typeof at?.closest !== 'function' || typeof at.getBoundingClientRect !== 'function' || at.tagName === 'BODY' || at.tagName === 'HTML') return false;
  if (at.closest('.corner, .replaced')) return true;
  if (at.closest('#boot')) return false;
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
