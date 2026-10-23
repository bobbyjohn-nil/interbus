// The boot splash (index.html; S18, V1's) and its wipe (src/ui/brand/boot.ts; GD-08): the page draws the splash while the game's
// own files load, a line of depot chatter under the bus, in the game's tokens and type, with the map's credit over it; once the
// game has a screen to show, the splash's bus tows it away the first time in a tab a game starts in, and later in the tab, for
// anyone who asked for less motion, or over a game that could not start, it goes at once; and if the game's code never runs, or
// nothing comes in a minute, it says to reload. Shown failing (TS-04) on the build before it, which drew nothing until the game
// came, and with each of its rules taken out.
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { axeProblems, smallThings } from './a11y';
import { city } from './shell';

const CHATTER = [...readFileSync('index.html', 'utf8').matchAll(/^\s*'([^']+…)',$/gm)].map((m) => m[1]!);
const STUCK = 'Still loading. Reload the page if this stays.';
const SIM = `**/cities/${city.sim?.file ?? 'none'}`;

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

/** Holds the city's sim file back, as a slow line holds its 2 MB, until `release`: the splash stands till then, the game's own
 * code run under it. Later loads come straight. */
async function holdCity(page: Page): Promise<{ release: () => void }> {
  let release!: () => void;
  const held = new Promise<void>((done) => (release = done));
  await page.route(SIM, async (route) => {
    await held;
    await route.continue();
  });
  return { release };
}

const zIndex = (page: Page, selector: string) => page.locator(selector).evaluate((el) => Number(getComputedStyle(el).zIndex));

test.describe('the boot splash', () => {
  test.skip(!city.sim, 'no sim file in this build yet');

  test('stands while the city loads, the map’s credit over it, then its bus tows it away, once a tab', async ({ page }) => {
    await watchTow(page);
    const sim = await holdCity(page);
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
    // The map's credit and the build chip over it, so the credit shows with any of the map as the bus tows the splash away.
    const corner = page.locator('.corner');
    await expect(corner).toContainText('© OpenStreetMap contributors');
    expect(await zIndex(page, '.corner')).toBeGreaterThan(await zIndex(page, '#boot'));
    expect(await smallThings(page)).toEqual([]);
    expect(await axeProblems(page)).toEqual([]);

    sim.release();
    await expect(page.getByTestId('home')).toBeVisible({ timeout: 30_000 });
    await expect(boot).toHaveCount(0, { timeout: 5_000 });
    expect(await towed(page)).toBe(true);
    expect(await unsaid(page)).toBe(true);

    // Later in the tab it goes at once.
    await page.reload();
    await expect(page.getByTestId('home')).toBeVisible({ timeout: 30_000 });
    await expect(boot).toHaveCount(0);
    expect(await towed(page)).toBe(false);
  });

  test('for anyone who asked for less motion, it goes at once', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await watchTow(page);
    const sim = await holdCity(page);
    await page.goto('./');
    await expect(page.locator('#boot')).toBeVisible();
    sim.release();
    await expect(page.getByTestId('home')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('#boot')).toHaveCount(0);
    expect(await towed(page)).toBe(false);
  });

  // Over the card that says the city couldn't be loaded the splash goes at once, and the tab's tow waits for the Reload that
  // works (the review of #161).
  test('over a game that could not start it goes at once, leaving its tow for the start that works', async ({ page }) => {
    await watchTow(page);
    await page.route(SIM, (route) => route.fulfill({ status: 500, body: 'Internal Server Error' }));
    await page.goto('./');
    const card = page.getByTestId('failed-card');
    await expect(card).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('#boot')).toHaveCount(0);
    expect(await towed(page)).toBe(false);
    await page.unroute(SIM);
    await card.getByRole('button', { name: 'Reload' }).click();
    await expect(page.getByTestId('home')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('#boot')).toHaveCount(0, { timeout: 5_000 });
    expect(await towed(page)).toBe(true);
  });

  // The page's clock run on: with the game's code never come, the chatter gives way to a word to reload at 20 s, a screen
  // reader's too; with the code run and only the city slow, as on a slow line, it chatters on to a minute first.
  test('says to reload when the game’s code has not come in 20 s', async ({ page }) => {
    await page.clock.install();
    await page.route('**/assets/index-*.js', (route) => route.abort());
    await page.goto('./');
    const boot = page.locator('#boot');
    expect(CHATTER).toContain(await boot.locator('.boot-line').textContent());
    await page.clock.runFor(21_000);
    await expect(boot.locator('.boot-line')).toHaveText(STUCK);
    await expect(boot.getByRole('status')).toHaveText(STUCK);
  });

  test('chatters on past 20 s while only the city is slow, and says to reload at a minute', async ({ page }) => {
    await page.clock.install();
    await holdCity(page);
    await page.goto('./');
    const boot = page.locator('#boot');
    await expect(page.getByTestId('map')).toBeAttached();
    await page.clock.runFor(21_000);
    expect(CHATTER).toContain(await boot.locator('.boot-line').textContent());
    await expect(boot.getByRole('status')).toHaveText('Loading');
    await page.clock.runFor(40_000);
    await expect(boot.locator('.boot-line')).toHaveText(STUCK);
  });
});
