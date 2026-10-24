// A game in a tab out of sight holds its time where it is, at its speed, and runs on from there as the tab shows again. The sim
// worker's timer ran on at full speed in a hidden tab (Chromium 141), so a game left at 2,700× ran 10 game days in 330 s, its
// quarter's report card come and gone unseen (the systems audit's fourteenth round). Playwright's pages never go out of sight
// themselves, so the test says the page is hidden as the browser would. Shown failing (TS-04) without the hold: the clock ran
// 26,860 game seconds in the 10 s out of sight.
import { expect, test, type Page } from './base';
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
});
