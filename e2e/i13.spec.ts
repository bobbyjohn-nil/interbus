// I13 (PLAN §8, the M2 spec item 7): the calm shell covers 6% of the screen or less at rest and 26%
// or less with a panel open, at 1440×900, 1366×768 and 1152×720, in the light theme. Chrome is every
// element marked data-chrome: the chip row, the dock, notices, the credits and build chip, the compass
// and the demand chip, and the one panel (Home, the founding card, the demand menu, the Build menu,
// the draft card, the inspector, the route editor, a stop's card, Finance, Saves, Help, the day card). Home's
// Saves, Help and Credits (Help on its credits) open beside Home's card, in turn, so each is measured with it.
import { expect, test, type Locator, type Page } from './base';
import { DEBUG_STOPS } from '../src/sim/commands/debugLine';
import { SAVE_FORMAT } from '../src/sim/save/save';
import { AUTOSAVE_OFF_CHIP, UNBACKED_COPY } from '../src/ui/copy';
import { foundCompany, leaveHome, STARTING_CENTS } from './found';
import { build, chromeShare, city, fillStorage, onDepotLand, setFare, setSpeed, toScreen, withBusyQuarterClose, withDebugLine, zoomOutOnce } from './shell';

const SIZES = [
  [1440, 900],
  [1366, 768],
  [1152, 720],
] as const;
const REST = 0.06;
const PANEL = 0.26;

/** Whether the Undo chip shows its whole label, not cut short with an ellipsis (app.css). */
const undoWhole = (page: Page) => page.getByTestId('undo').locator('.chip-text').evaluate((el) => el.scrollWidth <= el.clientWidth);

/**
 * Inner Boston's numbers set in the chips' text (a 7-digit Cash, five-digit Riders/day and a wider Costs/day: the fixture's
 * riders stay far short of five digits, and an import would clear the undo), until the returned function puts the game's back.
 */
async function bostonNumbers(page: Page, cash: string): Promise<() => Promise<void>> {
  const top = page.getByTestId('sim-panel');
  const texts = { Cash: cash, 'Riders/day': '≈12,000', 'Costs/day': '$24,560' };
  const before = await top.evaluate((bar, texts) => {
    const before: Record<string, string> = {};
    for (const [label, text] of Object.entries(texts)) {
      const chip = [...bar.querySelectorAll('.chip')].find((c) => c.querySelector('.chip-label')?.textContent === label)!;
      before[label] = chip.lastChild!.textContent!;
      chip.lastChild!.textContent = text;
    }
    return before;
  }, texts);
  await expect(top).toContainText('≈12,000');
  return async () => {
    await top.evaluate((bar, before) => {
      for (const [label, text] of Object.entries(before)) [...bar.querySelectorAll('.chip')].find((c) => c.querySelector('.chip-label')?.textContent === label)!.lastChild!.textContent = text;
    }, before);
    await expect(top).not.toContainText('≈12,000');
  };
}

/** Saves, open with slot 1 full, measured with Slot 1's Load question open (savesLoad), then Import's (savesImport): each in place of its row's other buttons. */
async function savesAsking(page: Page, shares: Record<string, number>): Promise<void> {
  const saves = page.getByTestId('saves');
  const slot = saves.getByTestId('slot-1');
  await slot.getByRole('button', { name: 'Load' }).click();
  await expect(slot.getByRole('button')).toHaveText(['Replace this game', 'Keep playing']);
  shares.savesLoad = await chromeShare(page);
  await slot.getByRole('button', { name: 'Keep playing' }).click();
  await saves.getByRole('button', { name: 'Import a save file' }).click();
  await expect(saves.locator(':scope > .controls').first().getByRole('button')).toHaveText(['Replace this game', 'Keep playing']);
  shares.savesImport = await chromeShare(page);
  await saves.getByRole('button', { name: 'Keep playing' }).click();
}

/** Tab, from where the focus is, until `button` has it; then whether it shows whole inside `panel`, which scrolled it into view (to the pixel: a cap in vh is fractional). */
async function tabbedIntoView(page: Page, panel: Locator, button: Locator): Promise<boolean> {
  for (let n = 0; n < 40 && !(await button.evaluate((el) => el === document.activeElement)); n++) await page.keyboard.press('Tab');
  await expect(button).toBeFocused();
  const [p, b] = [(await panel.boundingBox())!, (await button.boundingBox())!];
  return b.y >= p.y - 1 && b.y + b.height <= p.y + p.height + 1;
}

