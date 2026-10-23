// The keyboard's focus as a card's button goes with its card (the accessibility pass, PLAN §8; useFocusBack). Keep as is,
// Sell them, Close line's Keep it and Close it took the focus with them, and it fell to the page, so a keyboard player
// started again from its top (the review of Close line). Each now hands it to the control the card came from, or, as a line
// closes, to the line shown in its place, and to Build once the last line has gone. Shown failing (TS-04) with the focus
// left where it fell; the undo's and the double presses' with their fixes taken out (the review of the hand-back).
import { expect, test, type Locator, type Page } from './base';
import { DEBUG_STOPS } from '../src/sim/commands/debugLine';
import { foundCompany, leaveHome, STARTING_CENTS } from './found';
import { build, city, onDepotLand, setSpeed, toScreen, withDebugLine, zoomOutOnce, type SaveData } from './shell';

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

/** The debug line and `more` lines more on its stops, Line 2 on stops 1 and 2 and Line 3 on 2 and 3. */
const withLines = (more: 1 | 2) => (d: SaveData) => {
  const one = (d.lines as Record<string, unknown>[])[0]!;
  const extra = [{ ...one, id: 2, name: 'Line 2', stopIds: [1, 2] }, { ...one, id: 3, name: 'Line 3', stopIds: [2, 3] }];
  (d.lines as Record<string, unknown>[]).push(...extra.slice(0, more));
  d.nextIds = { ...d.nextIds, line: 2 + more };
};

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
});

