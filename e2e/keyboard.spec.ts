// The keyboard's focus as a card's button goes with its card (the accessibility pass, PLAN §8; useFocusBack). Keep as is,
// Sell them, Close line's Keep it and Close it took the focus with them, and it fell to the page, so a keyboard player
// started again from its top (the review of Close line). Each now hands it to the control the card came from, or, as a line
// closes, to the line shown in its place, and to Build once the last line has gone. Shown failing (TS-04) with the focus
// left where it fell; the undo's and the double presses' with their fixes taken out (the review of the hand-back).
import { expect, test, type Locator, type Page } from '@playwright/test';
import { DEBUG_STOPS } from '../src/sim/commands/debugLine';
import { foundCompany, leaveHome, STARTING_CENTS } from './found';
import { build, city, onDepotLand, toScreen, withDebugLine, zoomOutOnce, type SaveData } from './shell';

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

/** The debug line every 20 minutes needs 2 Sparrows; this one has 4, 2 of them spare. */
const fourBuses = (d: SaveData) => void ((d.lines as { buses: number }[])[0]!.buses = 4);

/** Focuses `button` and presses it from the keyboard. */
async function press(page: Page, button: Locator) {
  await button.focus();
  await page.keyboard.press('Enter');
}

/** Opens `list`, a Lines dropdown, from the keyboard, moves its pick with `key` and takes it. */
async function pickWith(page: Page, list: Locator, key: string) {
  await list.focus();
  await page.keyboard.press('ArrowDown');
  await page.getByRole('listbox').press(key);
  await page.getByRole('listbox').press('Enter');
}

/** Counts the commands the page posts to the sim's worker, by type, from the page's start. */
async function countSends(page: Page) {
  await page.addInitScript(() => {
    const sent: string[] = [];
    (window as unknown as { sent: string[] }).sent = sent;
    const post = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (this: Worker, message: unknown, ...rest: unknown[]) {
      const type = (message as { type?: unknown } | null)?.type;
      if (typeof type === 'string') sent.push(type);
      return (post as (...a: unknown[]) => void).call(this, message, ...rest);
    } as typeof Worker.prototype.postMessage;
  });
  return (type: string) => page.evaluate((t) => (window as unknown as { sent: string[] }).sent.filter((s) => s === t).length, type);
}

test.describe('the focus as a card’s button goes', () => {
  test.skip(!city.sim, 'no sim file in this build yet');

  test('goes back to the headway the card came from: Keep as is, Run it and Buy and run', async ({ page }) => {
    const panel = await lines(page, fourBuses);
    const peak = panel.getByTestId('headway-peak');
    const change = panel.getByTestId('headway-change');
    // Every 30 minutes, on fewer buses than it has: Run it.
    await pickWith(page, peak, 'ArrowDown');
    await press(page, change.getByRole('button', { name: 'Keep as is' }));
    await expect(change).toHaveCount(0);
    await expect(peak).toBeFocused();
    await pickWith(page, peak, 'ArrowDown');
    await press(page, change.getByRole('button', { name: 'Run it' }));
    await expect(change).toHaveCount(0);
    await expect(peak).toBeFocused();
    await expect(peak).toContainText('Every 30 min');
    // Every 5 minutes, on more buses than it has: Buy and run.
    await pickWith(page, peak, 'Home');
    await press(page, change.getByRole('button', { name: 'Buy and run' }));
    await expect(change).toHaveCount(0);
    await expect(peak).toBeFocused();
    await expect(peak).toContainText('Every 5 min');
    // A press that left the focus where it was, as a mouse's can, hands nothing on.
    await pickWith(page, peak, 'ArrowDown');
    await peak.blur();
    await change.getByRole('button', { name: 'Keep as is' }).evaluate((b: HTMLElement) => b.click());
    await expect(change).toHaveCount(0);
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
  });

  test('goes back to the Buses list from the swap’s Keep as is and Buy and swap and from Sell them, and to Close line from Keep it', async ({ page }) => {
    const panel = await lines(page, fourBuses);
    const model = panel.getByTestId('line-model');
    const swap = panel.getByTestId('model-change');
    await pickWith(page, model, 'ArrowDown');
    await expect(swap).toBeVisible();
    await press(page, swap.getByRole('button', { name: 'Keep as is' }));
    await expect(swap).toHaveCount(0);
    await expect(model).toBeFocused();

    // A sale goes a snapshot later, when the sim has sold them.
    await press(page, panel.getByTestId('line-spares').getByRole('button'));
    await expect(panel.getByTestId('line-spares')).toHaveCount(0);
    await expect(model).toBeFocused();

    const sparrows = await model.textContent();
    await pickWith(page, model, 'ArrowDown');
    await press(page, swap.getByRole('button', { name: 'Buy and swap' }));
    await expect(swap).toHaveCount(0);
    await expect(model).toBeFocused();
    await expect(model).not.toHaveText(sparrows ?? '');

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

  test('stays on the page as an undo takes the only line, so Space plays rather than opening Build', async ({ page }) => {
    await page.goto('./');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(page);
    await zoomOutOnce(page);
    const clickAt = async (at: readonly [number, number]) => {
      const [x, y] = await toScreen(page, at);
      await page.mouse.click(x, y);
    };
    await build(page, 'Place a depot');
    await clickAt(onDepotLand());
    await expect(page.getByTestId('sim-panel')).toHaveAttribute('data-cash', String(STARTING_CENTS - 15_000_000));
    await build(page, 'Draw a line');
    await clickAt(DEBUG_STOPS[0]!.at);
    await clickAt(DEBUG_STOPS[1]!.at);
    const draft = page.getByTestId('draft-card');
    await expect(draft).toHaveAttribute('data-price', /\d+/, { timeout: 10_000 });
    await draft.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByTestId('undo')).toHaveText('Undo: Create Line 1');
    await expect(page.getByTestId('inspector')).toBeVisible();
    await page.keyboard.press('Control+z');
    await expect(page.getByTestId('inspector')).toHaveCount(0);
    await expect(page.getByTestId('build')).not.toBeFocused();
    await page.keyboard.press(' ');
    await expect(page.getByTestId('sim-panel')).not.toHaveAttribute('data-speed', '0');
    await expect(page.getByTestId('build-menu')).toHaveCount(0);
  });

  test('two presses of Sell them or Close it send one command, and no refusal', async ({ page }) => {
    const sent = await countSends(page);
    const panel = await lines(page, fourBuses);
    const spares = panel.getByTestId('line-spares');
    await spares.getByRole('button').focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await expect(spares).toHaveCount(0);
    await panel.getByRole('button', { name: 'Close line' }).click();
    await panel.getByTestId('close-line').getByRole('button', { name: 'Close it' }).focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await expect(panel).toHaveCount(0);
    expect([await sent('sell-spares'), await sent('close-line')]).toEqual([1, 1]);
    // Nor did a second command's refusal say so (copy.ts); the load's notice may still show, for 6 s.
    await expect(page.getByText(/That line is gone|The line needs every bus it has/)).toHaveCount(0);
  });
});
