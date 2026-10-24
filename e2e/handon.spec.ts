// The keyboard's focus where the control it is on goes from under it, or turns itself off, by something other than a press that
// hands the focus on (the systems audit's seventeenth round): Sell it as a close's snow needs its bus, a change card's button as
// Ctrl+Z takes back the change it was picked against, Remove last stop as it takes the last stop, the Undo chip as its undo is
// done or time runs, and the Contracts chip as Ctrl+Z turns it back into the checklist's last step. Each time the focus fell to
// the page, where Space ran the game or stopped it. And Continue on a midnight's card gave the focus to Pause, pressed by the
// mouse to close the list the keyboard was in as the card showed. Shown failing (TS-04) on main, each with the focus on the page,
// and Continue's on Pause.
import { expect, test, type Locator, type Page } from './base';
import { DEBUG_STOPS } from '../src/sim/commands/debugLine';
import { foundCompany, leaveHome } from './found';
import { lines } from './keys';
import { build, city, frames, toScreen, withDebugLine, type SaveData } from './shell';

/** The debug line's game, edited by `edit`, past Home, with nothing open. */
async function game(page: Page, edit?: (data: SaveData) => void) {
  await page.goto('./');
  await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
  await leaveHome(page);
  await foundCompany(page);
  await withDebugLine(page, edit);
}

/** Opens the list of the dropdown the keyboard is on and picks the option `label` names, from the keyboard. */
async function pickByKey(page: Page, label: RegExp) {
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Home');
  for (let k = 0; k < 16 && !label.test((await page.locator('.dropdown-option.active .dropdown-label').textContent()) ?? ''); k++) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
}

/** Focuses `el` as the keyboard does: from the control before it, by Tab. */
async function tabOnto(page: Page, el: Locator) {
  await el.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(el).toBeFocused();
}

