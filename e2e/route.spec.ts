// Route edits on the page (the M3 spec, item 14; D25): a stop's card takes it off a line, and the
// line's route editor grows it. Symphony, on the debug line alone, comes down for half its $4k, the
// line runs on three stops, and the undo chip puts it all back while paused (I9). Then a click beyond
// Longwood in the editor adds a fifth stop, priced on its card as Save route buys it. The editor follows
// the line as it stands: a stop the stop's card or an undo takes off it leaves the list, and one an undo
// puts back returns to it; and a double-click on Save route is one command. Shown failing (TS-04) on
// d6e81e6, each check reached by cutting the ones before it: the list's count read 4 after Remove, not
// 3; the notice count read 1 ("The route is as it was") after the double-click, not 0; and the list's
// count read 5 after the route's undo, not 4. A list that only dropped stops read 3 after the undo chip, not 4.
// The systems audit's third round: a stop moved with the keyboard keeps the focus on its arrow, and a
// Save route and an Undo answered together leave the edit open to save again (each shown failing below).
import { expect, test } from '@playwright/test';
import { DEBUG_STOPS } from '../src/sim/commands/debugLine';
import { foundCompany, STARTING_CENTS } from './found';
import { build, city, onDepotLand, toScreen, zoomOutOnce } from './shell';

