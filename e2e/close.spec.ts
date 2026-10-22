// The late game at the bus ceiling (DECISIONS, Open, its recommended (a)): a line's spare buses sold from its card, and a line
// closed from Lines, each at half price as a model change sells (V1's resale), and its stops no other line uses taken down for
// half their cost. New verbs: without them neither control is there.
import { expect, test, type Page } from '@playwright/test';
import { DEBUG_STOPS } from '../src/sim/commands/debugLine';
import { foundCompany, leaveHome } from './found';
import { build, city, toScreen, withDebugLine, type SaveData } from './shell';

/** A founded company with the debug line, edited by `edit`, past Home. */
async function debugGame(page: Page, edit?: (data: SaveData) => void) {
  await page.goto('./');
  await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
  await leaveHome(page);
  await foundCompany(page);
  await withDebugLine(page, edit);
}

test.describe('selling spare buses and closing a line', () => {
  test.skip(!city.sim, 'no sim file in this build yet');

  test('a line sells the buses its headways no longer need from its card, and closes from Lines after asking', async ({ page }) => {
    // The debug line every 20 minutes needs 2 Sparrows; this one has 4, 2 of them parked.
    await debugGame(page, (d) => void ((d.lines as { buses: number }[])[0]!.buses = 4));
    const checklist = page.getByTestId('checklist');
    await expect(checklist).toContainText('5/5 Take a contract');
    const panel = page.getByTestId('sim-panel');
    const cash = async () => Number(await panel.getAttribute('data-cash'));
    await page.getByRole('button', { name: 'Lines', exact: true }).click();
    const lines = page.getByTestId('inspector');
    const spares = lines.getByTestId('line-spares');
    await expect(spares).toContainText('2 of its 4 Sparrows are spare: it needs 2');
    const before = await cash();
    await spares.getByRole('button', { name: 'Sell them · $95k back' }).click();
    await expect(spares).toBeHidden();
    await expect.poll(cash).toBe(before + 9_500_000);
    await expect(lines.getByTestId('line-card')).toContainText('2 Sparrows');
    await expect(page.getByRole('button', { name: 'Undo: Line 1’s spare buses' })).toBeVisible();

    // Close line asks first, with what it sells and takes down, and Keep it asks nothing more.
    await lines.getByRole('button', { name: 'Close line' }).click();
    const ask = lines.getByTestId('close-line');
    await expect(ask).toHaveText('Close Line 1? Its 2 Sparrows sell for $95k, and 4 stops no other line uses come down for $8k.Close itKeep it');
    await ask.getByRole('button', { name: 'Keep it' }).click();
    await expect(ask).toBeHidden();
    await lines.getByRole('button', { name: 'Close line' }).click();
    const kept = await cash();
    await lines.getByTestId('close-line').getByRole('button', { name: 'Close it' }).click();
    await expect(page.getByTestId('inspector')).toBeHidden();
    await expect.poll(cash).toBe(kept + 9_500_000 + 800_000);
    await expect(page.getByRole('button', { name: 'Undo: Close Line 1' })).toBeVisible();
    // The checklist stays where it was: a line was drawn, though none stands now. It went back to 2/5 Draw a line (the review of
    // the change; shown failing, TS-04, with the chip reading the lines standing, as before).
    await expect(checklist).toContainText('5/5 Take a contract');
  });

  // The ask is the line's own. It was held for the line's id, so it came back on that line's tab chosen again, and on a line an
  // undo took back and a Create made again under its id, which then showed "Close Line 2? … Close it" by itself (the review of
  // the change). Shown failing (TS-04) with the ask kept across lines, as before.
  test('Close line’s ask goes with its line: another tab, or an undo and a new line under the freed id, shows none', async ({ page }) => {
    await debugGame(page);
    const lines = page.getByTestId('inspector');
    const ask = lines.getByTestId('close-line');
    const draw = async () => {
      await build(page, 'Draw a line');
      for (const s of [DEBUG_STOPS[0]!, DEBUG_STOPS[1]!]) await page.mouse.click(...(await toScreen(page, s.at)));
      const draft = page.getByTestId('draft-card');
      await expect(draft).toContainText('2 stops', { timeout: 10_000 });
      await draft.getByRole('button', { name: 'Create' }).click();
      await expect(lines.getByRole('tab', { name: 'Line 2', exact: true })).toHaveAttribute('aria-selected', 'true');
    };
    await draw();
    await lines.getByRole('button', { name: 'Close line' }).click();
    // Both its stops are Line 1's too, so none comes down.
    await expect(ask).toContainText('Close Line 2? Its Sparrow sells for $47.5k.');
    await lines.getByRole('tab', { name: 'Line 1', exact: true }).click();
    await expect(ask).toBeHidden();
    await lines.getByRole('tab', { name: 'Line 2', exact: true }).click();
    await expect(ask).toBeHidden();
    await lines.getByRole('button', { name: 'Close line' }).click();
    await expect(ask).toBeVisible();
    // Undo takes back Line 2's Create, freeing its id, and Lines shows Line 1.
    await page.keyboard.press('Control+z');
    await expect(lines.getByRole('tab', { name: 'Line 2', exact: true })).toHaveCount(0);
    await draw();
    await expect(ask).toBeHidden();
  });

  // Once the lender has ended the run the host refuses both (D10), so the page offers neither (floor.spec.ts sweeps the rest).
  test('an ended run offers neither Sell them nor Close line', async ({ page }) => {
    await debugGame(page, (d) => {
      (d.lines as { buses: number }[])[0]!.buses = 4;
      (d as unknown as { closesBelowFloor: number }).closesBelowFloor = 5;
      d.ledger.push({ day: 1, kind: 'buses', amountCents: -60_000_000, lineId: null });
    });
    await page.getByRole('button', { name: 'Lines', exact: true }).click();
    const lines = page.getByTestId('inspector');
    await expect(lines.getByRole('button', { name: 'Close line' })).toBeDisabled();
    await expect(lines.getByTestId('line-spares').getByRole('button', { name: 'Sell them · $95k back' })).toBeDisabled();
  });
});
