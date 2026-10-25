// What stays where the player left it (the systems audit's eighteenth round, its first lane, on #187's fixes): the control the
// keyboard is on, handed on as it goes from under the keyboard, and a dragged panel's place. A drag of a panel by its heading
// let the hold go though the focus stayed, so the hand-on gave the page the focus; Ctrl+Z took the route editor's rows and
// Save route from under the keyboard, and a stop's card's Ctrl+Z gave the dock's Lines the focus, where Space closed Lines;
// Continue gave the new line's card's box where the card had handed the keyboard to Cancel; a key's press that closed a
// dragged panel moved where it opened next; Close line's ask opened two thirds on the window; and Home on the first view tab
// moved the panel. Each shown failing (TS-04) with its fix taken out.
import { expect, test, type Locator, type Page } from './base';
import { DEBUG_STOPS } from '../src/sim/commands/debugLine';
import { foundCompany, leaveHome } from './found';
import { lines } from './keys';
import { build, city, frames, toScreen, withDebugLine, type SaveData } from './shell';

/** Day 2 at 23:58:30, a minute and a half before the close. */
const CLOCK = 86_400 + 18 * 3_600 + 58 * 60 + 30;
/** A place past Longwood the route editor's click adds Stop 5 at. */
const PAST_LONGWOOD: [number, number] = [-71.098, 42.346];

/** The debug line's game, edited by `edit`, past Home, with nothing open. */
async function game(page: Page, edit?: (data: SaveData) => void) {
  await page.goto('./');
  await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
  await leaveHome(page);
  await foundCompany(page);
  await withDebugLine(page, edit);
}

/** Focuses `el` as the keyboard does: from the control before it, by Tab. */
async function tabOnto(page: Page, el: Locator) {
  await el.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(el).toBeFocused();
}

/** Opens the list of the dropdown the keyboard is on and picks the option `label` names, from the keyboard. */
async function pickByKey(page: Page, label: RegExp) {
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Home');
  for (let k = 0; k < 16 && !label.test((await page.locator('.dropdown-option.active .dropdown-label').textContent()) ?? ''); k++) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
}

