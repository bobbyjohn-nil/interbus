// The end of the page's boot splash (index.html; S18, V1's `Intralines@7af45b1:src/ui/BusWipe.tsx`). The game calls it once it
// has a screen to show (App.tsx): the splash's bus tows the splash away the first time in a tab (GD-08), and later in the tab,
// for anyone who asked for less motion, it goes at once, as a wipe each time would only be in the way.
import { firstInTab } from '../../platform';

/** The wipe's length (app.css, boot-away and boot-engine). */
export const WIPE_MS = 2400;

/** What ending the splash reads and does, the page's own by default, so a test can hand it its own. */
export interface BootEnv {
  /** The splash, or null once it has gone, or on a page with none. */
  readonly boot: Pick<Element, 'classList' | 'remove' | 'setAttribute'> | null;
  /** Whether the player asked for less motion. */
  readonly still: boolean;
  /** Whether this is the first time in the tab, which counts it (the platform's firstInTab). */
  readonly firstInTab: () => boolean;
  /** Runs `run` in `ms`, by a timer, so a tab in the background, where animations wait, ends it too. */
  readonly later: (run: () => void, ms: number) => void;
}

function pageBoot(): BootEnv {
  return {
    boot: document.getElementById('boot'),
    still: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true,
    firstInTab: () => firstInTab('boot-wipe'),
    later: (run, ms) => void window.setTimeout(run, ms),
  };
}

/**
 * Ends the splash: towed away by its bus, gone a little past the wipe, or gone at once. Towed, it says nothing more to a screen
 * reader or axe-core, as the game it waited for stands under it: its words outside the page's landmarks were axe-core's
 * "region" on a screen tested as the wipe ran (e2e/many.spec.ts, #161's CI). Called again, it does nothing more.
 */
export function endBoot(env: BootEnv = pageBoot()): void {
  const { boot } = env;
  if (!boot || boot.classList.contains('leaving')) return;
  if (env.still || !env.firstInTab()) {
    boot.remove();
    return;
  }
  boot.setAttribute('aria-hidden', 'true');
  boot.classList.add('leaving');
  env.later(() => boot.remove(), WIPE_MS + 150);
}
