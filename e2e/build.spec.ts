// The Build menu (D25 item 5: "a build tab with options to place individual stops, and an option like
// the one we have now. place a depot should also be in the build menu"; "route editing should be a
// button you press where it then brings you to an expanded menu there you can reorder, add, and remove
// stops"). Build opens its three tools; Place a stop shows its verdict at the pointer and places a
// Sign for $4k, standing alone with a card that says so and takes it down; the line tool joins it;
// and the line's Edit route reorders by drag and takes a stop off, priced on its card.
import { expect, test, type Page } from '@playwright/test';
import { DEBUG_STOPS } from '../src/sim/commands/debugLine';
import { foundCompany } from './found';
import { build, city, onDepotLand, toScreen, zoomOutOnce } from './shell';

/** On Huntington Avenue between Symphony and the MFA, more than 250 m from each. */
const ON_HUNTINGTON: [number, number] = [-71.0903, 42.33995];

/** Moves the pointer onto `at` the way the line spec does, so the card describes where it rests. */
async function pointAt(page: Page, at: [number, number]) {
  const [x, y] = await toScreen(page, at);
  await page.evaluate(
    ([moves]) => {
      const canvas = document.querySelector('.maplibregl-canvas')!;
      for (const [mx, my] of moves!) canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: mx, clientY: my, bubbles: true }));
    },
    [[[x - 40, y], [x, y]]] as const,
  );
  return [x, y] as const;
}

test.describe('the Build menu', () => {
  test.skip(!city.sim, 'no sim file in this build yet');

  test('places a stop on its own, takes it down and back, draws a line through it, and edits the route', async ({ page }) => {
    test.setTimeout(120_000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('./');
    const map = page.getByTestId('map');
    const panel = page.getByTestId('sim-panel');
    await expect(map).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(page);
    await zoomOutOnce(page);

    // Build opens its three tools, and a press elsewhere closes it.
    await page.getByTestId('build').click();
    const menu = page.getByTestId('build-menu');
    await expect(menu.getByRole('button')).toHaveText([/^Place a stop/, /^Draw a line/, /^Place a depot/]);
    await page.mouse.click(200, 300);
    await expect(menu).toHaveCount(0);

    // Place a stop: the card at the pointer, then a click places a Sign for $4k.
    await build(page, 'Place a stop');
    await expect(page.getByTestId('build')).toHaveAttribute('aria-pressed', 'true');
    const card = page.getByTestId('stop-site-card');
    const [hx, hy] = await pointAt(page, ON_HUNTINGTON);
    await expect(card).toHaveAttribute('data-ok', 'yes', { timeout: 10_000 });
    await expect(card).toContainText('A Sign here');
    await expect(card).toContainText('$4k');
    await page.mouse.click(hx, hy);
    await expect(panel).toHaveAttribute('data-cash', String(42_720_000 - 400_000));
    const stops = async () => ((await map.getAttribute('data-stops')) ?? '').split(' ').filter(Boolean).map((s) => s.split(/[:,]/).map(Number) as [number, number, number]);
    await expect.poll(async () => (await stops()).length).toBe(1);
    const [lone] = await stops();
    // Beside it, the card names it instead: a line can use it.
    await pointAt(page, [ON_HUNTINGTON[0] + 0.0004, ON_HUNTINGTON[1]]);
    await expect(card).toHaveAttribute('data-ok', 'no', { timeout: 10_000 });
    await expect(card).toContainText(`Stop ${lone![0]} stands within 250 m`);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('build')).toHaveAttribute('aria-pressed', 'false');

    // Its card: no line stops there yet; Take it down gives $2k back, and Undo puts it back.
    const stopCard = page.getByTestId('stop-card');
    const [lx, ly] = await toScreen(page, [lone![1], lone![2]]);
    await expect(async () => {
      await page.mouse.click(lx, ly);
      await expect(stopCard).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 10_000 });
    await expect(stopCard.getByTestId('stop-lone')).toContainText('No line stops here yet');
    await expect(stopCard).toHaveAttribute('data-quiet', 'no');
    await stopCard.getByRole('button', { name: 'Take it down · $2k back' }).click();
    await expect(panel).toHaveAttribute('data-cash', String(42_720_000 - 200_000));
    await expect.poll(async () => (await stops()).length).toBe(0);
    await expect(page.getByTestId('undo')).toHaveText(`Undo: Take down Stop ${lone![0]}`);
    await page.getByTestId('undo').click();
    await expect.poll(async () => (await stops()).length).toBe(1);

    // A depot, then a line from Copley through it to Longwood: the line tool joins the stop and buys three.
    await build(page, 'Place a depot');
    const [dx, dy] = await pointAt(page, onDepotLand());
    await expect(page.getByTestId('depot-card')).toHaveAttribute('data-ok', 'yes', { timeout: 10_000 });
    await page.mouse.click(dx, dy);
    await build(page, 'Draw a line');
    const draft = page.getByTestId('draft-card');
    for (const at of [DEBUG_STOPS[0]!.at, DEBUG_STOPS[1]!.at, ON_HUNTINGTON, DEBUG_STOPS[3]!.at]) {
      const [x, y] = await toScreen(page, at);
      await page.mouse.click(x, y);
    }
    await expect(draft).toContainText('4 stops', { timeout: 10_000 });
    await expect(draft).toContainText('3 new stops · $12k');
    await draft.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByTestId('line-card')).toBeVisible();

    // Edit route: the line's stops in order; drag Longwood to the top, then take Symphony off.
    await page.getByRole('button', { name: 'Edit route' }).click();
    const editor = page.getByTestId('route-editor');
    const names = editor.locator('li .name');
    await expect(names).toHaveCount(4);
    const [copley, symphony, , longwood] = await names.allTextContents();
    expect(await names.nth(2).textContent()).toBe(`Stop ${lone![0]}`);
    await editor.getByTestId('route-stop-3').dragTo(editor.getByTestId('route-stop-0'));
    await expect(names).toHaveText([longwood!, copley!, symphony!, `Stop ${lone![0]}`]);
    await editor.getByRole('button', { name: `Remove ${symphony}` }).click();
    await expect(names).toHaveText([longwood!, copley!, `Stop ${lone![0]}`]);
    await expect(editor.getByTestId('route-removed')).toHaveText(`${symphony} comes down · $2k back`, { timeout: 10_000 });
    await expect(editor).toHaveAttribute('data-refusal', '');
    const cash = Number(await panel.getAttribute('data-cash'));
    const price = Number(await editor.getAttribute('data-price'));
    await editor.getByRole('button', { name: 'Save route' }).click();
    await expect(panel).toHaveAttribute('data-cash', String(cash - price + 200_000));
    await expect(editor).toHaveCount(0);
    await expect(page.getByTestId('line-card')).toBeVisible();
    await expect.poll(async () => (await stops()).length).toBe(3);
    expect(errors).toEqual([]);
  });
});