/** Drags `panel` by its heading by `dx` across and `dy` down. */
async function dragBy(page: Page, panel: Locator, dx: number, dy = 0) {
  const h = (await panel.locator('h2').first().boundingBox())!;
  await page.mouse.move(h.x + 10, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(h.x + 10 + dx, h.y + h.height / 2 + dy, { steps: 8 });
  await page.mouse.up();
}

/** The left of panel `id`'s box. */
const boxX = async (page: Page, id: string) => (await page.locator(`[data-movable="${id}"]`).boundingBox())!.x;

/** Clicks the map at `at`, a stop's place for the tool that is out. */
async function clickAt(page: Page, at: readonly [number, number]) {
  const [x, y] = await toScreen(page, at);
  await page.mouse.click(x, y);
}

/** The route editor on Line 1, a stop added past Longwood, and saved while paused: Stop 5 is the route's last stop. */
async function savedPastLongwood(page: Page, panel: Locator) {
  await panel.getByRole('button', { name: 'Edit route' }).click();
  const editor = page.getByTestId('route-editor');
  await expect(editor).toBeVisible();
  await frames(page);
  await clickAt(page, PAST_LONGWOOD);
  await expect(editor).toHaveAttribute('data-price', /^[1-9]\d*$/, { timeout: 10_000 });
  await expect(editor).toHaveAttribute('data-refusal', '');
  await editor.getByRole('button', { name: 'Save route' }).click();
  await expect(editor).toHaveCount(0, { timeout: 10_000 });
  await expect(panel.getByTestId('line-stops').getByRole('button')).toHaveCount(DEBUG_STOPS.length + 1);
}

test.describe('what stays where the player left it', () => {
  test.skip(!city.sim, 'no sim file in this build yet');

  // A drag of the panel by its heading keeps the focus where it was (Panels), and so the hold (useHeldFocus): let go at the
  // press, the line card's hand-on, and the new line's card's, gave the page the focus, 9 runs of 9, where Space played.
  test('a drag of its panel keeps the keyboard’s control handed on, to the pick’s headway and to Cancel', async ({ page }) => {
    test.setTimeout(90_000);
    const panel = await lines(page, (d) => void Object.assign((d.lines as Record<string, unknown>[])[0]!, { buses: 4 }));
    const peak = panel.getByTestId('headway-peak');
    const change = panel.getByTestId('headway-change');
    await tabOnto(page, peak);
    await pickByKey(page, /^Every 30 min$/);
    await tabOnto(page, change.getByRole('button', { name: 'Run it' }));
    await page.keyboard.press('Enter');
    await expect(change).toHaveCount(0);
    await expect(page.getByTestId('undo')).toBeVisible();
    await expect(peak).toHaveText('Every 30 min');
    await pickByKey(page, /^Every 5 min$/);
    const buy = change.getByRole('button', { name: 'Buy and run' });
    await tabOnto(page, buy);
    await dragBy(page, panel, -150);
    await expect(buy).toBeFocused();
    await page.keyboard.press('Control+z');
    await expect(change).toHaveCount(0);
    await expect(peak).toBeFocused();
    // The new line's card, dragged with the keyboard on Remove last stop: Enter takes the only stop.
    await page.keyboard.press('Escape');
    await build(page, 'Draw a line');
    const draft = page.getByTestId('draft-card');
    await frames(page);
    await clickAt(page, DEBUG_STOPS[0]!.at);
    await expect(draft).toContainText('1 stop', { timeout: 10_000 });
    const remove = draft.getByRole('button', { name: 'Remove last stop' });
    await tabOnto(page, remove);
    await dragBy(page, draft, -150, 40);
    await expect(remove).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(remove).toBeDisabled();
    await expect(draft.getByRole('button', { name: 'Cancel' })).toBeFocused();
  });

  // Ctrl+Z, taking back the save the edit was made against, sets the editor's list to the line's again: it took Stop 5's row,
  // its × under the keyboard, and turned Save route off as the route became the line's own, and the focus fell to the page
  // each time, 9 runs of 9, where Space ran time behind the editor.
  test('the route editor hands on the row and Save route that Ctrl+Z takes from under the keyboard', async ({ page }) => {
    test.setTimeout(90_000);
    const panel = await lines(page);
    await savedPastLongwood(page, panel);
    await panel.getByRole('button', { name: 'Edit route' }).click();
    const editor = page.getByTestId('route-editor');
    await expect(editor.getByTestId('route-stop-4')).toHaveAttribute('data-stop', '5', { timeout: 10_000 });
    await tabOnto(page, editor.getByRole('button', { name: 'Remove Stop 5' }));
    await page.keyboard.press('Control+z');
    await expect(editor.getByTestId('route-stop-4')).toHaveCount(0, { timeout: 10_000 });
    await expect(editor.getByTestId('route-stop-3').getByRole('button', { name: /^Remove / })).toBeFocused();
    // Saved again, and Stop 5 moved up in the editor: Ctrl+Z makes the route the line's own, and Save route goes off.
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Lines', exact: true }).click();
    await savedPastLongwood(page, panel);
    await panel.getByRole('button', { name: 'Edit route' }).click();
    await expect(editor.getByTestId('route-stop-4')).toHaveAttribute('data-stop', '5', { timeout: 10_000 });
    await editor.getByRole('button', { name: 'Move Stop 5 up' }).click();
    const save = editor.getByRole('button', { name: 'Save route' });
    await expect(save).toBeEnabled({ timeout: 10_000 });
    await tabOnto(page, save);
    await page.keyboard.press('Control+z');
    await expect(editor.getByTestId('route-stop-4')).toHaveCount(0, { timeout: 10_000 });
    await expect(save).toBeDisabled();
    await expect(editor.getByRole('button', { name: 'Cancel' })).toBeFocused();
  });

  // The stop's card closes with its stop, and its opener, Stop 5's button in Lines' stops, goes with it: the walk back went on
  // to what opened Lines, the dock's Lines, while Lines stayed open, so the next Space closed Lines, 3 runs of 3.
  test('Ctrl+Z in a stop’s card opened from the stops row hands the focus to Lines, where Space plays', async ({ page }) => {
    test.setTimeout(90_000);
    const panel = await lines(page);
    await savedPastLongwood(page, panel);
    await tabOnto(page, panel.getByTestId('line-stops').getByRole('button').last());
    await page.keyboard.press('Enter');
    const card = page.getByTestId('stop-card');
    await expect(card).toBeVisible();
    await page.keyboard.press('Control+z');
    await expect(card).toHaveCount(0);
    await expect(page.locator('[data-movable="lines"]')).toBeFocused();
    await page.keyboard.press(' ');
    await expect(page.getByTestId('sim-panel')).not.toHaveAttribute('data-speed', '0');
    await expect(panel).toBeVisible();
  });

  // Remove last stop, turned off as it takes the only stop, hands the keyboard to Cancel (#187); Continue gave the new line's
  // card's box instead, 9 runs of 9, as the place it had recorded was turned off, not taken away.
  test('Continue follows the new line’s card’s hand-on to Cancel', async ({ page }) => {
    test.setTimeout(90_000);
    await game(page, (d) => void (d.clock.elapsed = CLOCK));
    await build(page, 'Draw a line');
    const draft = page.getByTestId('draft-card');
    await frames(page);
    await clickAt(page, DEBUG_STOPS[0]!.at);
    await expect(draft).toContainText('1 stop', { timeout: 10_000 });
    const remove = draft.getByRole('button', { name: 'Remove last stop' });
    await tabOnto(page, remove);
    await page.keyboard.press('2'); // 60×: the close in a game minute and a half
    const day = page.getByTestId('day-card');
    await expect(day).toBeVisible({ timeout: 30_000 });
    await expect(remove).toBeFocused();
    await page.keyboard.press('Backspace');
    await expect(remove).toBeDisabled();
    const cancel = draft.getByRole('button', { name: 'Cancel' });
    await expect(cancel).toBeFocused();
    await day.getByRole('button', { name: 'Continue' }).focus();
    await page.keyboard.press('Enter');
    await expect(day).toHaveCount(0);
    await expect(cancel).toBeFocused();
  });

  // A key's press that closes the panel it is in leaves where the panel was dragged to: the × of Finance dragged past the
  // window's right edge, pressed by Enter, brought Finance in as the press went, unseen, and it opened there next, 398 px from
  // where it was left (9 runs of 9). And Home on the first view tab, which moves to no other tab, moved Finance 115 px.
  test('a dragged panel stays where it was dragged for a key’s press that closes it, and for Home on its first tab', async ({ page }) => {
    const W = page.viewportSize()!.width;
    await game(page);
    const dock = page.getByRole('button', { name: 'Finance', exact: true });
    await dock.click();
    const finance = page.getByTestId('finance');
    await tabOnto(page, finance.getByRole('button', { name: 'Close', exact: true }));
    await dragBy(page, finance, W);
    const dragged = await boxX(page, 'finance');
    expect(dragged).toBeGreaterThan(W - 100);
    await page.keyboard.press('Enter');
    await expect(finance).toHaveCount(0);
    await dock.click();
    await expect(finance).toBeVisible();
    expect(await boxX(page, 'finance')).toBe(dragged);
    // The keyboard on Overview, the first view tab, brings Finance in as far as shows it; dragged out again, Home moves nothing.
    await tabOnto(page, finance.getByTestId('finance-overview'));
    await dragBy(page, finance, W);
    const parked = await boxX(page, 'finance');
    expect(parked).toBeGreaterThan(W - 100);
    await page.keyboard.press('Home');
    await frames(page);
    await expect(finance).toHaveAttribute('data-view', 'overview');
    expect(await boxX(page, 'finance')).toBe(parked);
  });

  // Close line's ask opens below the button that opens it: the reveal brought Lines in as far as showed Close line, and the
  // ask opened 67% on the window, whole only once Tab reached Close it (9 runs of 9). It shows whole as it opens now.
  test('Close line’s ask shows whole as Enter opens it in Lines dragged past the window’s edge', async ({ page }) => {
    const W = page.viewportSize()!.width;
    const panel = await lines(page);
    await tabOnto(page, panel.getByRole('button', { name: 'Close line' }));
    await dragBy(page, panel, W);
    expect(await boxX(page, 'lines')).toBeGreaterThan(W - 100);
    await page.keyboard.press('Enter');
    const ask = panel.getByTestId('close-line');
    await expect(ask).toBeVisible();
    const a = (await ask.boundingBox())!;
    expect(a.x).toBeGreaterThanOrEqual(0);
    expect(a.x + a.width).toBeLessThanOrEqual(W);
    await expect(panel.getByRole('button', { name: 'Close line' })).toBeFocused();
  });
});
