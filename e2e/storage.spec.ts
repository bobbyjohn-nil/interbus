// The room a browser gives the game's saves (the systems audit's third round, D26; TS-08): the most
// characters one key's value can hold in an empty origin's localStorage, found by halving between a
// write that fits and one refused, with the key's own characters added. The game keeps five copies of
// a game there (the autosave, the quarter's save and three slots), so five of the largest save a long
// game makes (testing.ts GROWN_SAVE_MOST_CHARS; bench/savesize.ts) must fit in it. By hand, as it
// measures a browser rather than the game: `STORAGE_ROOM=1 npx playwright test e2e/storage.spec.ts`.
// Measured on 2026-10-15 in Chromium 141.0.7390.37 (the container's preinstalled browser, run with PW_CHROMIUM;
// the pinned Playwright's own Chromium may differ) on the fixture build: 5,242,880 characters, which is
// 5 × 1,024 × 1,024 (bench/savesize.ts CHROMIUM_STORAGE_CHARS); five saves of 92,160 fill 0.088 of it.
import { expect, test } from './base';
import { GROWN_SAVE_MOST_CHARS } from '../src/sim/testing';

test('five copies of a long game’s largest save fit in an origin’s localStorage', async ({ page, browser }) => {
  test.skip(!process.env.STORAGE_ROOM, 'by hand: set STORAGE_ROOM=1');
  await page.goto('./version.json');
  const room = await page.evaluate(() => {
    const key = 'room';
    localStorage.clear();
    let fits = 0;
    let refused = 16 * 1024 * 1024;
    while (refused - fits > 1) {
      const mid = Math.floor((fits + refused) / 2);
      try {
        localStorage.setItem(key, 'x'.repeat(mid));
        fits = mid;
      } catch {
        refused = mid;
      }
    }
    localStorage.clear();
    return key.length + fits;
  });
  console.log(`${browser.browserType().name()} ${browser.version()}: ${room.toLocaleString('en-US')} characters; five saves of ${GROWN_SAVE_MOST_CHARS.toLocaleString('en-US')} fill ${((5 * GROWN_SAVE_MOST_CHARS) / room).toFixed(3)} of it`);
  expect(5 * GROWN_SAVE_MOST_CHARS).toBeLessThan(room);
});