test.describe('the screen budget (I13)', () => {
  test.skip(!city.sim, 'no sim file in this build yet');

  for (const [width, height] of SIZES) {
    test(`at ${width}×${height}: ≤6% at rest, ≤26% with each panel`, async ({ page }) => {
      test.setTimeout(90_000);
      await page.setViewportSize({ width, height });
      // A save set aside by an older build, listed in Saves until exported or deleted (the M5 spec, item 4).
      await page.addInitScript(() => localStorage.setItem('interbus.backup.boston.older', '{"format":1}'));
      await page.goto('./');
      await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
      await expect(page.getByTestId('home')).toBeVisible({ timeout: 30_000 });
      const shares: Record<string, number> = { home: await chromeShare(page) };
      await leaveHome(page);
      await expect(page.getByTestId('founding-card')).toBeVisible({ timeout: 30_000 });
      shares.founding = await chromeShare(page);
      // Help on the founding card: ? from a colour, which is no field. Two panels the player has open together, each held to
      // 26% alone (D25), so the two are measured, not held (DECISIONS, Measured, 2026-10-22).
      await page.getByTestId('founding-card').getByRole('radio').first().focus();
      await page.keyboard.press('?');
      await expect(page.getByTestId('help')).toBeVisible();
      shares.foundingHelp = await chromeShare(page);
      await page.keyboard.press('?');
      await expect(page.getByTestId('help')).toHaveCount(0);
      await foundCompany(page);
      await zoomOutOnce(page);
      shares.rest = await chromeShare(page);
      // The demand menu open (D25): a panel's budget.
      await page.getByTestId('demand-chip').click();
      await expect(page.getByTestId('demand-menu')).toBeVisible();
      shares.demand = await chromeShare(page);
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('demand-menu')).toHaveCount(0);
      // The Build menu open (D25): a panel's budget.
      await page.getByTestId('build').click();
      await expect(page.getByTestId('build-menu')).toBeVisible();
      shares.build = await chromeShare(page);

      await build(page, 'Place a depot');
      const [dx, dy] = await toScreen(page, onDepotLand());
      await page.mouse.click(dx, dy);
      await expect(page.getByTestId('checklist')).toHaveText('2/5 Draw a line');
      await build(page, 'Draw a line');
      for (const stop of DEBUG_STOPS) {
        const [x, y] = await toScreen(page, stop.at);
        await page.mouse.click(x, y);
      }
      await expect(page.getByTestId('draft-card')).toHaveAttribute('data-price', '20600000', { timeout: 10_000 });
      shares.draft = await chromeShare(page);
      await page.getByRole('button', { name: 'Create' }).click();
      await expect(page.getByTestId('inspector')).toBeVisible();
      shares.inspector = await chromeShare(page);
      // The route editor (D25), its four stops listed: a panel's budget.
      await page.getByRole('button', { name: 'Edit route' }).click();
      await expect(page.getByTestId('route-editor').locator('li')).toHaveCount(4);
      shares.routeEditor = await chromeShare(page);
      await page.getByRole('button', { name: 'Cancel' }).click();
      await expect(page.getByTestId('inspector')).toBeVisible();
      await page.getByRole('button', { name: 'Close', exact: true }).click();
      shares.restWithLine = await chromeShare(page);
      await expect(page.getByTestId('undo')).toHaveText('Undo: Create Line 1');
      expect(await undoWhole(page), 'the Undo chip whole').toBe(true);
      // Finance: the depot, the line's stops and its buses are today's purchases, each a row (D25), and
      // on day 1 today's column and the quarter's both come to the cash less the starting cash, on Day 0.
      await page.getByRole('button', { name: 'Finance', exact: true }).click();
      const finance = page.getByTestId('finance');
      // Its three views (D25), each a panel's budget: the Overview's chart, the Breakdown, each line's money.
      await expect(finance.getByTestId('finance-chart')).toBeVisible();
      shares.finance = await chromeShare(page);
      await finance.getByTestId('finance-lines').click();
      await expect(finance.getByTestId('line-money-1')).toBeVisible();
      shares.financeLines = await chromeShare(page);
      await finance.getByTestId('finance-breakdown').click();
      // Buying and building starts folded, so a late game's table stays inside the budget; open, its rows.
      await expect(finance.locator('tr[data-group="capital"]')).toHaveAttribute('data-open', 'no');
      shares.financeBreakdown = await chromeShare(page);
      await finance.getByRole('button', { name: 'Buying and building' }).click();
      await expect(finance.locator('tr[data-kind="depots"]')).toHaveAttribute('data-today', String(-15_000_000));
      await expect(finance.locator('tr[data-kind="stops"]')).toHaveAttribute('data-today', String(-1_600_000));
      await expect(finance.locator('tr[data-kind="buses"]')).toHaveAttribute('data-today', String(-19_000_000));
      await expect(finance).toHaveAttribute('data-opening', String(STARTING_CENTS));
      await expect(finance).toHaveAttribute('data-today', String(-35_600_000));
      await expect(finance).toHaveAttribute('data-quarter', String(-35_600_000));
      shares.financeBought = await chromeShare(page);
      await page.getByRole('button', { name: 'Close', exact: true }).click();
      // A stop's card, from where the second stop snapped.
      const placed = (await page.getByTestId('map').getAttribute('data-stops'))!.split(' ').map((s) => s.split(/[:,]/).map(Number));
      const [sx, sy] = await toScreen(page, [placed[1]![1]!, placed[1]![2]!]);
      await page.mouse.click(sx, sy);
      await expect(page.getByTestId('stop-card')).toBeVisible();
      shares.stop = await chromeShare(page);
      // Panels stay open together (D25), so each is measured alone: the stop card closes first.
      await page.getByTestId('stop-card').getByRole('button', { name: 'Close', exact: true }).click();
      await page.getByRole('button', { name: 'Saves' }).click();
      // Every slot full, each naming when it was saved, and a set-aside save (the M5 spec, item 4).
      const saves = page.getByTestId('saves');
      for (const n of [1, 2, 3]) {
        await page.getByTestId(`slot-${n}`).getByRole('button', { name: 'Save here' }).click();
        await expect(page.getByTestId(`slot-${n}-when`)).toBeVisible();
      }
      await expect(page.getByTestId('set-aside-older')).toBeVisible();
      shares.saves = await chromeShare(page);
      // With a question open, Load's in a slot's row and Import's below the slots, each in place of its row's other buttons.
      await savesAsking(page, shares);
      // Two more set aside, one a format, as a player through three format changes holds them: the save
      // list at its tallest, scrolling inside its cap (69vh). Shown failing (TS-04) at 1152×720 without
      // the cap: 28.0%, the list running down to the dock.
      await page.evaluate(() => {
        for (const why of ['older-14', 'older-15']) localStorage.setItem(`interbus.backup.boston.${why}`, '{"format":1}');
      });
      await saves.getByRole('button', { name: 'Close', exact: true }).click();
      await page.getByRole('button', { name: 'Saves' }).click();
      for (const why of ['older', 'older-14', 'older-15']) await expect(saves.getByTestId(`set-aside-${why}`)).toBeVisible();
      shares.savesTallest = await chromeShare(page);
      // Tab reaches the buttons below the fold, each scrolled into view: Back to Home, the last.
      await saves.getByRole('button', { name: 'Close', exact: true }).focus();
      expect(await tabbedIntoView(page, saves, saves.getByRole('button', { name: 'Back to Home' }))).toBe(true);
      // Help, from Saves' last row, which it shares with Export session and Back to Home, so Saves at its tallest grows no
      // taller (savesTallest); it takes Saves' place. Its tables scroll inside its cap (60vh).
      await saves.getByRole('button', { name: 'Help', exact: true }).click();
      const help = page.getByTestId('help');
      await expect(help).toBeVisible();
      await expect(saves).toHaveCount(0);
      shares.help = await chromeShare(page);
      await help.getByRole('button', { name: 'Close', exact: true }).click();
      await page.getByRole('button', { name: 'Saves' }).click();
      // Home with Continue; its Saves, which opens beside it; and Start over's question with Saves open.
      // Shown failing (TS-04) without Saves' cap on Home and Home's width: 32.9% and 39.0% at 1152×720,
      // 26.9% and 31.8% at 1366×768.
      await saves.getByRole('button', { name: 'Back to Home' }).click();
      const home = page.getByTestId('home');
      await expect(home.getByTestId('home-continue')).toBeVisible();
      shares.homeContinue = await chromeShare(page);
      await home.getByRole('button', { name: 'Saves' }).click();
      await expect(saves.getByTestId('set-aside-older-15')).toBeVisible();
      shares.homeSaves = await chromeShare(page);
      await home.getByRole('button', { name: 'New game' }).click();
      await expect(home.getByRole('button', { name: 'Start a new game' })).toBeVisible();
      shares.homeSavesAsk = await chromeShare(page);
      await saves.getByRole('button', { name: 'Close', exact: true }).focus();
      expect(await tabbedIntoView(page, saves, saves.getByRole('button', { name: 'Import a save file' }))).toBe(true);
      await home.getByRole('button', { name: 'Keep it' }).click();
      // Help, beside Home's card in Saves' place, its tables scrolling inside Saves' cap there (45vh).
      await home.getByRole('button', { name: 'Help', exact: true }).click();
      await expect(help).toBeVisible();
      await expect(saves).toHaveCount(0);
      shares.homeHelp = await chromeShare(page);
      // Credits, Help on its credits, beside Home's card in the same place.
      await home.getByRole('button', { name: 'Credits', exact: true }).click();
      await expect(help).toHaveAttribute('data-view', 'credits');
      shares.homeCredits = await chromeShare(page);
      // Saves at its tallest beside the founding card: Home's Saves, then New game, which leaves Saves open there, where a
      // game not yet founded loads a slot or a file instead (saves.spec). Two panels again, so measured, not held.
      await home.getByRole('button', { name: 'Saves', exact: true }).click();
      await expect(saves.getByTestId('set-aside-older-15')).toBeVisible();
      await home.getByRole('button', { name: 'New game' }).click();
      await home.getByRole('button', { name: 'Start a new game' }).click();
      await expect(page.getByTestId('founding-card')).toBeVisible();
      await expect(saves.getByTestId('set-aside-older-15')).toBeVisible();
      shares.foundingSaves = await chromeShare(page);

      const rounded = Object.fromEntries(Object.entries(shares).map(([k, v]) => [k, Math.round(v * 1000) / 10]));
      test.info().annotations.push({ type: 'chrome %', description: JSON.stringify(rounded) });
      expect(shares.rest, JSON.stringify(rounded)).toBeLessThanOrEqual(REST);
      expect(shares.restWithLine, JSON.stringify(rounded)).toBeLessThanOrEqual(REST);
      for (const panel of ['home', 'founding', 'demand', 'build', 'draft', 'inspector', 'routeEditor', 'finance', 'financeLines', 'financeBreakdown', 'financeBought', 'stop', 'saves', 'savesLoad', 'savesImport', 'savesTallest', 'help', 'homeContinue', 'homeSaves', 'homeSavesAsk', 'homeHelp', 'homeCredits']) expect(shares[panel], `${panel} ${JSON.stringify(rounded)}`).toBeLessThanOrEqual(PANEL);
    });
  }

  // A busy quarter's close: the day card's report card, a contract paid, a medal, snow named a day
  // ahead, interest and every kind of buying and selling, with a notice up beside it. The card is a
  // panel's chrome; what does not fit scrolls inside its cap (52vh, as Finance), with Continue below
  // it in view. Built once at 1152×720 and measured there, then at 1366×768, where it went over too; at
  // 1440×900 it took 25.1% uncapped. Shown failing (TS-04) uncapped at 32.2% and 27.2%.
  test('a busy quarter’s close: the day card ≤26% at 1152×720 and 1366×768', async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1152, height: 720 });
    await page.goto('./');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(page);
    await withBusyQuarterClose(page);
    await setSpeed(page, '600×');
    const card = page.getByTestId('day-card');
    await expect(card).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Pause' }).click();
    for (const part of ['report-card', 'contract-outcome', 'medal-news', 'event-news']) await expect(card.getByTestId(part)).toHaveCount(1);
    for (const kind of ['interest', 'buses', 'busSales', 'stops', 'stopUpgrades', 'stopSales', 'depots']) await expect(card.locator(`tr[data-kind="${kind}"]`)).toHaveCount(1);
    const [rows, go, notice] = [card.locator('.day-card-scroll'), card.getByRole('button', { name: 'Continue' }), page.getByTestId('notice')];
    const shares: Record<string, number> = {};
    for (const [width, height] of [
      [1152, 720],
      [1366, 768],
    ] as const) {
      await page.setViewportSize({ width, height });
      // A notice up: Undo's refusal, with nothing to take back since the save was loaded.
      await page.keyboard.press('Control+z');
      await expect(notice).toHaveText('Nothing to undo');
      shares[`${width}×${height}`] = await chromeShare(page);
      const [c, r, g] = [(await card.boundingBox())!, (await rows.boundingBox())!, (await go.boundingBox())!];
      expect(await rows.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
      expect(g.y).toBeGreaterThanOrEqual(r.y + r.height);
      expect(g.y + g.height).toBeLessThanOrEqual(c.y + c.height);
    }
    const rounded = Object.fromEntries(Object.entries(shares).map(([k, v]) => [k, Math.round(v * 1000) / 10]));
    test.info().annotations.push({ type: 'chrome % with a busy quarter’s day card', description: JSON.stringify(rounded) });
    for (const [size, share] of Object.entries(shares)) expect(share, `${size} ${JSON.stringify(rounded)}`).toBeLessThanOrEqual(PANEL);
  });

  // A save the start could not set aside (a disk too full for its backup): on Home its notice is untimed
  // until Saves opens, and in the game the Saves chip says "Autosave off" while it is held, so Home, the
  // shell at rest and at rest with a line are measured beside them, and then with a stop taken off the
  // line, its undo whole, and so again with Inner Boston's numbers; then Saves with that save in the
  // autosave's row, with its buttons, every slot full and a set-aside save, at rest and with Load's
  // question or Import's open: the save list at its tallest. At 1152×720 only, the tightest size. Shown
  // failing (TS-04) with the notice "A save couldn’t be set aside: see Saves" (6.05% at rest with a line),
  // with Export this game beside Import's question, which wrapped it to a second row (Saves 26.005%), with
  // Save here beside Load's question, which wrapped its slot's row (26.01%), on 5f4bce3 with that undo
  // named "Undo: Remove Stop 2 from Line 1", 203 px wide (6.05%, the systems audit's third round), and on
  // 029387a, which has no such chip: there this test stops at the chip's check, and the same steps without it,
  // the game saying it in a notice of its own (169×31 px), measured 6.07% with Inner Boston's numbers.
  test('at 1152×720: ≤6% at rest and ≤26% in Saves with a save not set aside', async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1152, height: 720 });
    await page.addInitScript(fillStorage, JSON.stringify({ format: SAVE_FORMAT - 1, data: {}, pad: 'p'.repeat(300_000) }));
    await page.addInitScript(() => localStorage.setItem('interbus.backup.boston.older', '{"format":1}'));
    await page.goto('./');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    const notice = page.getByTestId('notice');
    await expect(notice).toHaveText(UNBACKED_COPY, { timeout: 30_000 });
    const shares: Record<string, number> = { home: await chromeShare(page) };
    await foundCompany(page);
    await zoomOutOnce(page);
    const chip = page.getByTestId('saves-chip');
    await expect(chip).toHaveText(AUTOSAVE_OFF_CHIP);
    shares.rest = await chromeShare(page);
    await build(page, 'Place a depot');
    const [dx, dy] = await toScreen(page, onDepotLand());
    await page.mouse.click(dx, dy);
    await expect(page.getByTestId('checklist')).toHaveText('2/5 Draw a line');
    await build(page, 'Draw a line');
    for (const stop of DEBUG_STOPS) {
      const [x, y] = await toScreen(page, stop.at);
      await page.mouse.click(x, y);
    }
    await expect(page.getByTestId('draft-card')).toHaveAttribute('data-price', '20600000', { timeout: 10_000 });
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByTestId('inspector')).toBeVisible();
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(chip).toHaveText(AUTOSAVE_OFF_CHIP);
    shares.restWithLine = await chromeShare(page);
    // Its second stop taken off the line, which takes it down: its card closes, and the undo chip names it.
    const placed = (await page.getByTestId('map').getAttribute('data-stops'))!.split(' ').map((s) => s.split(/[:,]/).map(Number));
    const [sx, sy] = await toScreen(page, [placed[1]![1]!, placed[1]![2]!]);
    const card = page.getByTestId('stop-card');
    await expect(async () => {
      await page.mouse.click(sx, sy);
      await expect(card).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 10_000 });
    await card.getByRole('button', { name: /^Remove from Line 1/ }).click();
    await expect(card).toHaveCount(0);
    await expect(page.getByTestId('undo')).toHaveText(`Undo: Take Stop ${placed[1]![0]} off Line 1`);
    await page.getByTestId('date').hover();
    await expect(chip).toHaveText(AUTOSAVE_OFF_CHIP);
    await expect(notice).toHaveCount(0, { timeout: 10_000 });
    shares.restRemoved = await chromeShare(page);
    expect(await undoWhole(page), 'the Undo chip whole').toBe(true);
    const restore = await bostonNumbers(page, '$1,524,452');
    shares.restBoston = await chromeShare(page);
    expect((await page.getByTestId('sim-panel').boundingBox())!.height, 'one row of chips').toBeLessThanOrEqual(28);
    await restore();
    await page.getByRole('button', { name: 'Saves' }).click();
    for (const n of [1, 2, 3]) {
      await page.getByTestId(`slot-${n}`).getByRole('button', { name: 'Save here' }).click();
      await expect(page.getByTestId(`slot-${n}-when`)).toBeVisible();
    }
    await expect(page.getByTestId('autosave')).toContainText('not set aside');
    await expect(page.getByTestId('set-aside-older')).toBeVisible();
    shares.saves = await chromeShare(page);
    await savesAsking(page, shares);
    const rounded = Object.fromEntries(Object.entries(shares).map(([k, v]) => [k, Math.round(v * 1000) / 10]));
    test.info().annotations.push({ type: 'chrome % with a save not set aside', description: JSON.stringify(rounded) });
    expect(shares.rest, JSON.stringify(rounded)).toBeLessThanOrEqual(REST);
    expect(shares.restWithLine, JSON.stringify(rounded)).toBeLessThanOrEqual(REST);
    expect(shares.restRemoved, JSON.stringify(rounded)).toBeLessThanOrEqual(REST);
    expect(shares.restBoston, JSON.stringify(rounded)).toBeLessThanOrEqual(REST);
    for (const panel of ['home', 'saves', 'savesLoad', 'savesImport']) expect(shares[panel], `${panel} ${JSON.stringify(rounded)}`).toBeLessThanOrEqual(PANEL);
  });

  // The failure floor's countdown (D10) with a long undo and the Contracts chip, at 1152×720, the tightest
  // size: below the floor, the player pauses to take a contract. The chips stay on one row, the undo taking
  // the room the others leave, cut short there and named in full in its title and to a screen reader;
  // with the fixture's numbers, then Inner Boston's (bostonNumbers). At 1440×900 the same undo is whole.
  // Shown failing (TS-04) on 5f4bce3, where the row wrapped to two, 1036 px wide and 62 px tall, and the
  // shell took 10.2%. And so with a save the start could not set aside, which the Saves chip names while it
  // is held, its room taken from the undo's: shown failing (TS-04) on 029387a, where nothing said it once
  // Saves had opened, as this setup's import does, and before that a notice of its own did (169×31 px,
  // 0.63% more beside the row's 5.98%: 6.61%).
  for (const held of [false, true]) {
    test(`at 1152×720: ≤6% at rest in the countdown, with a long undo and the Contracts chip on one row${held ? ', and a save not set aside' : ''}`, async ({ page }) => {
      test.setTimeout(90_000);
      await page.setViewportSize({ width: 1152, height: 720 });
      if (held) await page.addInitScript(fillStorage, JSON.stringify({ format: SAVE_FORMAT - 1, data: {}, pad: 'p'.repeat(300_000) }));
      await page.goto('./');
      await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
      await foundCompany(page);
      // Owing $1m more on day 2, a close below the floor behind it, and a bronze medal on the Contracts chip.
      await withDebugLine(page, (d) => {
        d.ledger.push({ day: 2, kind: 'buses', amountCents: -100_000_000, lineId: null });
        d.closesBelowFloor = 1;
        d.medals = { bronze: 1, silver: null, gold: null };
      });
      await expect(page.getByTestId('countdown')).toHaveText('4 days to get above -$150k');
      await page.getByTestId('checklist').click();
      const offer = page.getByTestId('contract').first();
      await offer.getByRole('button', { name: 'Take it' }).click();
      await expect(offer).toHaveAttribute('data-held', 'yes');
      await page.getByTestId('contracts').getByRole('button', { name: 'Close', exact: true }).click();
      await expect(page.getByTestId('contracts-chip')).toContainText('1 held');
      const undo = page.getByTestId('undo');
      await expect(undo).toHaveText(/^Undo: Take the .+ contract$/);
      // At rest: the import's notice gone, and the pointer on the date, where no card opens.
      await page.getByTestId('date').hover();
      await expect(page.getByTestId('notice')).toHaveCount(0, { timeout: 10_000 });
      const top = page.getByTestId('sim-panel');
      const chip = page.getByTestId('saves-chip');
      const measured: string[] = [];
      for (const numbers of ['fixture', 'Inner Boston']) {
        if (numbers === 'Inner Boston') await bostonNumbers(page, '-$1,524,452');
        await expect(chip).toHaveText(held ? AUTOSAVE_OFF_CHIP : 'Saves');
        const share = await chromeShare(page);
        const bar = (await top.boundingBox())!;
        measured.push(`${numbers}: ${Math.round(share * 10_000) / 100}% (top bar ${Math.round(bar.width)}×${Math.round(bar.height)}, undo ${Math.round((await undo.boundingBox())!.width)} px, Saves chip ${Math.round((await chip.boundingBox())!.width)} px)`);
        expect(share, measured.at(-1)).toBeLessThanOrEqual(REST);
        expect(bar.height, `one row of chips: ${measured.at(-1)}`).toBeLessThanOrEqual(28);
        // The row is full: the undo is cut short, its full words in its title and its name.
        expect(await undoWhole(page)).toBe(false);
      }
      test.info().annotations.push({ type: `chrome % in the countdown${held ? ' with a save not set aside' : ''}`, description: measured.join('; ') });
      const words = (await undo.textContent())!;
      await expect(undo).toHaveAttribute('title', words);
      await expect(page.getByRole('button', { name: words, exact: true })).toBeVisible();
      // Wider, the row has room: the same undo is whole.
      await page.setViewportSize({ width: 1440, height: 900 });
      await expect.poll(() => undoWhole(page)).toBe(true);
      expect((await top.boundingBox())!.height).toBeLessThanOrEqual(28);
    });
  }

  // The same late in a game: Year 10, paused at 5,400×, a fare's undo, and at the row's end the Contracts chip with three
  // medals and "3 on offer" (a contract paid, none held) or the checklist's "4/5 Close a day in profit" (never a day in
  // profit), each wider than the room the undo had left. Once the undo is down to its 6em, that last chip is cut the same
  // way, its full words in its title and its name, its medals whole. Shown failing (TS-04) on abb5f2f, where the row
  // wrapped to two: with "Autosave off", 1003×62 and 10.08% with either chip last; without, with Inner Boston's numbers,
  // 1036×62 and 10.22%.
  for (const [last, held] of [['contracts', false], ['contracts', true], ['checklist', true]] as const) {
    test(`at 1152×720: ≤6% at rest in the countdown late in a game, on one row, with ${last === 'contracts' ? 'three medals and 3 on offer' : '4/5 Close a day in profit'}${held ? ', and a save not set aside' : ''}`, async ({ page }) => {
      test.setTimeout(90_000);
      await page.setViewportSize({ width: 1152, height: 720 });
      if (held) await page.addInitScript(fillStorage, JSON.stringify({ format: SAVE_FORMAT - 1, data: {}, pad: 'p'.repeat(300_000) }));
      await page.goto('./');
      await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
      await foundCompany(page);
      await withDebugLine(page, (d) => {
        // Year 10, Q1 Day 1 at 02:00, three hours before its 05:00 (a day starts at midnight): the clock names Overnight, the widest
        // of the three periods (D13).
        d.clock.elapsed = 288 * 86_400 - 3 * 3_600;
        // Owing $1m more and a close below the floor behind it; a contract paid, or day 1 a loss, so no day yet in profit.
        if (last === 'contracts') d.ledger.push({ day: 2, kind: 'buses', amountCents: -100_000_000, lineId: null }, { day: 2, kind: 'contract', amountCents: 6_000_000, lineId: null });
        else d.ledger.push({ day: 1, kind: 'wages', amountCents: -100_000_000, lineId: null });
        d.closesBelowFloor = 1;
        d.medals = { bronze: 1, silver: 1, gold: 1 };
        d.tripsCarried = 400_000;
      });
      await expect(page.getByTestId('countdown')).toHaveText('4 days to get above -$150k');
      const end = last === 'contracts' ? page.getByTestId('contracts-chip') : page.getByTestId('checklist');
      await expect(end).toHaveText(last === 'contracts' ? 'Contracts 3 on offer' : '4/5 Close a day in profit');
      await setSpeed(page, '5,400×');
      await page.getByRole('button', { name: 'Pause' }).click();
      await setFare(page, 'Line 1', '$2.50');
      await expect(page.getByTestId('undo')).toHaveText('Undo: Line 1’s fare');
      // The clock and its period's name on the row, the year in its title and read, not shown (D13).
      await expect(page.getByTestId('date')).toHaveText(/^Year 10, Q1 Day 1, 0\d:\d\d Overnight$/);
      await expect(page.getByTestId('date')).toHaveAttribute('title', 'Year 10, Q1, Day 1');
      await page.getByTestId('date').hover();
      await expect(page.getByTestId('notice')).toHaveCount(0, { timeout: 15_000 });
      const top = page.getByTestId('sim-panel');
      await expect(page.getByTestId('saves-chip')).toHaveText(held ? AUTOSAVE_OFF_CHIP : 'Saves');
      const measured: string[] = [];
      for (const numbers of ['fixture', 'Inner Boston']) {
        if (numbers === 'Inner Boston') await bostonNumbers(page, '-$1,524,452');
        const share = await chromeShare(page);
        const bar = (await top.boundingBox())!;
        const [undoBox, endBox] = [(await page.getByTestId('undo').boundingBox())!, (await end.boundingBox())!];
        measured.push(`${numbers}: ${Math.round(share * 10_000) / 100}% (top bar ${Math.round(bar.width)}×${Math.round(bar.height)}, undo ${Math.round(undoBox.width)} px, ${last} ${Math.round(endBox.width)} px)`);
        expect(share, measured.at(-1)).toBeLessThanOrEqual(REST);
        expect(bar.height, `one row of chips: ${measured.at(-1)}`).toBeLessThanOrEqual(28);
        expect(endBox.y, `the last chip on the row: ${measured.at(-1)}`).toBeCloseTo(bar.y, 0);
        // The undo gives its room first: the last chip is cut only once the undo is down to its 6em (84 px).
        const whole = await end.evaluate((chip) => [...chip.querySelectorAll('.chip-text')].every((t) => t.scrollWidth <= t.clientWidth));
        if (!whole) expect(undoBox.width, `the undo at its least: ${measured.at(-1)}`).toBeLessThanOrEqual(85);
        // The tightest row, "Autosave off" with Inner Boston's numbers, is cut; the fixture's without it is whole.
        if (held && numbers === 'Inner Boston') expect(whole, `the last chip cut: ${measured.at(-1)}`).toBe(false);
        if (!held && numbers === 'fixture') expect(whole, `the last chip whole: ${measured.at(-1)}`).toBe(true);
        if (last === 'contracts') {
          const medals = (await page.getByTestId('medals').boundingBox())!;
          expect(medals.x + medals.width, `three medals whole: ${measured.at(-1)}`).toBeLessThanOrEqual(endBox.x + endBox.width);
        }
      }
      test.info().annotations.push({ type: `chrome % in the countdown late in a game, ${last}${held ? ', with a save not set aside' : ''}`, description: measured.join('; ') });
      // Cut or whole, its full words are in its title and its name.
      const words = (await end.locator('.chip-text').textContent())!;
      await expect(end).toHaveAttribute('title', words);
      if (last === 'contracts') await expect(page.getByRole('button', { name: new RegExp(`^${words}`) })).toBeVisible();
      else await expect(end).toHaveText(words);
    });
  }

  test('the measure bites: a 400 × 200 chrome panel more breaks the at-rest budget', async ({ page }) => {
    await page.setViewportSize({ width: 1152, height: 720 });
    await page.goto('./');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(page);
    expect(await chromeShare(page)).toBeLessThanOrEqual(REST);
    await page.evaluate(() => {
      const extra = Object.assign(document.createElement('div'), { style: 'position:absolute;left:300px;top:200px;width:400px;height:200px' });
      extra.dataset.chrome = 'rest';
      document.body.append(extra);
    });
    expect(await chromeShare(page)).toBeGreaterThan(REST);
  });
});
