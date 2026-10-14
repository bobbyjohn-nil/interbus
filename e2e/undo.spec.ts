// Undo while paused (I9; the M3 spec, item 7) on the page: the chip names what it takes back, Ctrl+Z
// does the same, and once time has run the notice says why it cannot.
import { expect, test } from '@playwright/test';
import { foundCompany, STARTING_CENTS } from './found';
import { build, city, onDepotLand, setSpeed, toScreen, zoomOutOnce } from './shell';

test.describe('undo while paused', () => {
  test.skip(!city.sim, 'no sim file in this build yet');

  test('takes back a depot from the chip and from Ctrl+Z, and refuses once time has run', async ({ page }) => {
    await page.goto('./');
    const panel = page.getByTestId('sim-panel');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(page);
    await zoomOutOnce(page);
    const placeDepot = async () => {
      await build(page, 'Place a depot');
      const [x, y] = await toScreen(page, onDepotLand());
      await page.mouse.click(x, y);
      await expect(panel).toHaveAttribute('data-cash', String(STARTING_CENTS - 15_000_000));
    };

    await placeDepot();
    const chip = page.getByTestId('undo');
    await expect(chip).toHaveText('Undo: Place Depot 1');
    await chip.click();
    await expect(panel).toHaveAttribute('data-cash', String(STARTING_CENTS));
    await expect(chip).toHaveCount(0);

    await placeDepot();
    await expect(chip).toHaveText('Undo: Place Depot 1'); // the undo put the id counter back too
    await page.keyboard.press('Control+z');
    await expect(panel).toHaveAttribute('data-cash', String(STARTING_CENTS));

    await placeDepot();
    await setSpeed(page, '600×');
    await expect(chip).toHaveCount(0);
    await page.getByRole('button', { name: 'Pause' }).click();
    await page.keyboard.press('Control+z');
    await expect(page.getByTestId('notice')).toContainText('Time has passed since then');
    await expect(panel).not.toHaveAttribute('data-cash', String(STARTING_CENTS));
  });
});
