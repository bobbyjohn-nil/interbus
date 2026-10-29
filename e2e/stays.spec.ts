// What stays where the player left it (the systems audit's eighteenth round, its first lane, on #187's fixes): the control the
// keyboard is on, handed on as it goes from under the keyboard, and a dragged panel's place. A drag of a panel by its heading
// let the hold go though the focus stayed, so the hand-on gave the page the focus; Ctrl+Z took the route editor's rows and
// Save route from under the keyboard, and a stop's card's Ctrl+Z gave the dock's Lines the focus, where Space closed Lines;
// Continue gave the new line's card's box where the card had handed the keyboard to Cancel; a key's press that closed a
// dragged panel moved where it opened next; Close line's ask opened two thirds on the window; and Home on the first view tab
// moved the panel. Then the round's review: Save route pressed by Enter gave Cancel the keyboard while its save was on its way,
// a press on the route editor's words could hand the focus back to a row's button, and a press that closed its panel only
// once the sim answered still moved where it opened next. And the nineteenth round's first lane, on #188's fixes: Create and
// Save route, turned off by their own press until the sim answered, gave the page the focus, so a Create Ctrl+Z took back left
// the keyboard on the page, and a day's card's Continue after either did not follow it to Lines; and Save route, reached by Tab
// and pressed by the mouse, took the focus back as Ctrl+Z took its save back, so Space saved again. Then its review: Create,
// kept on under the keyboard, bought a second line for a second press just as its line landed, and a control Tab reached and
// the mouse then pressed stayed the keyboard's, so a later hand-on gave the next control Space. Each shown failing (TS-04)
// with its fix taken out.
import { expect, test, type Locator, type Page } from './base';
import { DEBUG_STOPS } from '../src/sim/commands/debugLine';
import { foundCompany, leaveHome } from './found';
import { countSends, lines } from './keys';
import { build, city, frames, holdAnswers, toScreen, withDebugLine, type SaveData } from './shell';

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

/** The route editor open on Line 1 from Lines (`panel`), with a stop added past Longwood: Save route is on. */
async function editedPastLongwood(page: Page, panel: Locator) {
  await panel.getByRole('button', { name: 'Edit route' }).click();
  const editor = page.getByTestId('route-editor');
  await expect(editor).toBeVisible();
  await frames(page);
  await clickAt(page, PAST_LONGWOOD);
  await expect(editor).toHaveAttribute('data-price', /^[1-9]\d*$/, { timeout: 10_000 });
  await expect(editor).toHaveAttribute('data-refusal', '');
  return editor;
}

/** As editedPastLongwood, and saved while paused: Stop 5 is the route's last stop. */
async function savedPastLongwood(page: Page, panel: Locator) {
  const editor = await editedPastLongwood(page, panel);
  await editor.getByRole('button', { name: 'Save route' }).click();
  await expect(editor).toHaveCount(0, { timeout: 10_000 });
  await expect(panel.getByTestId('line-stops').getByRole('button')).toHaveCount(DEBUG_STOPS.length + 1);
}

/**
 * The keyboard on `button`, the close come at 60× and `button` pressed by Enter there: once `card` has gone and Lines has the
 * focus, Continue, pressed from the keyboard with time paused, gives the focus back to Lines.
 */
async function continuedAfterThePress(page: Page, button: Locator, card: Locator) {
  const day = page.getByTestId('day-card');
  const box = page.locator('[data-movable="lines"]');
  await tabOnto(page, button);
  await page.keyboard.press('2'); // 60×: the close in a game minute and a half
  await expect(day).toBeVisible({ timeout: 30_000 });
  await expect(button).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(card).toHaveCount(0, { timeout: 10_000 });
  await expect(box).toBeFocused();
  await page.keyboard.press(' '); // paused, so nothing else moves
  await expect(page.getByTestId('sim-panel')).toHaveAttribute('data-speed', '0');
  await day.getByRole('button', { name: 'Continue' }).focus();
  await page.keyboard.press('Enter');
  await expect(day).toHaveCount(0);
  await frames(page);
  await expect(box).toBeFocused();
}

