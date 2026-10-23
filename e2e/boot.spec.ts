// The boot splash (index.html; S18, V1's) and its wipe (src/ui/brand/boot.ts; GD-08): the page draws the splash while the game's
// own files load, a line of depot chatter under the bus, in the game's tokens and type; once the game has a screen to show, the
// splash's bus tows it away the first time in a tab, and later in the tab, or for anyone who asked for less motion, it goes at
// once; and if the game's code never comes, it says to reload. Shown failing (TS-04) on the build before it, which drew nothing
// until the game came.
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { smallThings } from './a11y';

const CHATTER = [...readFileSync('index.html', 'utf8').matchAll(/^\s*'([^']+…)',$/gm)].map((m) => m[1]!);

/** Records, in the page, whether the splash was ever told to leave by its bus, and whether it said nothing more to a screen
 * reader as it began: its words outside the page's landmarks were axe-core's "region" as the wipe ran (#161's CI). */
async function watchTow(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { towed: boolean; unsaid: boolean };
    w.towed = w.unsaid = false;
    new MutationObserver(() => {
      const boot = document.querySelector('#boot.leaving');
      if (boot && !w.towed) [w.towed, w.unsaid] = [true, boot.getAttribute('aria-hidden') === 'true'];
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ['class'] });
  });
}
const towed = (page: Page) => page.evaluate(() => (window as unknown as { towed: boolean }).towed);
const unsaid = (page: Page) => page.evaluate(() => (window as unknown as { unsaid: boolean }).unsaid);

/** Holds the game's own code back a second and a half, as a slow connection would, until `release` is called. */
async function holdGame(page: Page): Promise<{ release: () => void }> {
  let held = true;
  await page.route('**/assets/index-*.js', async (route) => {
    if (held) await new Promise((done) => setTimeout(done, 1_500));
    await route.continue();
  });
  return { release: () => void (held = false) };
}

test.describe('the boot splash', () => {
  test('stands while the game’s files load, then its bus tows it away, once a tab', async ({ page }) => {
    await watchTow(page);
    const game = await holdGame(page);
    await page.goto('./');
    const boot = page.locator('#boot');
    await expect(boot).toBeVisible();
    await expect(boot.getByText('Interbus', { exact: true })).toBeVisible();
    expect(CHATTER).toContain(await boot.locator('.boot-line').textContent());
    await expect(boot.getByRole('status')).toHaveText('Loading');
    // In the game's tokens and its own type: Home's paper and ink, and Afacad Flux.
    await expect(boot).toHaveCSS('background-color', 'rgb(246, 243, 238)');
    await expect(boot).toHaveCSS('color', 'rgb(44, 42, 36)');
    await expect(boot.locator('b')).toHaveCSS('font-family', /^"Afacad Flux"/);
    expect(await smallThings(page)).toEqual([]);

    await expect(page.getByTestId('home')).toBeVisible({ timeout: 30_000 });
    await expect(boot).toHaveCount(0, { timeout: 5_000 });
    expect(await towed(page)).toBe(true);
    expect(await unsaid(page)).toBe(true);

    // Later in the tab it goes at once.
    game.release();
    await page.reload();
    await expect(page.getByTestId('home')).toBeVisible({ timeout: 30_000 });
    await expect(boot).toHaveCount(0);
    expect(await towed(page)).toBe(false);
  });

  test('for anyone who asked for less motion, it goes at once', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await watchTow(page);
    await holdGame(page);
    await page.goto('./');
    await expect(page.locator('#boot')).toBeVisible();
    await expect(page.getByTestId('home')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('#boot')).toHaveCount(0);
    expect(await towed(page)).toBe(false);
  });

  // The game's code never comes: the page's clock run on 21 s, the chatter gives way to a word to reload, a screen reader's too.
  test('says to reload when nothing has come in 20 s', async ({ page }) => {
    await page.clock.install();
    await page.route('**/assets/index-*.js', (route) => route.abort());
    await page.goto('./');
    const boot = page.locator('#boot');
    await expect(boot).toBeVisible();
    expect(CHATTER).toContain(await boot.locator('.boot-line').textContent());
    await page.clock.runFor(21_000);
    const stuck = 'Still loading. Reload the page if this stays.';
    await expect(boot.locator('.boot-line')).toHaveText(stuck);
    await expect(boot.getByRole('status')).toHaveText(stuck);
  });
});
