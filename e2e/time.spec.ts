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
    await expect(options.locator('.dropdown-label')).toHaveText(['1×', '60×', '600×', '2,700×', '5,400×']);
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

    // Space pauses, and plays again at the speed it was at, straight after a speed picked with the
    // mouse: the speed button keeps the focus, but not Space, which would open its menu instead.
    await page.keyboard.press('Space');
    await expect(panel).toHaveAttribute('data-speed', '0');
    await page.keyboard.press('Space');
    await expect(panel).toHaveAttribute('data-speed', '1');
    await expect(page.getByRole('listbox')).toHaveCount(0);
    // So after any button pressed with the mouse: Finance stays open, and the game pauses.
    const finance = page.getByTestId('finance');
    await page.getByRole('button', { name: 'Finance', exact: true }).click();
    await expect(finance).toBeVisible();
    await page.keyboard.press('Space');
    await expect(panel).toHaveAttribute('data-speed', '0');
    await expect(finance).toBeVisible();
    await finance.getByRole('button', { name: 'Close' }).click();
    // A button reached with Tab keeps Space, so the keyboard can still press it: Tab from Play to the
    // speed menu, and Space opens it.
    await page.getByTestId('play').click();
    await expect(panel).toHaveAttribute('data-speed', '1');
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('speed-menu')).toBeFocused();
    await page.keyboard.press('Space');
    await expect(page.getByRole('listbox', { name: 'Speed' })).toBeVisible();
    await expect(panel).toHaveAttribute('data-speed', '1');
    await page.keyboard.press('Escape');
    await page.keyboard.press('5');
    await expect(panel).toHaveAttribute('data-speed', '5');
    await page.getByRole('button', { name: 'Pause' }).click();
    await expect(panel).toHaveAttribute('data-speed', '0');
  });

});
