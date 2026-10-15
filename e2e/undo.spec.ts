// Undo while paused (I9; the M3 spec, item 7) on the page: the chip names what it takes back, Ctrl+Z
// does the same, Ctrl+Shift+Z does nothing (there is no redo), and once time has run the notice says
// why it cannot.
import { expect, test } from '@playwright/test';
import { DEBUG_STOPS } from '../src/sim/commands/debugLine';
import { foundCompany, STARTING_CENTS } from './found';
import { build, city, onDepotLand, pointAt, toScreen, zoomOutOnce } from './shell';

test.describe('undo while paused', () => {
  test.skip(!city.sim, 'no sim file in this build yet');

  test('takes back a depot from the chip and from Ctrl+Z, not from Ctrl+Shift+Z; Space after the chip plays; and refuses once time has run', async ({ page }) => {
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
    // A stop where the debug line starts, with the depot placed: $4,000 more, and Escape puts the tool away.
    const placeStop = async () => {
      await build(page, 'Place a stop');
      const [x, y] = await pointAt(page, [...DEBUG_STOPS[0]!.at]);
      await expect(page.getByTestId('stop-site-card')).toHaveAttribute('data-ok', 'yes', { timeout: 10_000 });
      await page.mouse.click(x, y);
      await expect(panel).toHaveAttribute('data-cash', String(STARTING_CENTS - 15_400_000));
      await page.keyboard.press('Escape');
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

    // Two commands, then Ctrl+Shift+Z, the usual redo: there is no redo, and it takes nothing back, so
    // the Ctrl+Z after it takes back the stop alone. That chip and cash also show for a moment between
    // the answers to two undos, so placing the stop again for $4,000 alone proves the depot stayed.
    await placeDepot();
    await placeStop();
    await page.keyboard.press('Control+Shift+Z');
    await page.keyboard.press('Control+z');
    await expect(chip).toHaveText('Undo: Place Depot 1');
    await expect(panel).toHaveAttribute('data-cash', String(STARTING_CENTS - 15_000_000));
    await placeStop();
    // The chip pressed with the mouse takes back the stop, and Space then plays, as everywhere (D25),
    // instead of pressing the chip again, which took back the depot too.
    await expect(chip).toHaveText(/^Undo: Place Stop/);
    await chip.click();
    await expect(chip).toHaveText('Undo: Place Depot 1');
    await expect(panel).toHaveAttribute('data-cash', String(STARTING_CENTS - 15_000_000));
    await page.keyboard.press('Space');
    await expect(panel).not.toHaveAttribute('data-speed', '0');
    await expect(chip).toHaveCount(0);
    expect(Number(await panel.getAttribute('data-cash'))).toBeLessThan(STARTING_CENTS - 14_000_000); // the depot kept
    await page.getByRole('button', { name: 'Pause' }).click();
    await page.keyboard.press('Control+z');
    await expect(page.getByTestId('notice')).toContainText('Time has passed since then');
    await expect(panel).not.toHaveAttribute('data-cash', String(STARTING_CENTS));
  });
});
