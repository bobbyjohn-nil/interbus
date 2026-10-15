// I13 (PLAN §8, the M2 spec item 7): the calm shell covers 6% of the screen or less at rest and 26%
// or less with a panel open, at 1440×900, 1366×768 and 1152×720, in the light theme. Chrome is every
// element marked data-chrome: the chip row, the dock, notices, the credits and build chip, the compass
// and the demand chip, and the one panel (Home, the founding card, the demand menu, the Build menu,
// the draft card, the inspector, the route editor, a stop's card, Finance, Saves).
import { expect, test, type Page } from '@playwright/test';
import { DEBUG_STOPS } from '../src/sim/commands/debugLine';
import { SAVE_FORMAT } from '../src/sim/save/save';
import { UNBACKED_COPY } from '../src/ui/copy';
import { foundCompany, leaveHome, STARTING_CENTS } from './found';
import { build, chromeShare, city, fillStorage, onDepotLand, toScreen, zoomOutOnce } from './shell';

const SIZES = [
  [1440, 900],
  [1366, 768],
  [1152, 720],
] as const;
const REST = 0.06;
const PANEL = 0.26;

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
      await page.getByRole('button', { name: 'Close' }).click();
      shares.restWithLine = await chromeShare(page);
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
      await page.getByRole('button', { name: 'Close' }).click();
      // A stop's card, from where the second stop snapped.
      const placed = (await page.getByTestId('map').getAttribute('data-stops'))!.split(' ').map((s) => s.split(/[:,]/).map(Number));
      const [sx, sy] = await toScreen(page, [placed[1]![1]!, placed[1]![2]!]);
      await page.mouse.click(sx, sy);
      await expect(page.getByTestId('stop-card')).toBeVisible();
      shares.stop = await chromeShare(page);
      // Panels stay open together (D25), so each is measured alone: the stop card closes first.
      await page.getByTestId('stop-card').getByRole('button', { name: 'Close' }).click();
      await page.getByRole('button', { name: 'Saves' }).click();
      // Every slot full, each naming when it was saved, and a set-aside save: the save list at its tallest (the M5 spec, item 4).
      for (const n of [1, 2, 3]) {
        await page.getByTestId(`slot-${n}`).getByRole('button', { name: 'Save here' }).click();
        await expect(page.getByTestId(`slot-${n}-when`)).toBeVisible();
      }
      await expect(page.getByTestId('set-aside-older')).toBeVisible();
      shares.saves = await chromeShare(page);
      // With a question open, Load's in a slot's row and Import's below the slots, each in place of its row's other buttons.
      await savesAsking(page, shares);

      const rounded = Object.fromEntries(Object.entries(shares).map(([k, v]) => [k, Math.round(v * 1000) / 10]));
      test.info().annotations.push({ type: 'chrome %', description: JSON.stringify(rounded) });
      expect(shares.rest, JSON.stringify(rounded)).toBeLessThanOrEqual(REST);
      expect(shares.restWithLine, JSON.stringify(rounded)).toBeLessThanOrEqual(REST);
      for (const panel of ['home', 'founding', 'demand', 'build', 'draft', 'inspector', 'routeEditor', 'finance', 'financeLines', 'financeBreakdown', 'financeBought', 'stop', 'saves', 'savesLoad', 'savesImport']) expect(shares[panel], `${panel} ${JSON.stringify(rounded)}`).toBeLessThanOrEqual(PANEL);
    });
  }

  // A save the start could not set aside (a disk too full for its backup): its notice is untimed, at-rest
  // chrome until Saves opens, so Home, the shell at rest and at rest with a line are measured beside it;
  // then Saves with that save in the autosave's row, with its buttons, every slot full and a set-aside
  // save, at rest and with Load's question or Import's open: the save list at its tallest. At 1152×720
  // only, the tightest size. Shown failing (TS-04) with the notice "A save couldn’t be set aside: see
  // Saves" (6.05% at rest with a line), with Export this game beside Import's question, which wrapped it
  // to a second row (Saves 26.005%), and with Save here beside Load's question, which wrapped its slot's
  // row (26.01%).
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
    await expect(notice).toHaveText(UNBACKED_COPY);
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
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(notice).toHaveText(UNBACKED_COPY);
    shares.restWithLine = await chromeShare(page);
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
    for (const panel of ['home', 'saves', 'savesLoad', 'savesImport']) expect(shares[panel], `${panel} ${JSON.stringify(rounded)}`).toBeLessThanOrEqual(PANEL);
  });

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
