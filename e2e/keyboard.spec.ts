// The keyboard's focus as a card's button goes with its card (the accessibility pass, PLAN §8; useFocusBack). Keep as is,
// Sell them, Close line's Keep it and Close it took the focus with them, and it fell to the page, so a keyboard player
// started again from its top (the review of Close line). Each now hands it to the control the card came from, or, as a line
// closes, to the line shown in its place, and to Build once the last line has gone. Shown failing (TS-04) with the focus
// left where it fell.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { foundCompany, leaveHome } from './found';
import { city, withDebugLine, type SaveData } from './shell';

/** A founded company with the debug line, edited by `edit`, past Home, and Lines open on it. */
async function lines(page: Page, edit?: (data: SaveData) => void) {
  await page.goto('./');
  await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
  await leaveHome(page);
  await foundCompany(page);
  await withDebugLine(page, edit);
  await page.getByRole('button', { name: 'Lines', exact: true }).click();
  return page.getByTestId('inspector');
}

/** Focuses `button` and presses it from the keyboard. */
async function press(page: Page, button: Locator) {
  await button.focus();
  await page.keyboard.press('Enter');
}

test.describe('the focus as a card’s button goes', () => {
  test.skip(!city.sim, 'no sim file in this build yet');

  test('goes back to the line card’s control the card came from: Keep as is, Sell them and Keep it', async ({ page }) => {
    // The debug line every 20 minutes needs 2 Sparrows; this one has 4, 2 of them spare.
    const panel = await lines(page, (d) => void ((d.lines as { buses: number }[])[0]!.buses = 4));
    const peak = panel.getByTestId('headway-peak');
    await peak.focus();
    await page.keyboard.press('ArrowDown');
    await page.getByRole('listbox').press('ArrowDown');
    await page.getByRole('listbox').press('Enter');
    await expect(panel.getByTestId('headway-change')).toBeVisible();
    await press(page, panel.getByTestId('headway-change').getByRole('button', { name: 'Keep as is' }));
    await expect(panel.getByTestId('headway-change')).toHaveCount(0);
    await expect(peak).toBeFocused();

    const model = panel.getByTestId('line-model');
    await model.focus();
    await page.keyboard.press('ArrowDown');
    await page.getByRole('listbox').press('ArrowDown');
    await page.getByRole('listbox').press('Enter');
    await expect(panel.getByTestId('model-change')).toBeVisible();
    await press(page, panel.getByTestId('model-change').getByRole('button', { name: 'Keep as is' }));
    await expect(model).toBeFocused();

    // A sale goes a snapshot later, when the sim has sold them.
    await press(page, panel.getByTestId('line-spares').getByRole('button'));
    await expect(panel.getByTestId('line-spares')).toHaveCount(0);
    await expect(model).toBeFocused();

    const close = panel.getByRole('button', { name: 'Close line' });
    await press(page, close);
    await press(page, panel.getByTestId('close-line').getByRole('button', { name: 'Keep it' }));
    await expect(panel.getByTestId('close-line')).toHaveCount(0);
    await expect(close).toBeFocused();
  });

  test('goes from Close it to the line shown in its place, and to Build once the last line has gone', async ({ page }) => {
    // Three lines on the debug line's stops.
    const panel = await lines(page, (d) => {
      const one = (d.lines as Record<string, unknown>[])[0]!;
      (d.lines as Record<string, unknown>[]).push({ ...one, id: 2, name: 'Line 2', stopIds: [1, 2] }, { ...one, id: 3, name: 'Line 3', stopIds: [2, 3] });
      d.nextIds = { ...d.nextIds, line: 4 };
    });
    const closeIt = async () => {
      await press(page, panel.getByRole('button', { name: 'Close line' }));
      await press(page, panel.getByTestId('close-line').getByRole('button', { name: 'Close it' }));
    };
    await panel.getByRole('tab', { name: 'Line 3', exact: true }).click();
    await closeIt();
    await expect(panel.getByRole('tab', { name: 'Line 3', exact: true })).toHaveCount(0);
    await expect(panel.getByRole('tab', { name: 'Line 1', exact: true })).toBeFocused();
    // One line left, so no tabs: the focus goes to its card.
    await panel.getByRole('tab', { name: 'Line 2', exact: true }).click();
    await closeIt();
    await expect(panel.getByRole('tablist')).toHaveCount(0);
    await expect(panel.getByTestId('line-model')).toBeFocused();
    await closeIt();
    await expect(panel).toHaveCount(0);
    await expect(page.getByTestId('build')).toBeFocused();
  });
});
