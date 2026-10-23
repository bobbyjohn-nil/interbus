// Exit check 5 (the M3 spec, item 13): two lines drawn through one stop at Kenmore, the second's click
// there joining the first's stop, carry riders who change at it, and the stop's card says how many.
// Copley to Kenmore and Kenmore to Longwood: homes near Copley walk to neither of the second line's
// stops, and jobs near Longwood to neither of the first's, so those trips change there (52.6 a day,
// measured). Shown failing (TS-04) with no changes: the card reads ≈200 boarding and no change.
// Each Create opens the inspector on the line just made, the second too; and Line 2 undone under its
// route editor puts the editor and its tool down together, so a click on a stop opens its card again.
// Shown failing (TS-04) on d6e81e6: the line card's data-line read 1 after the second Create, not 2;
// and, with that check cut, the clicks on Kenmore's stop after the undo opened no stop card in 10 s.
import { expect, test } from './base';
import { foundCompany } from './found';
import { build, city, onDepotLand, toScreen, zoomOutOnce } from './shell';

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

    await build(page, 'Place a depot');
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
    for (const [k, stops] of [[COPLEY, KENMORE], [KENMORE, LONGWOOD]].entries()) {
      await build(page, 'Draw a line');
      for (const stop of stops) {
        const [x, y] = await toScreen(page, stop);
        await page.mouse.click(x, y);
      }
      const draft = page.getByTestId('draft-card');
      await expect(draft).toHaveAttribute('data-price', /\d/, { timeout: 10_000 }); // the worker's draft has come back
      await expect(draft).toContainText(`${stops.length} stops`);
      await expect(draft).toHaveAttribute('data-refusal', '');
      await draft.getByRole('button', { name: 'Create' }).click();
      await expect(page.getByTestId('line-card')).toHaveAttribute('data-line', String(k + 1));
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

    // Line 2's route editor, then Line 2 undone under it: no editor, no tool, and Kenmore's stop,
    // Line 1's alone again, opens its card at a click.
    await card.getByRole('button', { name: 'Line 2', exact: true }).click();
    await page.getByRole('button', { name: 'Edit route' }).click();
    await expect(page.getByTestId('route-editor')).toContainText('Line 2’s route');
    await expect(page.getByTestId('undo')).toHaveText('Undo: Create Line 2');
    await page.getByTestId('undo').click();
    await expect(page.getByTestId('route-editor')).toHaveCount(0);
    await expect(card.getByRole('button', { name: 'Line 2', exact: true })).toHaveCount(0);
    await card.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(card).toHaveCount(0);
    await expect(async () => {
      await page.mouse.click(sx, sy);
      await expect(card).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 10_000 });
    await expect(card.getByRole('button', { name: 'Line 1', exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });
});