test.describe('the focus where the control it is on goes from under it', () => {
  test.skip(!city.sim, 'no sim file in this build yet');

  test('Sell it, gone as the close’s snow needs its bus, hands the focus to the Buses list', async ({ page }) => {
    test.setTimeout(90_000);
    // Every 15 min on 3 Sparrows, 2 needed and 1 spare, a minute and a half before day 2 closes; snow on day 3, which needs all 3.
    const panel = await lines(page, (d) => {
      d.clock.elapsed = 86_400 + 18 * 3_600 + 58 * 60 + 30;
      Object.assign((d.lines as Record<string, unknown>[])[0]!, { headways: { peak: 900, offpeak: 900, overnight: null }, buses: 3 });
      (d as Record<string, unknown>).event = { kind: 'snow', startDay: 3, endDay: 3, street: '', edges: [], at: null };
    });
    const spares = panel.getByTestId('line-spares');
    await tabOnto(page, spares.getByRole('button'));
    await page.keyboard.press('2'); // 60×: the close in a game minute and a half
    await expect(page.getByTestId('day-card')).toBeVisible({ timeout: 30_000 });
    await expect(spares).toHaveCount(0);
    await expect(panel.getByTestId('line-model')).toBeFocused();
  });

  test('a change card’s button, gone as Ctrl+Z takes back what its pick was made against, hands the focus to the pick', async ({ page }) => {
    test.setTimeout(90_000);
    const panel = await lines(page, (d) => void Object.assign((d.lines as Record<string, unknown>[])[0]!, { buses: 4 }));
    const peak = panel.getByTestId('headway-peak');
    const change = panel.getByTestId('headway-change');
    // Every 30 min at peak, run: a command taken paused, which Ctrl+Z takes back.
    await tabOnto(page, peak);
    await pickByKey(page, /^Every 30 min$/);
    await tabOnto(page, change.getByRole('button', { name: 'Run it' }));
    await page.keyboard.press('Enter');
    await expect(change).toHaveCount(0);
    await expect(peak).toBeFocused();
    await expect(page.getByTestId('undo')).toBeVisible();
    await expect(peak).toHaveText('Every 30 min');
    // Every 5 min picked on the line as it runs now, the keyboard on Buy and run: Ctrl+Z takes back every 30, and the pick goes.
    await pickByKey(page, /^Every 5 min$/);
    await tabOnto(page, change.getByRole('button', { name: 'Buy and run' }));
    await page.keyboard.press('Control+z');
    await expect(change).toHaveCount(0);
    await expect(peak).toBeFocused();
    // The same for a model swap: Metro 40s bought, then Sparrows picked, and Ctrl+Z takes back the Metro 40s.
    const model = panel.getByTestId('line-model');
    const swap = panel.getByTestId('model-change');
    await tabOnto(page, model);
    await pickByKey(page, /^Metro 40/);
    await tabOnto(page, swap.getByRole('button', { name: 'Buy and swap' }));
    await page.keyboard.press('Enter');
    await expect(panel.getByTestId('line-card')).toHaveAttribute('data-model', 'metro40');
    await expect(model).toBeFocused();
    await pickByKey(page, /^Sparrow/);
    await tabOnto(page, swap.getByRole('button', { name: 'Buy and swap' }));
    await page.keyboard.press('Control+z');
    await expect(panel.getByTestId('line-card')).toHaveAttribute('data-model', 'sparrow');
    await expect(swap).toHaveCount(0);
    await expect(model).toBeFocused();
    await expect(page.getByTestId('sim-panel')).toHaveAttribute('data-speed', '0');
  });

  test('Remove last stop, turned off as it takes the last stop, hands the focus to Cancel', async ({ page }) => {
    await game(page);
    await build(page, 'Draw a line');
    const draft = page.getByTestId('draft-card');
    // The map takes the tool's clicks a frame or so after the card shows.
    await frames(page);
    const [x, y] = await toScreen(page, DEBUG_STOPS[0]!.at);
    await page.mouse.click(x, y);
    const remove = draft.getByRole('button', { name: 'Remove last stop' });
    await expect(remove).toBeEnabled();
    await tabOnto(page, remove);
    await page.keyboard.press('Enter');
    await expect(remove).toBeDisabled();
    await expect(draft.getByRole('button', { name: 'Cancel' })).toBeFocused();
  });

  test('the Undo chip, gone as its undo is done or as time runs, hands the focus to Play or Pause', async ({ page }) => {
    await game(page);
    const undo = page.getByTestId('undo');
    const play = page.getByTestId('play');
    /** A command taken paused: Line 1's fare, set in Finance by the mouse. */
    const fare = async (to: string) => {
      await page.getByTestId('fare-1').click();
      await page.getByRole('option', { name: to, exact: true }).click();
      await expect(undo).toBeVisible();
    };
    await page.getByRole('button', { name: 'Finance', exact: true }).click();
    await page.getByTestId('finance-lines').click();
    await fare('$2.50');
    await tabOnto(page, undo);
    await page.keyboard.press('Enter');
    await expect(undo).toHaveCount(0);
    await expect(play).toBeFocused();
    await expect(play).toHaveAccessibleName('Play');
    await fare('$2.75');
    await tabOnto(page, undo);
    await page.keyboard.press('2'); // time runs, and lets the undos go
    await expect(undo).toHaveCount(0);
    await expect(play).toBeFocused();
    await expect(play).toHaveAccessibleName('Pause');
  });

  test('the checklist’s last step and the Contracts chip are one button, so Take it and Ctrl+Z leave the focus on it', async ({ page }) => {
    await game(page);
    const checklist = page.getByTestId('checklist');
    await expect(checklist).toHaveText('5/5 Take a contract');
    await tabOnto(page, checklist);
    await page.keyboard.press('Enter');
    const contracts = page.getByTestId('contracts');
    await contracts.getByRole('button', { name: 'Take it' }).first().focus();
    await page.keyboard.press('Enter');
    await expect(contracts.locator('[data-held="yes"]')).toHaveCount(1);
    // Contracts closed by Escape hands the focus back to what opened it, the checklist's step, which is the chip now.
    await page.keyboard.press('Escape');
    const chip = page.getByTestId('contracts-chip');
    await expect(chip).toBeFocused();
    await page.keyboard.press('Control+z');
    await expect(chip).toHaveCount(0);
    await expect(checklist).toBeFocused();
    await expect(checklist).toHaveText('5/5 Take a contract');
  });

  test('Continue hands the focus to the list’s button the keyboard was in as the card showed, the list closed by the mouse', async ({ page }) => {
    test.setTimeout(90_000);
    // Twenty seconds of the game before day 2 closes, at 60×.
    const panel = await lines(page, (d) => void (d.clock.elapsed = 86_400 + 18 * 3_600 + 59 * 60 + 40));
    const peak = panel.getByTestId('headway-peak');
    await tabOnto(page, peak);
    await page.keyboard.press('2');
    await page.keyboard.press('ArrowDown');
    const list = page.getByRole('listbox', { name: 'Peak' });
    await expect(list).toBeFocused();
    const day = page.getByTestId('day-card');
    await expect(day).toBeVisible({ timeout: 30_000 });
    // Paused by the mouse: the press closes the list, and the focus goes to Pause, which the mouse pressed.
    await page.getByTestId('play').click();
    await expect(page.getByTestId('sim-panel')).toHaveAttribute('data-speed', '0');
    await expect(list).toHaveCount(0);
    await day.getByRole('button', { name: 'Continue' }).focus();
    await page.keyboard.press('Enter');
    await expect(day).toHaveCount(0);
    await expect(peak).toBeFocused();
  });

  // The keyboard moved on from the line's tab it was on as the card showed, then closed the line: Continue gave the focus to the
  // line card's Buses list or to Lines, as a snapshot drew the card between the Tab and the close or not (3 runs of 6 each, the
  // seventeenth round). Where the focus is follows the focus as it moves now, so the gone tab's panel takes it.
  test('Continue hands the focus to Lines, the line whose tab it came from closed after the keyboard moved on', async ({ page }) => {
    test.setTimeout(90_000);
    const panel = await lines(page, (d) => {
      d.clock.elapsed = 86_400 + 18 * 3_600 + 59 * 60 + 40;
      const one = (d.lines as Record<string, unknown>[])[0]!;
      (d.lines as Record<string, unknown>[]).push({ ...one, id: 2, name: 'Line 2', stopIds: [1, 2] });
      d.nextIds = { ...d.nextIds, line: 3 };
    });
    const tab2 = panel.getByRole('tab', { name: 'Line 2' });
    await tabOnto(page, panel.getByRole('tab', { name: 'Line 1' }));
    await page.keyboard.press('ArrowRight');
    await expect(tab2).toBeFocused();
    await page.keyboard.press('2');
    const day = page.getByTestId('day-card');
    await expect(day).toBeVisible({ timeout: 30_000 });
    await expect(tab2).toBeFocused();
    await panel.getByRole('button', { name: 'Close line' }).focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    await expect(panel.getByRole('button', { name: 'Close it' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(tab2).toHaveCount(0);
    await day.getByRole('button', { name: 'Continue' }).focus();
    await page.keyboard.press('Enter');
    await expect(day).toHaveCount(0);
    await expect(page.locator('[data-movable="lines"]')).toBeFocused();
  });
});
