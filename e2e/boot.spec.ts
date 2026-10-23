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

/** Holds the splash's removal, which its timer asks for a little past the tow (boot.ts), until the test lets it go (`letBootGo`,
 * there once the timer has asked), so a tow held at a point of its own is never taken away under a test slower than the tow (the
 * review of round 10: on a busy main thread the tow started late, and the timer did not wait). */
async function holdRemoval(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { letBootGo?: () => void };
    const remove = Element.prototype.remove;
    Element.prototype.remove = function (this: Element) {
      if (this.id !== 'boot' || w.letBootGo) return remove.call(this);
      w.letBootGo = () => remove.call(this);
    };
  });
}

/** Holds the tow's animations at `ms` into it, so where the splash stands is the test's, not the page's timing. */
const holdTow = (page: Page, ms: number) =>
  page.evaluate((at) => {
    for (const a of document.getElementById('boot')?.getAnimations({ subtree: true }) ?? []) {
      a.pause();
      a.currentTime = at;
    }
  }, ms);

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

  // Round 10. Home stands under the splash as its bus tows it away, and the splash took no pointer, so a press on it pressed
  // the button under it unseen: New game on a first visit, Continue with a company. It takes the pointer where it stands now.
  test('a press on the splash as its bus tows it away presses nothing it hides', async ({ page }) => {
    await holdRemoval(page);
    const sim = await holdCity(page);
    await page.goto('./');
    sim.release();
    await expect(page.locator('#boot.leaving')).toBeAttached({ timeout: 30_000 });
    // The tow held at its start, the splash over the whole screen, Home's New game under its middle.
    await holdTow(page, 0);
    const home = page.getByTestId('home');
    const at = (await home.getByRole('button', { name: 'New game' }).boundingBox())!;
    await page.mouse.click(at.x + at.width / 2, at.y + at.height / 2);
    // Once its timer asks for the splash to go, it goes.
    await page.waitForFunction(() => typeof (window as unknown as { letBootGo?: unknown }).letBootGo === 'function');
    await page.evaluate(() => (window as unknown as { letBootGo: () => void }).letBootGo());
    await expect(page.locator('#boot')).toHaveCount(0);
    await expect(page.getByTestId('founding-card')).toHaveCount(0);
    await expect(home).toBeVisible();
  });

  // Round 10: the replaced build's card stood under the splash, unseen until the city's 2 MB came, or for good on a stalled load.
  test('a file of this build gone while the city loads: its card shows at once, over the splash', async ({ page }) => {
    await page.route('**/assets/loadMap-*.js', (route) => route.fulfill({ status: 404, body: 'Not Found' }));
    await holdCity(page);
    await page.goto('./');
    const card = page.getByTestId('replaced-card');
    await expect(card).toBeAttached({ timeout: 15_000 });
    await expect(page.locator('#boot')).toBeVisible();
    expect(await zIndex(page, '.replaced')).toBeGreaterThan(await zIndex(page, '#boot'));
    // What is drawn at the middle of its Reload: the button itself, not the splash.
    const top = await card.getByRole('button', { name: 'Reload' }).evaluate((el) => {
      const r = el.getBoundingClientRect();
      return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
    });
    expect(top).toBe(true);
  });

  // Round 10: the reduced-motion rule stopped the tow, so the half-gone splash stood back over the whole screen until its timer
  // took it, up to 2.5 s.
  test('less motion asked for as the bus tows the splash away: it goes, never back over the screen', async ({ page }) => {
    await holdRemoval(page);
    const sim = await holdCity(page);
    await page.goto('./');
    sim.release();
    await expect(page.locator('#boot.leaving')).toBeAttached({ timeout: 30_000 });
    /** The splash's left edge, or null once nothing of it shows. */
    const left = () =>
      page.evaluate(() => {
        const r = document.getElementById('boot')?.getBoundingClientRect();
        return r && r.width > 0 ? r.left : null;
      });
    // The tow held 2 s in, past halfway across: a poll on the running tow raced it on CI's two workers (the review of round 10).
    await holdTow(page, 2_000);
    expect(await left()).toBeGreaterThan(200);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(await left(), 'the splash once less motion is asked for').toBeNull();
  });
});
