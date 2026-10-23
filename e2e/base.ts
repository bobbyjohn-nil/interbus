// The e2e suite's `test`: Playwright's, in tabs whose boot splash was towed away already (src/ui/brand/boot.ts: once a tab), so
// the splash goes the moment the game is ready. The splash takes the pointer where it stands (round 10: a press on it pressed
// the button it hid), so without this every test's first press on Home waited out the bus pulling away, about 2 s, a minute a
// shard over the suite's 124 first presses. e2e/boot.spec.ts tests the tow itself, on Playwright's own `test`, as a first visit
// sees it. Pages a test opens in a context of its own (browser.newContext) are first visits too.
import { test as base } from '@playwright/test';

export * from '@playwright/test';

export const test = base.extend({
  context: async ({ context }, provide) => {
    await context.addInitScript(() => {
      try {
        sessionStorage.setItem('interbus.tab.boot-wipe', '1');
      } catch {
        // Storage refused: the tow plays, as for a player in a private window.
      }
    });
    await provide(context);
  },
});
