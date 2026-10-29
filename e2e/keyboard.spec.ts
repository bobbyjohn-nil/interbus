// The keyboard's focus as a card's button goes with its card (the accessibility pass, PLAN §8; useFocusBack). Keep as is,
// Sell them, Close line's Keep it and Close it took the focus with them, and it fell to the page, so a keyboard player
// started again from its top (the review of Close line). Each now hands it to the control the card came from, or, as a line
// closes, to the line shown in its place, and to Build once the last line has gone. Shown failing (TS-04) with the focus
// left where it fell; the undo's and the double presses' with their fixes taken out (the review of the hand-back).
// The keyboard's way to a stop and the hand-offs of a stop's, a contract's and a day's buttons are in focusback.spec.ts.
import { expect, test, type Locator, type Page } from './base';
import { DEBUG_STOPS } from '../src/sim/commands/debugLine';
import { foundCompany, leaveHome, STARTING_CENTS } from './found';
import { countSends, lines, press } from './keys';
import { build, city, frames, onDepotLand, toScreen, withDebugLine, zoomOutOnce, type SaveData } from './shell';

/** The debug line and `more` lines more on its stops, Line 2 on stops 1 and 2 and Line 3 on 2 and 3. */
const withLines = (more: 1 | 2) => (d: SaveData) => {
  const one = (d.lines as Record<string, unknown>[])[0]!;
  const extra = [{ ...one, id: 2, name: 'Line 2', stopIds: [1, 2] }, { ...one, id: 3, name: 'Line 3', stopIds: [2, 3] }];
  (d.lines as Record<string, unknown>[]).push(...extra.slice(0, more));
  d.nextIds = { ...d.nextIds, line: 2 + more };
};

/** The debug line every 20 minutes needs 2 Sparrows; this one has 4, 2 of them spare. */
const fourBuses = (d: SaveData) => void ((d.lines as { buses: number }[])[0]!.buses = 4);

