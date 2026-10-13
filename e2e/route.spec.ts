// Route edits on the page (the M3 spec, item 14): a stop's card takes it off a line. Symphony, on
// the debug line alone, comes down for half its $4k, the line runs on three stops, and the undo chip
// puts it all back while paused (I9).
import { expect, test } from '@playwright/test';
import { DEBUG_STOPS } from '../src/sim/commands/debugLine';
import { foundCompany } from './found';
import { city, onDepotLand, toScreen, zoomOutOnce } from './shell';

test.describe('route edits', () => {
  test.skip(!city.sim, 'no sim file in this build yet');

  test('takes Symphony off the line from its card for $2k back, and the undo chip puts it back', async ({ page }) => {
    test.setTimeout(90_000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('./');
    const map = page.getByTestId('map');
    const panel = page.getByTestId('sim-panel');
    await expect(map).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(page);
    await zoomOutOnce(page);

    await page.getByRole('button', { name: 'Place a depot' }).click();
    const [dx, dy] = await toScreen(page, onDepotLand());
    await page.evaluate(
      ([moves]) => {
        const canvas = document.querySelector('.maplibregl-canvas')!;
        for (const [x, y] of moves!) canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: x, clientY: y, bubbles: true }));
      },
      [[[dx - 40, dy], [dx, dy]]] as const,
    );
    await expect(page.getByTestId('depot-card')).toHaveAttribute('data-ok', 'yes', { timeout: 10_000 });
    await page.mouse.click(dx, dy);
    await expect(panel).toHaveAttribute('data-cash', '27720000');

    await page.getByRole('button', { name: 'Draw a line' }).click();
    for (const stop of DEBUG_STOPS) {
      const [x, y] = await toScreen(page, stop.at);
      await page.mouse.click(x, y);
    }
    const draft = page.getByTestId('draft-card');
    await expect(draft).toHaveAttribute('data-price', '20600000', { timeout: 10_000 });
    await draft.getByRole('button', { name: 'Create' }).click();
    await expect(panel).toHaveAttribute('data-cash', '7120000');
    await page.keyboard.press('Escape');

    const stops = async () => (await map.getAttribute('data-stops'))!.split(' ').map((s) => s.split(/[:,]/).map(Number) as [number, number, number]);
    const placed = await stops();
    expect(placed).toHaveLength(4);
    const [sx, sy] = await toScreen(page, [placed[1]![1], placed[1]![2]]);
    const card = page.getByTestId('stop-card');
    // A click finds the stop once the map has drawn it, a frame or two after Create.
    await expect(async () => {
      await page.mouse.click(sx, sy);
      await expect(card).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 10_000 });
    await card.getByRole('button', { name: 'Remove from Line 1 · $2k back' }).click();
    await expect(panel).toHaveAttribute('data-cash', '7320000');
    await expect(card).toHaveCount(0); // the stop is gone, and its card with it
    await expect.poll(async () => (await stops()).length).toBe(3);

    const chip = page.getByTestId('undo');
    await expect(chip).toHaveText(`Undo: Remove Stop ${placed[1]![0]} from Line 1`);
    await chip.click();
    await expect(panel).toHaveAttribute('data-cash', '7120000');
    await expect.poll(async () => (await stops()).length).toBe(4);
    expect(errors).toEqual([]);
  });
});
