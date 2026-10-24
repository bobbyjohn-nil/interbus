// A game in a tab out of sight holds its time where it is, at its speed, and runs on from there as the tab shows again. The sim
// worker's timer ran on at full speed in a hidden tab (Chromium 141), so a game left at 2,700× ran 10 game days in 330 s, its
// quarter's report card come and gone unseen (the systems audit's fourteenth round). Playwright's pages never go out of sight
// themselves, so the test says the page is hidden as the browser would. Shown failing (TS-04) without the hold: the clock ran
// 26,860 game seconds in the 10 s out of sight.
import { expect, test, type Page } from './base';
import { saveKey } from '../src/sim/save/save';
import { foundCompany } from './found';
import { city, setSpeed } from './shell';

/** Says the page is out of sight, or in sight again, as a tab switch does. */
const seen = (page: Page, state: 'hidden' | 'visible') =>
  page.evaluate((state) => {
    Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
    Object.defineProperty(document, 'hidden', { value: state === 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  }, state);

test.describe('a tab out of sight', () => {
  test.skip(!city.sim, 'no sim file in this build yet');

  test('holds the game’s time where it is, and runs on at its speed from there as it shows again', async ({ page }) => {
    await page.goto('./');
    const panel = page.getByTestId('sim-panel');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(page);
    await setSpeed(page, '2,700×');
    await expect(panel).toHaveAttribute('data-speed', '4');
    const elapsed = async () => Number(await panel.getAttribute('data-elapsed'));
    await expect.poll(elapsed).toBeGreaterThan(0);

    await seen(page, 'hidden');
    const left = await elapsed();
    await page.waitForTimeout(10_000);
    // A game hour at most: a snapshot on its way as the page went out of sight still lands.
    expect((await elapsed()) - left).toBeLessThan(3_600);

    await seen(page, 'visible');
    const back = await elapsed();
    await expect(panel).toHaveAttribute('data-speed', '4');
    await expect.poll(elapsed).toBeGreaterThan(back + 2_700);
    // From where it stood, not 10 s of play on: under 3 real seconds' worth since it showed.
    expect((await elapsed()) - back).toBeLessThan(3 * 2_700 + 3_600);
  });

  // A notice's few seconds ran on the real clock in a tab out of sight, where the game holds its time: a save from an older build
  // set aside as the game opened in a background tab, and another tab's change to the autosave, were said and gone unseen (the
  // systems audit's fifteenth round). Each waits for the page to show now, and stays its few seconds from there. Shown failing
  // (TS-04) on main, where neither was there as the page showed.
  test('a save set aside as the game opens out of sight is said as the page shows, for its few seconds', async ({ page }) => {
    test.setTimeout(60_000);
    const old = JSON.stringify({ format: 1, build: { sha: '0'.repeat(40), version: '0.0.0' }, data: { company: { name: 'Old Line Co' } } });
    await page.addInitScript(
      ([key, text]) => {
        localStorage.setItem(key!, text!);
        Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
        Object.defineProperty(document, 'hidden', { value: true, configurable: true });
      },
      [saveKey(city.id), old],
    );
    await page.goto('./');
    const notice = page.getByTestId('notice');
    await expect(notice).toHaveText('Save from an older build set aside', { timeout: 30_000 });
    // Past its 6 s out of sight, it is still said as the page shows, and 2 s on; then its seconds run out.
    await page.waitForTimeout(6_500);
    await seen(page, 'visible');
    await expect(notice).toHaveText('Save from an older build set aside');
    await page.waitForTimeout(2_000);
    await expect(notice).toHaveText('Save from an older build set aside');
    await expect(notice).toHaveCount(0, { timeout: 10_000 });
  });

  test('another tab’s change to the autosave, found out of sight, is said as the page shows', async ({ context }) => {
    test.setTimeout(90_000);
    const a = await context.newPage();
    await a.goto('./');
    await expect(a.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(a);
    await seen(a, 'hidden');
    // The game in another tab, played on there: its saves are the newest, and the first tab finds them as it would out of sight.
    const b = await context.newPage();
    await b.goto('./');
    const continueB = b.getByTestId('home-continue');
    await expect(continueB).toContainText('Back Bay Transit', { timeout: 30_000 });
    await continueB.click();
    await setSpeed(b, '600×');
    await expect(a.getByTestId('saves-chip')).toHaveText('Autosave off', { timeout: 10_000 });
    const notice = a.getByTestId('notice');
    await expect(notice).toHaveText('Another tab changed the autosave');
    await a.waitForTimeout(6_500);
    await seen(a, 'visible');
    await expect(notice).toHaveText('Another tab changed the autosave');
  });
});
