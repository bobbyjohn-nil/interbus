// Exit check 5 (the M3 spec, item 13): two lines drawn through one stop at Kenmore, the second's click
// there joining the first's stop, carry riders who change at it, and the stop's card says how many.
// Copley to Kenmore and Kenmore to Longwood: homes near Copley walk to neither of the second line's
// stops, and jobs near Longwood to neither of the first's, so those trips change there (52.6 a day,
// measured). Shown failing (TS-04) with no changes: the card reads ≈200 boarding and no change.
import { expect, test } from '@playwright/test';
import { foundCompany } from './found';
import { city, onDepotLand, toScreen, zoomOutOnce } from './shell';

const COPLEY: [number, number] = [-71.077, 42.3499];
const KENMORE: [number, number] = [-71.09721, 42.34883];
const LONGWOOD: [number, number] = [-71.1035, 42.336];

test.describe('a change of line', () => {
  test.skip(!city.sim, 'no sim file in this build yet');

  test('two lines through one stop at Kenmore carry riders who change there', async ({ page }) => {
    test.setTimeout(90_000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('./');
    const map = page.getByTestId('map');
    await expect(map).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(page);
    await expect(page.getByTestId('sim-panel')).toBeVisible();
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
    await expect(page.getByTestId('checklist')).toHaveText('2/5 Draw a line');

    // Two lines, each Created from its card; the second's first click lands on the first's stop at Kenmore.
    for (const stops of [[COPLEY, KENMORE], [KENMORE, LONGWOOD]]) {
      await page.getByRole('button', { name: 'Draw a line' }).click();
      for (const stop of stops) {
        const [x, y] = await toScreen(page, stop);
        await page.mouse.click(x, y);
      }
      const draft = page.getByTestId('draft-card');
      await expect(draft).toHaveAttribute('data-price', /\d/, { timeout: 10_000 }); // the worker's draft has come back
      await expect(draft).toContainText(`${stops.length} stops`);
      await expect(draft).toHaveAttribute('data-refusal', '');
      await draft.getByRole('button', { name: 'Create' }).click();
      await expect(page.getByTestId('line-card')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('inspector')).toHaveCount(0);
    }

    // Three stops stand, not four: the one at Kenmore is both lines'.
    const placed = (await map.getAttribute('data-stops'))!.split(' ').map((s) => s.split(/[:,]/).map(Number) as [number, number, number]);
    expect(placed).toHaveLength(3);
    const [sx, sy] = await toScreen(page, [placed[1]![1], placed[1]![2]]);
    const card = page.getByTestId('stop-card');
    // A click finds the stop once the map has drawn it, a frame or two after Create.
    await expect(async () => {
      await page.mouse.click(sx, sy);
      await expect(card).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 10_000 });
    await expect(card.getByRole('button', { name: 'Line 1', exact: true })).toBeVisible();
    await expect(card.getByRole('button', { name: 'Line 2', exact: true })).toBeVisible();
    await expect(card).toContainText('of them change here from another line, on the fare they paid');
    const changes = Number(await card.getAttribute('data-transfers'));
    test.info().annotations.push({ type: 'changes a day at Kenmore', description: String(changes) });
    expect(changes).toBeGreaterThan(10);
    expect(errors).toEqual([]);
  });
});