/** Holds the sim's answers back (holdAnswers, added before the page loads) until release. */
const hold = (page: Page) => page.evaluate(() => void ((window as unknown as { held: unknown[] }).held = []));
/** How many snapshots the sim has answered with while held. */
const heldSnapshots = (page: Page) => page.evaluate(() => ((window as unknown as { held: [unknown, string][] | null }).held ?? []).filter(([, type]) => type === 'snapshot').length);
/** Hands the page the answers held, in one task. */
const release = (page: Page) => page.evaluate(() => (window as unknown as { release: () => void }).release());

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

  // Save route and Create pressed from the keyboard while a day's card shows turned themselves off until the sim answered, and
  // Chrome took the focus from them, so the card's place for the keyboard stayed on the button gone: as the save or the line
  // landed and Lines took the focus, Continue gave the dock's Lines, where the next Space closed Lines, or Build (the systems
  // audit's nineteenth round, 3 runs of 3 at each of three sizes). Each keeps the focus until its answer now, aria-disabled,
  // so Continue follows the hand-on to Lines, as it follows Cancel's. Shown failing (TS-04) with each disabled on its way.
  test('Continue follows the keyboard to Lines from a Save route pressed while a day’s card shows', async ({ page }) => {
    test.setTimeout(90_000);
    await game(page, (d) => void (d.clock.elapsed = CLOCK));
    // The route editor opened from the keyboard, a stop clicked past Longwood.
    await page.getByRole('button', { name: 'Lines', exact: true }).click();
    await tabOnto(page, page.getByTestId('inspector').getByRole('button', { name: 'Edit route' }));
    await page.keyboard.press('Enter');
    const editor = page.getByTestId('route-editor');
    await expect(editor).toBeVisible();
    await frames(page);
    await clickAt(page, PAST_LONGWOOD);
    await expect(editor).toHaveAttribute('data-price', /^[1-9]\d*$/, { timeout: 10_000 });
    await continuedAfterThePress(page, editor.getByRole('button', { name: 'Save route' }), editor);
  });

  test('Continue follows the keyboard to Lines from a Create pressed while a day’s card shows', async ({ page }) => {
    test.setTimeout(90_000);
    await game(page, (d) => void (d.clock.elapsed = CLOCK));
    await build(page, 'Draw a line');
    const draft = page.getByTestId('draft-card');
    await frames(page);
    for (const stop of DEBUG_STOPS.slice(0, 2)) await clickAt(page, stop.at);
    await expect(draft).toContainText('2 stops', { timeout: 10_000 });
    await expect(draft).toHaveAttribute('data-refusal', '', { timeout: 10_000 });
    await continuedAfterThePress(page, draft.getByRole('button', { name: 'Create' }), draft);
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

  // Save route turns off while its save is on its way, which the hand-on took for a control turned off under the keyboard: it
  // gave Cancel the focus, so a second Enter before the sim's answer closed the editor on the old route, and the save landed
  // after it (the round's review, 3 runs of 3). On again, as a save Ctrl+Z takes back leaves it, Save route has the keyboard
  // back, unless a press went elsewhere meanwhile. And a press on the editor's words, which focuses nothing, lets the hold go
  // before the editor draws again: let go a task after the press, a draw between, here the sim's answers handed over as the
  // press takes the focus, gave Stop 2's × the focus back, where Enter takes the stop off.
  test('Save route by Enter keeps the keyboard through its save, and a press on the editor’s words leaves it to the page', async ({ page }) => {
    test.setTimeout(90_000);
    await page.addInitScript(holdAnswers);
    const panel = await lines(page);
    const editor = await editedPastLongwood(page, panel);
    const save = editor.getByRole('button', { name: 'Save route' });
    await tabOnto(page, save);
    await hold(page);
    await page.keyboard.press('Enter');
    await expect(save).toBeDisabled();
    await frames(page);
    await expect(editor.getByRole('button', { name: 'Cancel' })).not.toBeFocused();
    await page.keyboard.press('Enter');
    await frames(page);
    await expect(editor).toBeVisible();
    // Ctrl+Z before the answer takes the save back: both answered together, the editor stays open on the edit.
    await page.keyboard.press('Control+z');
    await expect.poll(() => heldSnapshots(page)).toBe(2);
    await release(page);
    await expect(save).toBeEnabled({ timeout: 10_000 });
    await expect(save).toBeFocused();
    // Pressed again, and a press on the editor's hint before the answer, the player gone on: back on, Save route has it not.
    await hold(page);
    await page.keyboard.press('Enter');
    await expect(save).toBeDisabled();
    await frames(page);
    await editor.locator('p.hint').click();
    await page.keyboard.press('Control+z');
    await expect.poll(() => heldSnapshots(page)).toBe(2);
    await release(page);
    await expect(save).toBeEnabled({ timeout: 10_000 });
    await frames(page);
    expect(await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.tagName)).toBe('BODY');
    await save.click();
    await expect(editor).toHaveCount(0, { timeout: 10_000 });
    await expect(panel.getByTestId('line-stops').getByRole('button')).toHaveCount(DEBUG_STOPS.length + 1);
    // The keyboard on Stop 2's ×, time asked to run, and its answers handed over as a press on the editor's hint takes the focus.
    await panel.getByRole('button', { name: 'Edit route' }).click();
    await expect(editor.getByTestId('route-stop-4')).toHaveAttribute('data-stop', '5', { timeout: 10_000 });
    await tabOnto(page, editor.getByRole('button', { name: 'Remove Stop 2' }));
    await hold(page);
    await page.keyboard.press('1');
    await expect.poll(() => heldSnapshots(page)).toBeGreaterThan(0);
    await page.evaluate(() => document.addEventListener('focusout', () => (window as unknown as { release: () => void }).release(), { once: true }));
    await editor.locator('p.hint').click();
    const speed = page.getByTestId('sim-panel');
    await expect(speed).not.toHaveAttribute('data-speed', '0');
    expect(await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.tagName)).toBe('BODY');
    await page.keyboard.press(' ');
    await expect(speed).toHaveAttribute('data-speed', '0');
    await expect(editor.getByRole('listitem')).toHaveCount(DEBUG_STOPS.length + 1);
  });

  // Create, pressed from the keyboard, turned itself off until the sim answered, and Chrome took the focus from it: Ctrl+Z,
  // taking the line back before the answer, both answered together, left the card open, Create on again and the focus on the
  // page, where Space played (the systems audit's nineteenth round, by Enter and by Space, 3 runs of 3 at each of three sizes).
  // It keeps the focus while its line is on its way now, aria-disabled, as Save route does. Shown failing (TS-04) with Create
  // disabled on its way.
  test('Create by Enter keeps the keyboard through its line taken back by Ctrl+Z', async ({ page }) => {
    test.setTimeout(90_000);
    await page.addInitScript(holdAnswers);
    await game(page);
    await build(page, 'Draw a line');
    const draft = page.getByTestId('draft-card');
    await frames(page);
    for (const stop of DEBUG_STOPS.slice(0, 2)) await clickAt(page, stop.at);
    await expect(draft).toContainText('2 stops', { timeout: 10_000 });
    await expect(draft).toHaveAttribute('data-refusal', '', { timeout: 10_000 });
    const create = draft.getByRole('button', { name: 'Create' });
    await tabOnto(page, create);
    await hold(page);
    await page.keyboard.press('Enter');
    await expect(create).toBeDisabled();
    await page.keyboard.press('Control+z');
    await expect.poll(() => heldSnapshots(page)).toBe(2);
    await release(page);
    await expect(create).toBeEnabled({ timeout: 10_000 });
    await frames(page);
    await expect(create).toBeFocused();
    // From the keyboard still, Space buys the line, time standing still.
    await page.keyboard.press(' ');
    await expect(draft).toHaveCount(0, { timeout: 10_000 });
    await expect(page.getByTestId('sim-panel')).toHaveAttribute('data-speed', '0');
  });

  // Let go as its line stood, Create was on again under the keyboard for the render before App closed its card, so a second
  // Enter, or Space's keyup, bought a second line: 2 times in 123 on the pacing run's late company, the second Enter 176 and
  // 180 ms after the first (the review of the nineteenth round's fixes). It waits until its card closes now. Here the CPU runs
  // 20 times slower as the answer lands, so the answer's render outlasts a task and the card closes in a later one, as on that
  // company, and the page presses Create the moment it comes on again with its card open. Shown failing (TS-04) with Create let
  // go as its line stood: that press bought Line 3.
  test('Create by Enter waits for its card to close, so a press as its line lands buys no second line', async ({ page }) => {
    test.setTimeout(90_000);
    const sent = await countSends(page);
    await page.addInitScript(holdAnswers);
    await page.addInitScript(() => {
      const w = window as unknown as { pressOnAgain: boolean; pressedOnAgain: number };
      w.pressOnAgain = false;
      w.pressedOnAgain = 0;
      new MutationObserver(() => {
        if (!w.pressOnAgain) return;
        const create = [...document.querySelectorAll<HTMLButtonElement>('[data-testid="draft-card"] button')].find((b) => b.textContent?.trim() === 'Create');
        if (!create || create.disabled || create.getAttribute('aria-disabled') === 'true') return;
        w.pressOnAgain = false;
        w.pressedOnAgain++;
        create.click();
      }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-disabled', 'disabled'] });
    });
    await game(page);
    await build(page, 'Draw a line');
    const draft = page.getByTestId('draft-card');
    await frames(page);
    for (const stop of DEBUG_STOPS.slice(0, 2)) await clickAt(page, stop.at);
    await expect(draft).toContainText('2 stops', { timeout: 10_000 });
    await expect(draft).toHaveAttribute('data-refusal', '', { timeout: 10_000 });
    const create = draft.getByRole('button', { name: 'Create' });
    await tabOnto(page, create);
    await hold(page);
    await page.keyboard.press('Enter');
    await expect(create).toBeDisabled();
    await expect.poll(() => heldSnapshots(page)).toBeGreaterThan(0);
    await page.evaluate(() => void ((window as unknown as { pressOnAgain: boolean }).pressOnAgain = true));
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 20 });
    await release(page);
    await expect(draft).toHaveCount(0, { timeout: 30_000 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await expect(page.getByTestId('line-card')).toHaveAttribute('data-line', '2', { timeout: 10_000 });
    await page.waitForTimeout(500);
    expect(await sent('create-line')).toBe(1);
    await expect(page.getByTestId('undo')).toHaveText('Undo: Create Line 2');
    expect(await page.evaluate(() => (window as unknown as { pressedOnAgain: number }).pressedOnAgain)).toBe(0);
  });

  // A control Tab reached and the mouse then pressed stayed the keyboard's, the focus staying put, so a later hand-on gave the
  // next control the focus, ringed, and Space pressed it: Create, then Backspace twice taking its stops, gave Cancel the focus,
  // and Space closed the card, time still (the review of the nineteenth round's fixes, 3 runs of 3, on main as well), where
  // after the mouse alone the page keeps the focus and Space plays. The mouse's press lets the hold go (useHeldFocus). Shown
  // failing (TS-04) with it kept: Cancel had the focus.
  test('Create reached by Tab and pressed by the mouse leaves Space to the game as Backspace later takes its stops', async ({ page }) => {
    test.setTimeout(90_000);
    await page.addInitScript(holdAnswers);
    await game(page);
    await build(page, 'Draw a line');
    const draft = page.getByTestId('draft-card');
    await frames(page);
    for (const stop of DEBUG_STOPS.slice(0, 2)) await clickAt(page, stop.at);
    await expect(draft).toContainText('2 stops', { timeout: 10_000 });
    await expect(draft).toHaveAttribute('data-refusal', '', { timeout: 10_000 });
    const create = draft.getByRole('button', { name: 'Create' });
    await tabOnto(page, create);
    await hold(page);
    await create.click();
    await expect(create).toBeDisabled();
    await page.keyboard.press('Control+z');
    await expect.poll(() => heldSnapshots(page)).toBe(2);
    await release(page);
    await expect(create).toBeEnabled({ timeout: 10_000 });
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Backspace');
    await expect(draft.getByRole('button', { name: 'Remove last stop' })).toBeDisabled({ timeout: 10_000 });
    await frames(page);
    await expect(draft.getByRole('button', { name: 'Cancel' })).not.toBeFocused();
    await page.keyboard.press(' ');
    await expect(page.getByTestId('sim-panel')).not.toHaveAttribute('data-speed', '0');
    await expect(draft).toBeVisible();
  });

  // The same with Save route: reached by Tab, pressed by the mouse and its save taken back, then a second Ctrl+Z, taking back
  // the save before it, turned it off, and its hand-on gave Cancel the focus, where Space closed the editor (the review of the
  // nineteenth round's fixes, 3 runs of 3). Shown failing (TS-04) with the mouse's press keeping the hold.
  test('Save route reached by Tab and pressed by the mouse leaves Space to the game as a later Ctrl+Z turns it off', async ({ page }) => {
    test.setTimeout(90_000);
    await page.addInitScript(holdAnswers);
    const panel = await lines(page);
    await savedPastLongwood(page, panel);
    await panel.getByRole('button', { name: 'Edit route' }).click();
    const editor = page.getByTestId('route-editor');
    await expect(editor.getByTestId('route-stop-4')).toHaveAttribute('data-stop', '5', { timeout: 10_000 });
    await editor.getByRole('button', { name: 'Move Stop 5 up' }).click();
    const save = editor.getByRole('button', { name: 'Save route' });
    await expect(save).toBeEnabled({ timeout: 10_000 });
    await expect(editor).toHaveAttribute('data-refusal', '', { timeout: 10_000 });
    await tabOnto(page, save);
    await hold(page);
    await save.click();
    await expect(save).toBeDisabled();
    await page.keyboard.press('Control+z');
    await expect.poll(() => heldSnapshots(page)).toBe(2);
    await release(page);
    await expect(save).toBeEnabled({ timeout: 10_000 });
    // Ctrl+Z again takes back the save past Longwood: Stop 5 leaves the list, and Save route turns off.
    await page.keyboard.press('Control+z');
    await expect(editor.getByTestId('route-stop-4')).toHaveCount(0, { timeout: 10_000 });
    await expect(save).toBeDisabled({ timeout: 10_000 });
    await frames(page);
    await expect(editor.getByRole('button', { name: 'Cancel' })).not.toBeFocused();
    await page.keyboard.press(' ');
    await expect(page.getByTestId('sim-panel')).not.toHaveAttribute('data-speed', '0');
    await expect(editor).toBeVisible();
  });

  // Save route reached by Tab and then pressed by the mouse stayed the keyboard's: as Ctrl+Z took its save back before the
  // answer, it took the focus back, ringed, and the next Space pressed it, a second save closing the editor, time still (the
  // systems audit's nineteenth round, 3 runs of 3 at each of three sizes), where after the mouse alone Space plays. Keeping the
  // focus through its save, it takes none back, and the mouse's press leaves Space to the game. Shown failing (TS-04) with
  // Save route disabled on its way.
  test('Save route reached by Tab and pressed by the mouse leaves Space to the game through its save taken back', async ({ page }) => {
    test.setTimeout(90_000);
    await page.addInitScript(holdAnswers);
    const panel = await lines(page);
    const editor = await editedPastLongwood(page, panel);
    const save = editor.getByRole('button', { name: 'Save route' });
    await tabOnto(page, save);
    await hold(page);
    await save.click();
    await expect(save).toBeDisabled();
    await page.keyboard.press('Control+z');
    await expect.poll(() => heldSnapshots(page)).toBe(2);
    await release(page);
    await expect(save).toBeEnabled({ timeout: 10_000 });
    await frames(page);
    await page.keyboard.press(' ');
    await expect(page.getByTestId('sim-panel')).not.toHaveAttribute('data-speed', '0');
    await expect(editor).toBeVisible();
  });

  // A key's press that closes its panel once the sim answers, as Save route and Create do, left the place the press brought
  // the panel in to, as on main: dragged to x 1104 of 1152, the route editor opened next at 1045 and the new line's card at
  // 1066 (the round's review, 3 runs of 3).
  test('a dragged panel a key’s press closes as the sim answers opens where it was dragged: Save route and Create', async ({ page }) => {
    test.setTimeout(90_000);
    const W = page.viewportSize()!.width;
    const panel = await lines(page);
    const editor = await editedPastLongwood(page, panel);
    await tabOnto(page, editor.getByRole('button', { name: 'Save route' }));
    await dragBy(page, editor, W);
    const dragged = await boxX(page, 'route');
    expect(dragged).toBeGreaterThan(W - 100);
    await page.keyboard.press('Enter');
    await expect(editor).toHaveCount(0, { timeout: 10_000 });
    await expect(panel.getByTestId('line-stops').getByRole('button')).toHaveCount(DEBUG_STOPS.length + 1);
    await panel.getByRole('button', { name: 'Edit route' }).click();
    await expect(editor).toBeVisible();
    expect(await boxX(page, 'route')).toBe(dragged);
    // The new line's card, dragged with the keyboard on Create.
    await page.keyboard.press('Escape');
    await build(page, 'Draw a line');
    const draft = page.getByTestId('draft-card');
    await frames(page);
    for (const stop of DEBUG_STOPS.slice(0, 2)) await clickAt(page, stop.at);
    await expect(draft).toContainText('2 stops', { timeout: 10_000 });
    await expect(draft).toHaveAttribute('data-refusal', '', { timeout: 10_000 });
    await tabOnto(page, draft.getByRole('button', { name: 'Create' }));
    await dragBy(page, draft, W);
    const card = await boxX(page, 'tool');
    expect(card).toBeGreaterThan(W - 100);
    await page.keyboard.press('Enter');
    await expect(draft).toHaveCount(0, { timeout: 10_000 });
    await page.keyboard.press('Escape');
    await build(page, 'Draw a line');
    await expect(draft).toBeVisible();
    expect(await boxX(page, 'tool')).toBe(card);
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
