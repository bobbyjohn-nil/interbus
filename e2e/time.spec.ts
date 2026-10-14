// The owner's initial playtest (D25): time in minutes and days, eight days to a quarter, and a speed
// ladder from real time up; and a panel opened from the dock while a tool is out is seen and usable.
import { expect, test } from '@playwright/test';
import { foundCompany } from './found';
import { city, setSpeed } from './shell';

test.describe('time and the speed menu', () => {
  test.skip(!city.sim, 'no sim file in this build yet');

  test('names the year, quarter and day; plays from real time up; Space pauses and plays', async ({ page }) => {
    await page.goto('./');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(page);
    const panel = page.getByTestId('sim-panel');
    await expect(page.getByTestId('date')).toHaveText(/^Year 1, Q1 Day 1, 05:00$/);

    // The menu: five speeds, each with what it means, in the game's own dropdown.
    await page.getByTestId('speed-menu').click();
    const options = page.getByRole('listbox', { name: 'Speed' }).getByRole('option');
    await expect(options.locator('.dropdown-label')).toHaveText(['1×', '60×', '600×', '1,800×', '5,400×']);
    await expect(options.first()).toContainText('Real time');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('listbox')).toHaveCount(0);

    // 1x is real time: a few real seconds move the clock a few game seconds, not minutes.
    await setSpeed(page, '1×');
    await expect(panel).toHaveAttribute('data-speed', '1');
    const start = Number(await panel.getAttribute('data-elapsed'));
    await page.waitForTimeout(2_000);
    const after = Number(await panel.getAttribute('data-elapsed'));
    expect(after - start).toBeGreaterThanOrEqual(1);
    expect(after - start).toBeLessThan(10); // the old "1x" ran 600 game seconds a second

    // Space pauses, and plays again at the speed it was at.
    await page.locator('body').click({ position: { x: 5, y: 300 } });
    await page.keyboard.press('Space');
    await expect(panel).toHaveAttribute('data-speed', '0');
    await page.keyboard.press('Space');
    await expect(panel).toHaveAttribute('data-speed', '1');
    await page.keyboard.press('5');
    await expect(panel).toHaveAttribute('data-speed', '5');
    await page.getByRole('button', { name: 'Pause' }).click();
    await expect(panel).toHaveAttribute('data-speed', '0');
  });

});