/** Opens `list`, a Lines dropdown, from the keyboard, moves its pick with `key` and takes it. */
async function pickWith(page: Page, list: Locator, key: string) {
  await list.focus();
  await page.keyboard.press('ArrowDown');
  await page.getByRole('listbox').press(key);
  await page.getByRole('listbox').press('Enter');
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

  test('goes to the tab of a line an undo brings back, from the card it replaces', async ({ page }) => {
    // Two lines, Line 2 shown. Closing it shows Line 1's card, the focus on its Buses list; the undo brings Line 2 back, the line
    // the panel still names, so its card replaces Line 1's under the focus, which fell to the page (the review of the hand-back).
    const panel = await lines(page, withLines(1));
    await panel.getByRole('tab', { name: 'Line 2', exact: true }).click();
    await press(page, panel.getByRole('button', { name: 'Close line' }));
    await press(page, panel.getByTestId('close-line').getByRole('button', { name: 'Close it' }));
    await expect(panel.getByRole('tablist')).toHaveCount(0);
    await expect(panel.getByTestId('line-model')).toBeFocused();
    await page.keyboard.press('Control+z');
    const two = panel.getByRole('tab', { name: 'Line 2', exact: true });
    await expect(two).toHaveAttribute('aria-selected', 'true');
    await expect(two).toBeFocused();
  });

  test('goes to the tab of a line an undo brings back among three, from the tab shown in its place', async ({ page }) => {
    // Three lines, Line 2 shown. Closing it gives Line 1's tab the focus; the undo shows Line 2 again, and the focus stayed on
    // Line 1's tab, no longer chosen, so the arrows moved from Line 2 (the review of #156).
    const panel = await lines(page, withLines(2));
    await panel.getByRole('tab', { name: 'Line 2', exact: true }).click();
    await press(page, panel.getByRole('button', { name: 'Close line' }));
    await press(page, panel.getByTestId('close-line').getByRole('button', { name: 'Close it' }));
    await expect(panel.getByRole('tab', { name: 'Line 2', exact: true })).toHaveCount(0);
    await expect(panel.getByRole('tab', { name: 'Line 1', exact: true })).toBeFocused();
    await page.keyboard.press('Control+z');
    const two = panel.getByRole('tab', { name: 'Line 2', exact: true });
    await expect(two).toHaveAttribute('aria-selected', 'true');
    await expect(two).toBeFocused();
  });

  test('after the mouse’s Close it, an undo leaves the focus on the page, so Space plays', async ({ page }) => {
    // The mouse's: the undo's key gave the tab the focus as the keyboard's, so Space pressed the tab and the game stayed
    // paused (the review of #156).
    const panel = await lines(page, withLines(1));
    await panel.getByRole('tab', { name: 'Line 2', exact: true }).click();
    await panel.getByRole('button', { name: 'Close line' }).click();
    await panel.getByTestId('close-line').getByRole('button', { name: 'Close it' }).click();
    await expect(panel.getByRole('tablist')).toHaveCount(0);
    await page.keyboard.press('Control+z');
    await expect(panel.getByRole('tab', { name: 'Line 2', exact: true })).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press(' ');
    await expect(page.getByTestId('sim-panel')).not.toHaveAttribute('data-speed', '0');
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

  // A close that took the cash under a change's price turned its Buy and run off under the keyboard: the focus fell to the page,
  // where Space paused the game with the card up (the systems audit's sixteenth round). Refused, the button keeps the focus
  // now, and its name, described by the words why, as a stop's tier steps are, and Space presses nothing. Shown failing (TS-04)
  // on main, the focus on the page and the game paused; and named Run it, with no description (the round's review).
  test('a close that refuses the change the keyboard is on leaves the focus on its button, where Space presses nothing', async ({ page }) => {
    test.setTimeout(90_000);
    // The debug line's game a minute before day 2 closes, paused.
    const CLOCK = 86_400 + 18 * 3_600 + 59 * 60;
    const panel = await lines(page, (d) => void (d.clock.elapsed = CLOCK));
    const peak = panel.getByTestId('headway-peak');
    const change = panel.getByTestId('headway-change');
    /** Every 10 minutes in the peak, picked from the keyboard, the focus on the peak's button. */
    const every10 = async () => {
      await page.keyboard.press('ArrowDown');
      for (let k = 0; k < 12 && (await page.locator('.dropdown-option.active .dropdown-label').textContent()) !== 'Every 10 min'; k++) await page.keyboard.press('ArrowUp');
      await page.keyboard.press('Enter');
    };
    // Its price, read once.
    await peak.focus();
    await every10();
    const price = Number(/·\s*\$([\d.]+)k/.exec((await change.locator('p').textContent())!)![1]) * 100_000;
    await change.getByRole('button', { name: 'Keep as is' }).click();
    // Again, with the cash $20 over what the change may spend, the floor's $150k under it; the close takes more than $20.
    await withDebugLine(page, (d) => {
      d.clock.elapsed = CLOCK;
      const cash = (d.ledger as { amountCents: number }[]).reduce((sum, row) => sum + row.amountCents, 0);
      (d.ledger as Record<string, unknown>[]).push({ day: 2, kind: 'buses', amountCents: price - 15_000_000 + 2_000 - cash, lineId: null });
    });
    await expect(page.locator('[data-movable]')).toHaveCount(0);
    const dockLines = page.getByTestId('dock').getByRole('button', { name: 'Lines', exact: true });
    await dockLines.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    for (let k = 0; k < 40 && !(await peak.evaluate((el) => el === document.activeElement)); k++) await page.keyboard.press('Tab');
    await expect(peak).toBeFocused();
    await every10();
    await expect(change).toHaveAttribute('data-ok', 'yes');
    const buy = change.getByRole('button', { name: 'Buy and run' });
    for (let k = 0; k < 10 && !(await buy.evaluate((el) => el === document.activeElement)); k++) await page.keyboard.press('Tab');
    await expect(buy).toBeFocused();
    await page.keyboard.press('2'); // 60×: the close in a game minute
    await expect(page.getByTestId('day-card')).toBeVisible({ timeout: 30_000 });
    await expect(change).toHaveAttribute('data-ok', 'no');
    const button = change.getByRole('button', { name: 'Buy and run', exact: true });
    await expect(button).toBeFocused();
    await expect(button).toHaveAttribute('aria-disabled', 'true');
    await expect(button).toHaveAccessibleDescription(/^\$[\d,.]+ short$/);
    await page.keyboard.press(' ');
    await expect(page.getByTestId('sim-panel')).not.toHaveAttribute('data-speed', '0');
    await expect(change).toHaveAttribute('data-ok', 'no');
    await expect(button).toBeFocused();
  });
});

// A panel the keyboard opened hands the focus back to what opened it as it closes, by its Close or Escape, as a dialog does;
// and a stop's step up to the top its lines allow keeps the focus, refused in words. Both dropped it to the page (the reviews
// of the hand-back and the stop card's keys). Shown failing (TS-04) without the openers kept and with the step disabled.
test.describe('the focus as a panel closes, and on a step up to the top', () => {
  test.skip(!city.sim, 'no sim file in this build yet');

  /** The debug line's game, past Home, with nothing open. */
  async function game(page: Page, edit?: (data: SaveData) => void) {
    await page.goto('./');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await leaveHome(page);
    await foundCompany(page);
    await withDebugLine(page, edit);
  }

  /** Puts the keyboard on `button` as Tab would, so a panel it opens takes the focus (focusSource). */
  async function tabOnto(page: Page, button: Locator) {
    await button.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(button).toBeFocused();
  }

  test('Escape and a keyboard Close hand the focus back to the dock’s button; a mouse-opened panel’s Close leaves it on the page', async ({ page }) => {
    await game(page);
    const dock = page.getByTestId('dock');
    const dockLines = dock.getByRole('button', { name: 'Lines', exact: true });
    const lines = page.getByTestId('inspector');
    await tabOnto(page, dockLines);
    await page.keyboard.press('Enter');
    await expect(lines).toBeVisible();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Escape');
    await expect(lines).toHaveCount(0);
    await expect(dockLines).toBeFocused();

    const dockFinance = dock.getByRole('button', { name: 'Finance', exact: true });
    const finance = page.getByTestId('finance');
    await tabOnto(page, dockFinance);
    await page.keyboard.press('Enter');
    await expect(finance).toBeVisible();
    await press(page, finance.getByRole('button', { name: 'Close', exact: true }));
    await expect(finance).toHaveCount(0);
    await expect(dockFinance).toBeFocused();

    // By the mouse: nothing to go back to, so the page keeps it and Space plays.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await dockLines.click();
    await expect(lines).toBeVisible();
    await lines.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(lines).toHaveCount(0);
    await expect(dockLines).not.toBeFocused();
    await page.keyboard.press(' ');
    await expect(page.getByTestId('sim-panel')).not.toHaveAttribute('data-speed', '0');
  });

  test('a step up to the top its lines allow keeps the focus on the step, now refused in words', async ({ page }) => {
    const sent = await countSends(page);
    // Stop 2 a Shelter on one line, so a Station is its top.
    await game(page, (d) => void ((d.stops as { id: number; tier: number }[]).find((s) => s.id === 2)!.tier = 2));
    await page.getByRole('button', { name: 'Lines', exact: true }).click();
    await page.getByTestId('line-stops').getByRole('button', { name: 'Stop 2', exact: true }).click();
    const card = page.getByTestId('stop-card');
    await press(page, card.getByRole('button', { name: /^Make it a Station/ }));
    await expect(card).toHaveAttribute('data-tier', '3');
    expect(await sent('set-stop-tier')).toBe(1);
    const step = card.getByRole('button', { name: /^Make it an Interchange/ });
    await expect(step).toHaveAttribute('aria-disabled', 'true');
    await expect(step).toBeFocused();
    await expect(card).toContainText('Needs 3 lines stopping here');
    // Described by the words why, so a screen reader reached it hears them (the review of the systems audit's sixteenth round).
    await expect(step).toHaveAccessibleDescription(/^Needs 3 lines stopping here/);
    // A press on it sends nothing: the sim would refuse it too, so the count shows it (the review of #156).
    await page.keyboard.press('Enter');
    await expect(card).toHaveAttribute('data-tier', '3');
    expect(await sent('set-stop-tier')).toBe(1);
  });

  // A stop card's Remove from a line its rule refuses, as one that would leave the line under two stops, was disabled, so Ctrl+Z,
  // taking back the route edit that gave the line its third stop, turned it off under the keyboard, and the focus fell to the
  // page, where Space played (the systems audit's nineteenth round, 3 runs of 3 at each size). Refused, it keeps the focus,
  // aria-disabled and described by the words why, shown under it as the tier steps show theirs, and a press sends nothing.
  // Shown failing (TS-04) with the button disabled, and with the words read only aloud (the round's review: a title gave the
  // same description, so the check passed with the words gone).
  test('a stop card’s Remove from a line, refused as Ctrl+Z takes back the line’s third stop, keeps the focus, refused in words', async ({ page }) => {
    const sent = await countSends(page);
    // Line 1 on Stops 1 and 4 alone, and a stop added past Longwood, so Stop 4 can come off it until Ctrl+Z takes that back.
    await game(page, (d) => void Object.assign((d.lines as Record<string, unknown>[])[0]!, { stopIds: [1, 4] }));
    await page.getByRole('button', { name: 'Lines', exact: true }).click();
    const panel = page.getByTestId('inspector');
    await panel.getByRole('button', { name: 'Edit route' }).click();
    const editor = page.getByTestId('route-editor');
    await expect(editor).toBeVisible();
    await frames(page);
    const [x, y] = await toScreen(page, [-71.098, 42.346]); // past Longwood
    await page.mouse.click(x, y);
    await expect(editor).toHaveAttribute('data-price', /^[1-9]\d*$/, { timeout: 10_000 });
    await editor.getByRole('button', { name: 'Save route' }).click();
    await expect(editor).toHaveCount(0, { timeout: 10_000 });
    const stops = panel.getByTestId('line-stops').getByRole('button');
    await expect(stops).toHaveCount(3);
    await tabOnto(page, panel.getByTestId('line-stops').getByRole('button', { name: 'Stop 4' }));
    await page.keyboard.press('Enter');
    const card = page.getByTestId('stop-card');
    await expect(card).toBeVisible();
    const remove = card.getByRole('button', { name: /^Remove from Line 1/ });
    await tabOnto(page, remove);
    await page.keyboard.press('Control+z');
    await expect(stops).toHaveCount(2, { timeout: 10_000 });
    await frames(page);
    await expect(remove).toBeFocused();
    await expect(remove).toHaveAttribute('aria-disabled', 'true');
    await expect(remove).toHaveAccessibleDescription('A line keeps at least 2 stops');
    // Shown as a tier step's words are: read only aloud, they took a pixel.
    const why = card.getByText('A line keeps at least 2 stops');
    await expect(why).toBeVisible();
    expect((await why.boundingBox())!.height).toBeGreaterThanOrEqual(12);
    await page.keyboard.press(' ');
    await expect(page.getByTestId('sim-panel')).toHaveAttribute('data-speed', '0');
    await expect(remove).toBeFocused();
    expect(await sent('remove-stop')).toBe(0);
  });

  test('Escape closing a stop’s card and the Lines it was opened from hands the focus to the dock’s Lines', async ({ page }) => {
    // The stop card's opener, Stop 2 in Lines' stops, went with Lines; it fell to the page (the review of #156).
    await game(page);
    const dockLines = page.getByTestId('dock').getByRole('button', { name: 'Lines', exact: true });
    await tabOnto(page, dockLines);
    await page.keyboard.press('Enter');
    const stop2 = page.getByTestId('line-stops').getByRole('button', { name: 'Stop 2', exact: true });
    for (let k = 0; k < 40 && !(await stop2.evaluate((el) => el === document.activeElement)); k++) await page.keyboard.press('Tab');
    await expect(stop2).toBeFocused();
    await page.keyboard.press('Enter');
    const card = page.getByTestId('stop-card');
    await expect(card).toBeVisible();
    await expect.poll(() => card.evaluate((el) => el.parentElement === document.activeElement)).toBe(true);
    await page.keyboard.press('Escape');
    await expect(card).toHaveCount(0);
    await expect(page.getByTestId('inspector')).toHaveCount(0);
    await expect(dockLines).toBeFocused();
    // Round 10: the stop card's own line button showed Lines, open already, and made itself Lines' opener, so Escape went
    // round from Lines to the stop card and back to a gone button, and gave the page the focus.
    await page.keyboard.press('Enter');
    for (let k = 0; k < 40 && !(await stop2.evaluate((el) => el === document.activeElement)); k++) await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expect(card).toBeVisible();
    const line1 = card.getByRole('button', { name: 'Line 1', exact: true });
    for (let k = 0; k < 40 && !(await line1.evaluate((el) => el === document.activeElement)); k++) await page.keyboard.press('Tab');
    await expect(line1).toBeFocused();
    await page.keyboard.press('Enter');
    const lines = page.getByTestId('inspector');
    await expect.poll(() => lines.evaluate((el) => el.closest('[data-movable]') === document.activeElement)).toBe(true);
    await page.keyboard.press('Escape');
    await expect(card).toHaveCount(0);
    await expect(lines).toHaveCount(0);
    await expect(dockLines).toBeFocused();
  });

  /** Tabs on from where the focus is until `target` has it, as a keyboard player reaches it. */
  async function tabTo(page: Page, target: Locator) {
    for (let k = 0; k < 40 && !(await target.evaluate((el) => el === document.activeElement)); k++) await page.keyboard.press('Tab');
    await expect(target).toBeFocused();
  }

  // Round 10: the checklist's "5/5 Take a contract" opened Contracts, and Take it completes it, so the Contracts chip takes
  // its place: the opener gone, Escape gave the page the focus. What opens a panel now takes it (data-opens).
  test('Contracts opened from the checklist: after Take it, Escape gives the focus to the Contracts chip in its place', async ({ page }) => {
    await game(page);
    const checklist = page.getByTestId('checklist');
    await expect(checklist).toHaveJSProperty('tagName', 'BUTTON');
    await tabOnto(page, checklist);
    await page.keyboard.press('Enter');
    const contracts = page.getByTestId('contracts');
    await expect(contracts).toBeVisible();
    await tabTo(page, contracts.getByRole('button', { name: 'Take it' }).first());
    await page.keyboard.press('Enter');
    await expect(contracts.locator('[data-held="yes"]')).toHaveCount(1);
    const chip = page.getByTestId('contracts-chip');
    await expect(chip).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(contracts).toHaveCount(0);
    await expect(chip).toBeFocused();
  });

  // Round 10: the route editor stands in for Lines, which closes as it opens and comes back with its Cancel or Save route, and
  // the openers went with their panels: Escape from the editor, or from Lines after its Cancel, gave the page the focus. And its
  // × took the focus with its row, so the next Space ran time behind the editor.
  test('the route editor hands the focus on: from its ×, and from Escape, or from Lines after its Cancel, to the dock’s Lines', async ({ page }) => {
    const sent = await countSends(page);
    await game(page);
    const dockLines = page.getByRole('button', { name: 'Lines', exact: true });
    const lines = page.getByTestId('inspector');
    const editor = page.getByTestId('route-editor');
    await tabOnto(page, dockLines);
    await page.keyboard.press('Enter');
    await tabTo(page, lines.getByRole('button', { name: 'Edit route' }));
    await page.keyboard.press('Enter');
    await expect(editor).toBeVisible();
    const remove = editor.getByRole('button', { name: 'Remove Stop 2' });
    await tabTo(page, remove);
    await page.keyboard.press('Enter');
    await expect(remove).toHaveCount(0);
    await expect.poll(() => editor.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    // Space presses the × the focus went to, and runs no time: the page counts what it sends, as a check of the speed could
    // pass before the sim answered (the review of round 10).
    const speeds = await sent('speed');
    await page.keyboard.press(' ');
    expect(await sent('speed')).toBe(speeds);
    await page.keyboard.press('Escape');
    await expect(editor).toHaveCount(0);
    await expect(dockLines).toBeFocused();
    await page.keyboard.press('Enter');
    await tabTo(page, lines.getByRole('button', { name: 'Edit route' }));
    await page.keyboard.press('Enter');
    await expect(editor).toBeVisible();
    await tabTo(page, editor.getByRole('button', { name: 'Cancel' }));
    await page.keyboard.press('Enter');
    await expect(editor).toHaveCount(0);
    await expect(lines).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(lines).toHaveCount(0);
    await expect(dockLines).toBeFocused();

    // Every stop taken off from the keyboard, each × handing the focus to the next: the last left no row to hand it to, and
    // it fell to the page (the review of round 10). Cancel takes it, as Save route has nothing to save.
    await page.keyboard.press('Enter');
    await tabTo(page, lines.getByRole('button', { name: 'Edit route' }));
    await page.keyboard.press('Enter');
    await expect(editor).toBeVisible();
    await tabTo(page, editor.getByRole('button', { name: 'Remove Stop 1' }));
    for (const stop of [1, 2, 3, 4]) {
      await expect(editor.getByRole('button', { name: `Remove Stop ${stop}` })).toBeFocused();
      await page.keyboard.press('Enter');
    }
    await expect(editor.getByRole('listitem')).toHaveCount(0);
    await expect(editor.getByRole('button', { name: 'Cancel' })).toBeFocused();
  });

  /** Tabs back from where the focus is until `target` has it, as a keyboard player reaches it with Shift+Tab. */
  async function tabBackTo(page: Page, target: Locator) {
    for (let k = 0; k < 40 && !(await target.evaluate((el) => el === document.activeElement)); k++) await page.keyboard.press('Shift+Tab');
    await expect(target).toBeFocused();
  }

  // The review of round 10: a panel shown again from the keyboard while open kept what first opened it, so the stop card shown
  // again for Stop 3 from its row in Lines handed its Close back to Stop 2's row, and Lines shown again from the card's Line 1
  // handed its Close back to the dock's Lines, with the card still open.
  test('a panel shown again from the keyboard hands the focus back to what showed it last', async ({ page }) => {
    await game(page);
    const dockLines = page.getByTestId('dock').getByRole('button', { name: 'Lines', exact: true });
    await tabOnto(page, dockLines);
    await page.keyboard.press('Enter');
    const lines = page.getByTestId('inspector');
    const stops = page.getByTestId('line-stops');
    await tabTo(page, stops.getByRole('button', { name: 'Stop 2', exact: true }));
    await page.keyboard.press('Enter');
    const card = page.getByTestId('stop-card');
    await expect(card).toHaveAttribute('aria-label', 'Stop 2');
    const stop3 = stops.getByRole('button', { name: 'Stop 3', exact: true });
    await tabBackTo(page, stop3);
    await page.keyboard.press('Enter');
    await expect(card).toHaveAttribute('aria-label', 'Stop 3');
    await tabTo(page, card.getByRole('button', { name: 'Close', exact: true }));
    await page.keyboard.press('Enter');
    await expect(card).toHaveCount(0);
    await expect(stop3).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(card).toHaveAttribute('aria-label', 'Stop 3');
    const line1 = card.getByRole('button', { name: 'Line 1', exact: true });
    await tabTo(page, line1);
    await page.keyboard.press('Enter');
    await expect.poll(() => lines.evaluate((el) => el.closest('[data-movable]') === document.activeElement)).toBe(true);
    await tabTo(page, lines.getByRole('button', { name: 'Close', exact: true }));
    await page.keyboard.press('Enter');
    await expect(lines).toHaveCount(0);
    await expect(card).toBeVisible();
    await expect(line1).toBeFocused();
  });

  // Round 11: Saves the keyboard opened from Home stays open into the game, and takes the focus as Continue goes, with no opener
  // left: its Escape gave the page the focus, though the Saves chip opens it.
  test('Saves kept open from Home into the game hands the focus to the Saves chip as it closes', async ({ page }) => {
    await page.goto('./');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(page);
    await page.getByTestId('saves-chip').click();
    await page.getByTestId('saves').getByRole('button', { name: 'Back to Home' }).click();
    const home = page.getByTestId('home');
    await expect(home).toBeVisible();
    await tabOnto(page, home.getByTestId('home-saves'));
    await page.keyboard.press('Enter');
    const saves = page.getByTestId('saves');
    await expect(saves).toBeVisible();
    await tabOnto(page, home.getByTestId('home-continue'));
    await page.keyboard.press('Enter');
    await expect(home).toHaveCount(0);
    await expect.poll(() => saves.evaluate((el) => el.closest('[data-movable]')!.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(saves).toHaveCount(0);
    await expect(page.getByTestId('saves-chip')).toBeFocused();
  });

  // The review of round 10: Help opened with ? from Lines' box took the box as its opener, which stops taking the focus once it
  // has let it go, so closing Help gave the page the focus. The box takes it back, and Tab goes on inside Lines.
  test('Help opened with ? over a panel the keyboard opened gives that panel the focus back as it closes', async ({ page }) => {
    await game(page);
    const dockLines = page.getByTestId('dock').getByRole('button', { name: 'Lines', exact: true });
    await tabOnto(page, dockLines);
    await page.keyboard.press('Enter');
    const lines = page.getByTestId('inspector');
    const inLines = () => lines.evaluate((el) => el.closest('[data-movable]')!.contains(document.activeElement));
    await expect.poll(inLines).toBe(true);
    const help = page.getByTestId('help');
    for (const close of ['?', 'its Close']) {
      await page.keyboard.press('?');
      await expect(help).toBeVisible();
      if (close === '?') await page.keyboard.press('?');
      else await press(page, help.getByRole('button', { name: 'Close', exact: true }));
      await expect(help).toHaveCount(0);
      await expect.poll(inLines, `closed with ${close}`).toBe(true);
    }
    await page.keyboard.press('Tab');
    await expect(lines.getByRole('button', { name: 'Close', exact: true })).toBeFocused();
    // Help opened afresh from the page hands the focus back to the page, so Space plays: it kept the earlier Help's opener,
    // and gave the focus to the dock's Lines (the review of round 11).
    await page.keyboard.press('Escape');
    await expect(lines).toHaveCount(0);
    await tabOnto(page, page.getByTestId('build'));
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('build-menu').getByRole('button', { name: 'Place a stop' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('build-menu')).toHaveCount(0);
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
    await page.keyboard.press('?');
    await expect(help).toBeVisible();
    await page.keyboard.press('?');
    await expect(help).toHaveCount(0);
    expect(await page.evaluate(() => document.activeElement === document.body), 'the focus on the page').toBe(true);
  });

  // Round 10: an open list kept ? from the game (the review of #157) but not its other keys: T tilted the map behind it, and 2
  // picked 60× under the speed list, which stayed open, so its Enter then picked the old speed again.
  test('an open list keeps T and the number keys, as it keeps ?', async ({ page }) => {
    const sent = await countSends(page);
    await page.goto('./?gpu=full'); // in Low graphics T says the map stays flat instead
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(page);
    const map = page.getByTestId('map');
    await page.getByTestId('speed-menu').focus();
    await page.keyboard.press('ArrowDown');
    const list = page.getByRole('listbox');
    await expect(list).toBeVisible();
    const speeds = await sent('speed');
    await page.keyboard.press('t');
    await page.keyboard.press('2');
    await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done(null)))));
    await expect(list).toBeVisible();
    expect(await map.getAttribute('data-mode')).toBe('2d');
    // Counted as sent, as the speed shown could still read 0 before the sim answered one (the review of round 10).
    expect(await sent('speed')).toBe(speeds);
    // So does the Build menu, the keyboard on its tools: T tilted the map behind it and 2 picked 60× (round 11).
    await page.keyboard.press('Escape');
    await expect(list).toHaveCount(0);
    await page.getByTestId('build').focus();
    await page.keyboard.press('Enter');
    const menu = page.getByTestId('build-menu');
    await page.keyboard.press('Tab');
    await expect(menu.getByRole('button', { name: 'Place a stop' })).toBeFocused();
    await page.keyboard.press('t');
    await page.keyboard.press('2');
    await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done(null)))));
    await expect(menu).toBeVisible();
    expect(await map.getAttribute('data-mode')).toBe('2d');
    expect(await sent('speed')).toBe(speeds);
  });
});