test.describe('route edits', () => {
  test.skip(!city.sim, 'no sim file in this build yet');

  test('takes Symphony off the line for $2k back and puts it back, then adds a stop beyond Longwood in the route editor', async ({ page }) => {
    test.setTimeout(90_000);
    // The worker's messages to the page held back while `held` is a list, and handed over in one task by
    // release(), as a busy page or a slow city can hand over two answers: the page renders them together.
    await page.addInitScript(() => {
      const w = window as unknown as { held: [() => void, string][] | null; release: () => void };
      w.held = null;
      const onmessage = Object.getOwnPropertyDescriptor(Worker.prototype, 'onmessage')!;
      Object.defineProperty(Worker.prototype, 'onmessage', {
        ...onmessage,
        set(this: Worker, fn: ((event: MessageEvent<{ type?: string }>) => void) | null) {
          onmessage.set!.call(this, fn && ((event: MessageEvent<{ type?: string }>) => void (w.held ? w.held.push([() => fn.call(this, event), event.data?.type ?? '']) : fn.call(this, event))));
        },
      });
      w.release = () => {
        const held = w.held ?? [];
        w.held = null;
        for (const [deliver] of held) deliver();
      };
    });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('./');
    const map = page.getByTestId('map');
    const panel = page.getByTestId('sim-panel');
    await expect(map).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(page);
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
    await expect(panel).toHaveAttribute('data-cash', String(STARTING_CENTS - 15_000_000));

    await build(page, 'Draw a line');
    for (const stop of DEBUG_STOPS) {
      const [x, y] = await toScreen(page, stop.at);
      await page.mouse.click(x, y);
    }
    const draft = page.getByTestId('draft-card');
    await expect(draft).toHaveAttribute('data-price', '20600000', { timeout: 10_000 });
    await draft.getByRole('button', { name: 'Create' }).click();
    await expect(panel).toHaveAttribute('data-cash', String(STARTING_CENTS - 35_600_000));
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
    // The line's route editor open beside the stop's card (D25: a tool's card is a panel too).
    await card.getByRole('button', { name: 'Line 1', exact: true }).click();
    await page.getByRole('button', { name: 'Edit route' }).click();
    const editor = page.getByTestId('route-editor');
    await expect(editor.locator('li')).toHaveCount(4);
    await card.getByRole('button', { name: 'Remove from Line 1 · $2k back' }).click();
    await expect(panel).toHaveAttribute('data-cash', String(STARTING_CENTS - 35_400_000));
    await expect(card).toHaveCount(0); // the stop is gone, and its card with it
    await expect.poll(async () => (await stops()).length).toBe(3);
    // The editor drops it: the line as it now stands, nothing to save.
    await expect(editor.locator('li')).toHaveCount(3);
    await expect(editor.locator('li')).toHaveText([`Stop ${placed[0]![0]}`, `Stop ${placed[2]![0]}`, `Stop ${placed[3]![0]}`].map((name) => new RegExp(name)));
    await expect(editor).toContainText('3 stops', { timeout: 10_000 });
    await expect(editor).toHaveAttribute('data-refusal', 'no_change');
    await expect(editor.getByRole('button', { name: 'Save route' })).toBeDisabled();

    // The undo chip, the editor still open: Symphony is back on the line and in the list, and the card,
    // asked again for four stops, has nothing to save.
    const chip = page.getByTestId('undo');
    await expect(chip).toHaveText(`Undo: Take Stop ${placed[1]![0]} off Line 1`);
    await chip.click();
    await expect(panel).toHaveAttribute('data-cash', String(STARTING_CENTS - 35_600_000));
    await expect.poll(async () => (await stops()).length).toBe(4);
    await expect(editor.locator('li')).toHaveCount(4);
    await expect(editor).toContainText('4 stops', { timeout: 10_000 });
    await expect(editor).toHaveAttribute('data-refusal', 'no_change');
    await expect(editor.getByRole('button', { name: 'Save route' })).toBeDisabled();

    // A stop moved with the keyboard keeps the focus on its arrow, so Space or Enter moves it again,
    // and on its other arrow at the top, where Move up shuts; the game behind the editor stays paused.
    // Shown failing (TS-04) on 5f4bce3: the focus fell to the page with the first move, so the second Space moved nothing.
    const [a, b, c, d] = placed.map(([id]) => `Stop ${id}`) as [string, string, string, string];
    const names = editor.locator('.name');
    await editor.getByRole('button', { name: `Remove ${c}` }).focus();
    await page.keyboard.press('Tab');
    await expect(editor.getByRole('button', { name: `Move ${d} up` })).toBeFocused();
    await page.keyboard.press('Space');
    await expect(names).toHaveText([a, b, d, c]);
    await page.keyboard.press('Space');
    await expect(names).toHaveText([a, d, b, c]);
    await page.keyboard.press('Enter');
    await expect(names).toHaveText([d, a, b, c]);
    await expect(editor.getByRole('button', { name: `Move ${d} down` })).toBeFocused();
    await page.keyboard.press('Space');
    await expect(names).toHaveText([a, d, b, c]);
    await expect(editor.getByRole('button', { name: `Move ${d} down` })).toBeFocused();
    // A held Enter moves it once, as a held Space does: the browser presses a focused button again at each
    // repeat of Enter (Playwright sends a second keydown of a held key as a repeat). Shown failing (TS-04)
    // on the first try at keeping the focus, which kept the repeats too: the repeat moved it on to the bottom.
    await page.keyboard.down('Enter');
    await expect(names).toHaveText([a, b, d, c]);
    await page.keyboard.down('Enter');
    await page.keyboard.up('Enter');
    await expect(names).toHaveText([a, b, d, c]);
    await expect(editor.getByRole('button', { name: `Move ${d} down` })).toBeFocused();
    await expect(panel).toHaveAttribute('data-speed', '0');

    // Edit route (D25): the line's four stops listed, a click beyond Longwood adds a fifth at the end,
    // the card prices it, and Save route buys it.
    await page.getByRole('button', { name: 'Lines' }).click();
    await page.getByRole('button', { name: 'Edit route' }).click();
    await expect(editor).toContainText('Line 1’s route');
    await expect(editor.locator('li')).toHaveCount(4);
    await expect(editor.getByRole('button', { name: 'Save route' })).toBeDisabled(); // nothing changed yet
    const [ex, ey] = await toScreen(page, [-71.1085, 42.3395]);
    await page.mouse.click(ex, ey);
    await expect(editor.locator('li')).toHaveCount(5);
    await expect(editor.getByTestId('route-stop-4')).toContainText('New stop');
    await expect(editor).toContainText('5 stops', { timeout: 10_000 });
    await expect(editor).toHaveAttribute('data-refusal', '');
    const price = Number(await editor.getAttribute('data-price'));
    expect(price).toBeGreaterThanOrEqual(400_000); // the new stop, and a bus if the round trip needs one
    await editor.getByRole('button', { name: 'Save route' }).dblclick(); // one command, bought once
    await expect(panel).toHaveAttribute('data-cash', String(STARTING_CENTS - 35_600_000 - price));
    // The second press sent nothing, so no refusal notice follows the save. Saves lists the slots in the
    // worker's turn after a second set-route's, so once its list is in, such a refusal would show; read
    // at once, as a notice goes after 6 s.
    await page.getByTestId('saves-chip').click();
    await expect(page.getByTestId('autosave')).toBeVisible({ timeout: 10_000 });
    expect(await page.getByTestId('notice').count()).toBe(0);
    await page.getByTestId('saves-chip').click();
    await expect.poll(async () => (await stops()).length).toBe(5);
    await expect(page.getByTestId('line-card')).toBeVisible(); // the inspector, as after Create
    await expect(editor).toHaveCount(0);
    await expect(chip).toHaveText('Undo: Line 1’s route');

    // The editor open on the five stops, then the route undone under it: the fifth stop comes down and
    // leaves the list, which is the line again, and the card, asked again for four stops, has nothing to save.
    await page.getByRole('button', { name: 'Edit route' }).click();
    await expect(editor.locator('li')).toHaveCount(5);
    await expect(editor).toContainText('5 stops', { timeout: 10_000 });
    await expect(editor).toHaveAttribute('data-refusal', 'no_change');
    await chip.click();
    await expect(panel).toHaveAttribute('data-cash', String(STARTING_CENTS - 35_600_000));
    await expect.poll(async () => (await stops()).length).toBe(4);
    await expect(editor.locator('li')).toHaveCount(4);
    const standing = (await stops()).map(([id]) => String(id));
    for (const li of await editor.locator('li').all()) expect(standing).toContain(await li.getAttribute('data-stop'));
    await expect(editor).toContainText('4 stops', { timeout: 10_000 });
    await expect(editor).toHaveAttribute('data-refusal', 'no_change');
    await expect(editor.getByRole('button', { name: 'Save route' })).toBeDisabled();

    // Save route, then Ctrl+Z before the editor closed, both answers rendered at once: the undo takes the
    // save back, and the editor stays open on the player's edit, its list following the line, with Save
    // route ready to save it again. Shown failing (TS-04) on 5f4bce3, the checks before it cut: Save route
    // stayed disabled after the release.
    const save = editor.getByRole('button', { name: 'Save route' });
    await editor.getByRole('button', { name: `Remove ${b}` }).click();
    await expect(editor.getByTestId('route-removed')).toContainText('$2k back', { timeout: 10_000 });
    await expect(save).toBeEnabled();
    await page.evaluate(() => void ((window as unknown as { held: unknown[] }).held = []));
    await save.click();
    await page.keyboard.press('Control+z');
    // Both answers held: the save's snapshot, and the undo's after it.
    await expect.poll(() => page.evaluate(() => (window as unknown as { held: [unknown, string][] }).held.filter(([, type]) => type === 'snapshot').length)).toBe(2);
    await page.evaluate(() => (window as unknown as { release: () => void }).release());
    await expect(save).toBeEnabled();
    await expect(names).toHaveText([a, c, d]);
    expect(await panel.getAttribute('data-cash')).toBe(String(STARTING_CENTS - 35_600_000)); // saved and taken back
    expect((await stops()).length).toBe(4);
    // Saved again, it lands: the editor closes, and Symphony comes down for $2k back.
    await save.click();
    await expect(editor).toHaveCount(0);
    await expect(panel).toHaveAttribute('data-cash', String(STARTING_CENTS - 35_400_000));
    await expect.poll(async () => (await stops()).length).toBe(3);
    expect(errors).toEqual([]);
  });
});