// The keyboard's way to a stop (the accessibility pass): the map opens a stop's card only on a press on it, so each line's card
// lists its stops, and the buttons that go with their card hand the focus on: a stop card's, the day card's Continue and
// Contracts' Take it. A hand-off waits only until the player's next key or press. Shown failing (TS-04) with no stops on the
// line card, the focus left where it fell, and a hand-off left waiting (the review of the stop card's keys).
test.describe('the keyboard’s way to a stop, and the focus after a stop’s, a contract’s and a day’s buttons', () => {
  test.skip(!city.sim, 'no sim file in this build yet');

  test('a line’s stops open their cards; a stop taken off a line hands the focus to its next line, then to the line’s stops', async ({ page }) => {
    // Line 2 calls at stops 2 to 4 too, so stop 2 stays up as it leaves Line 1, and comes down as it leaves Line 2.
    const panel = await lines(page, (d) => {
      const one = (d.lines as Record<string, unknown>[])[0]!;
      (d.lines as Record<string, unknown>[]).push({ ...one, id: 2, name: 'Line 2', stopIds: [2, 3, 4] });
      d.nextIds = { ...d.nextIds, line: 3 };
    });
    // The stops come after the line's controls, so one Tab still goes from the tabs to Buses.
    await panel.getByRole('tab', { name: 'Line 1', exact: true }).focus();
    await page.keyboard.press('Tab');
    await expect(panel.getByTestId('line-model')).toBeFocused();
    const stops = panel.getByTestId('line-stops');
    await expect(stops.getByRole('button')).toHaveText(['1', '2', '3', '4']);
    // Tab reaches it, so the stop's card takes the keyboard with it, as a panel the keyboard opens does (focusSource).
    await stops.getByRole('button', { name: 'Stop 1', exact: true }).focus();
    await page.keyboard.press('Tab');
    await expect(stops.getByRole('button', { name: 'Stop 2', exact: true })).toBeFocused();
    await page.keyboard.press('Enter');
    const card = page.getByTestId('stop-card');
    await expect(card).toHaveAttribute('aria-label', 'Stop 2');
    await expect
      .poll(() =>
        page.evaluate(() => {
          const shown = document.querySelector('[data-testid="stop-card"]');
          const at = document.activeElement;
          return !!shown && !!at && (at.contains(shown) || shown.contains(at));
        }),
      )
      .toBe(true);

    await press(page, card.getByRole('button', { name: /^Remove from Line 1/ }));
    await expect(card.getByRole('button', { name: /^Remove from Line 1/ })).toHaveCount(0);
    await expect(card.getByRole('button', { name: 'Line 2', exact: true })).toBeFocused();
    await press(page, card.getByRole('button', { name: /^Remove from Line 2/ }));
    await expect(card).toHaveCount(0);
    await expect(stops.getByRole('button')).toHaveText(['1', '3', '4']);
    await expect(stops.getByRole('button', { name: 'Stop 1', exact: true })).toBeFocused();
  });

  test('a tier that goes hands the focus to the other; one that stays leaves no hand-off waiting for an Escape', async ({ page }) => {
    // Stop 2 a Shelter, and stop 1 off the line, alone (stops 3 and 4 lie below a 720 px window's foot).
    const panel = await lines(page, (d) => {
      (d.stops as { id: number; tier: number }[]).find((s) => s.id === 2)!.tier = 2;
      (d.lines as { stopIds: number[] }[])[0]!.stopIds = [2, 3, 4];
    });
    const card = page.getByTestId('stop-card');
    await panel.getByTestId('line-stops').getByRole('button', { name: 'Stop 2', exact: true }).click();
    // Down to a Sign, the lowest: its button goes, and the focus goes to the step up.
    await press(page, card.getByRole('button', { name: /^Make it a Sign/ }));
    await expect(card).toHaveAttribute('data-tier', '1');
    await expect(card.getByRole('button', { name: /^Make it a Shelter/ })).toBeFocused();
    // Up to a Shelter: its button stays, now for a Station. An Escape later closes the card and moves the focus nowhere, so
    // Space plays; a hand-off left waiting gave Build the focus, and Space opened the Build menu.
    await page.keyboard.press('Enter');
    await expect(card).toHaveAttribute('data-tier', '2');
    await expect(card.getByRole('button', { name: /^Make it a Station/ })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(card).toHaveCount(0);
    await expect(page.getByTestId('build')).not.toBeFocused();
    await page.keyboard.press(' ');
    await expect(page.getByTestId('sim-panel')).not.toHaveAttribute('data-speed', '0');
    await expect(page.getByTestId('build-menu')).toHaveCount(0);

    // Stop 1, on no line, opened from the map: Take it down closes its card, and the focus goes to Build.
    await page.keyboard.press(' ');
    await expect(page.getByTestId('sim-panel')).toHaveAttribute('data-speed', '0');
    const placed = (await page.getByTestId('map').getAttribute('data-stops'))!.split(' ').map((t) => t.split(/[:,]/).map(Number));
    const one = placed.find(([id]) => id === 1)!;
    const [x, y] = await toScreen(page, [one[1]!, one[2]!]);
    await expect(async () => {
      await page.mouse.click(x, y);
      await expect(card).toHaveAttribute('aria-label', 'Stop 1', { timeout: 1_000 });
    }).toPass({ timeout: 10_000 });
    await press(page, card.getByRole('button', { name: /^Take it down/ }));
    await expect(card).toHaveCount(0);
    await expect(page.getByTestId('build')).toBeFocused();
  });

  test('Take it hands the focus to the contract it took', async ({ page }) => {
    await lines(page);
    // The checklist's last step, Take a contract, opens Contracts (shell.ts: day 1 in profit).
    await page.getByTestId('checklist').click();
    const contracts = page.getByTestId('contracts');
    const offer = contracts.getByTestId('contract').filter({ has: page.getByRole('button', { name: 'Take it' }) }).first();
    const id = await offer.getAttribute('data-contract');
    await press(page, offer.getByRole('button', { name: 'Take it' }));
    const taken = contracts.locator(`[data-contract="${id}"]`);
    await expect(taken).toHaveAttribute('data-held', 'yes');
    await expect(taken).toBeFocused();
    // Help opened there with ? and closed gives the row the focus back, which takes it only until it leaves: it fell to the
    // page (round 11).
    await page.keyboard.press('?');
    const help = page.getByTestId('help');
    await expect(help).toBeVisible();
    await page.keyboard.press('?');
    await expect(help).toHaveCount(0);
    await expect(taken).toBeFocused();
  });

  /** The debug line's game at 23:30, half an hour before its day closes (shell.ts), at 600×; the day card and its Continue. */
  async function toTheClose(page: Page) {
    await page.goto('./');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await leaveHome(page);
    await foundCompany(page);
    await withDebugLine(page, (d) => void (d.clock.elapsed = 86_400 + 18 * 3_600 + 30 * 60));
    await setSpeed(page, '600×');
    const day = page.getByTestId('day-card');
    return { day, go: day.getByRole('button', { name: 'Continue' }) };
  }

  /** Tabs on from where the focus is until `go` has it, as a keyboard player reaches it. */
  async function tabTo(page: Page, go: Locator) {
    for (let k = 0; k < 60 && !(await go.evaluate((el) => el === document.activeElement)); k++) await page.keyboard.press('Tab');
    await expect(go).toBeFocused();
  }

  test('Continue hands the focus back where the keyboard had it as the day card showed', async ({ page }) => {
    const { day, go } = await toTheClose(page);
    // The keyboard on the dock's Lines as the card shows, three game minutes' wait or more ahead of it.
    const dockLines = page.getByTestId('dock').getByRole('button', { name: 'Lines', exact: true });
    await dockLines.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(dockLines).toBeFocused();
    await expect(day).toBeVisible({ timeout: 30_000 });
    await tabTo(page, go);
    await page.keyboard.press('Enter');
    await expect(day).toHaveCount(0);
    await expect(dockLines).toBeFocused();
  });

  test('Continue leaves the page’s focus on the page as the card goes, so Space plays', async ({ page }) => {
    // Where the focus came into the card from was the Saves chip on every forward Tab, and Space opened Saves.
    const { day, go } = await toTheClose(page);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await expect(day).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Pause' }).click();
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await tabTo(page, go);
    await page.keyboard.press('Enter');
    await expect(day).toHaveCount(0);
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
    await page.keyboard.press(' ');
    await expect(page.getByTestId('sim-panel')).not.toHaveAttribute('data-speed', '0');
    await expect(page.getByTestId('saves')).toHaveCount(0);
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
    // A press on it sends nothing: the sim would refuse it too, so the count shows it (the review of #156).
    await page.keyboard.press('Enter');
    await expect(card).toHaveAttribute('data-tier', '3');
    expect(await sent('set-stop-tier')).toBe(1);
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
    // So does the Build menu, the keyboard on Build, where its Enter leaves it, and on its tools: T tilted the map behind it and
    // 2 picked 60× (round 11, and its review for Build).
    await page.keyboard.press('Escape');
    await expect(list).toHaveCount(0);
    const build = page.getByTestId('build');
    await build.focus();
    await page.keyboard.press('Enter');
    const menu = page.getByTestId('build-menu');
    for (const on of ['Build', 'Place a stop']) {
      if (on !== 'Build') await page.keyboard.press('Tab');
      await expect(on === 'Build' ? build : menu.getByRole('button', { name: on })).toBeFocused();
      await page.keyboard.press('t');
      await page.keyboard.press('2');
      await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done(null)))));
      await expect(menu).toBeVisible();
      expect(await map.getAttribute('data-mode'), on).toBe('2d');
      expect(await sent('speed'), on).toBe(speeds);
    }
  });
});
