// I13 (PLAN §8, the M2 spec item 7): the calm shell covers 6% of the screen or less at rest and 26%
// or less with a panel open, at 1440×900, 1366×768 and 1152×720, in the light theme. Chrome is every
// element marked data-chrome: the chip row, the dock, notices, the credits and build chip, and the
// one panel (the founding card, the draft card, the inspector, a stop's card, Finance).
import { expect, test } from '@playwright/test';
import { DEBUG_STOPS } from '../src/sim/commands/debugLine';
import { foundCompany } from './found';
import { chromeShare, city, onDepotLand, toScreen, zoomOutOnce } from './shell';

const SIZES = [
  [1440, 900],
  [1366, 768],
  [1152, 720],
] as const;
const REST = 0.06;
const PANEL = 0.26;

test.describe('the screen budget (I13)', () => {
  test.skip(!city.sim, 'no sim file in this build yet');

  for (const [width, height] of SIZES) {
    test(`at ${width}×${height}: ≤6% at rest, ≤26% with each panel`, async ({ page }) => {
      test.setTimeout(90_000);
      await page.setViewportSize({ width, height });
      await page.goto('./');
      await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
      await expect(page.getByTestId('founding-card')).toBeVisible({ timeout: 30_000 });
      const shares: Record<string, number> = { founding: await chromeShare(page) };
      await foundCompany(page);
      await zoomOutOnce(page);
      shares.rest = await chromeShare(page);

      await page.getByRole('button', { name: 'Place a depot' }).click();
      const [dx, dy] = await toScreen(page, onDepotLand());
      await page.mouse.click(dx, dy);
      await expect(page.getByTestId('checklist')).toHaveText('2/5 Draw a line');
      await page.getByRole('button', { name: 'Draw a line' }).click();
      for (const stop of DEBUG_STOPS) {
        const [x, y] = await toScreen(page, stop.at);
        await page.mouse.click(x, y);
      }
      await expect(page.getByTestId('draft-card')).toHaveAttribute('data-price', '20600000', { timeout: 10_000 });
      shares.draft = await chromeShare(page);
      await page.getByRole('button', { name: 'Create' }).click();
      await expect(page.getByTestId('inspector')).toBeVisible();
      shares.inspector = await chromeShare(page);
      await page.getByRole('button', { name: 'Close' }).click();
      shares.restWithLine = await chromeShare(page);
      // Finance: the depot and the line are today's purchases, and on day 1 both today's column and
      // the quarter's, founding capital included, come to the cash.
      await page.getByRole('button', { name: 'Finance' }).click();
      const finance = page.getByTestId('finance');
      await expect(finance.locator('tr[data-kind="purchase"]')).toHaveAttribute('data-today', String(-15_000_000 - 20_600_000));
      await expect(finance).toHaveAttribute('data-today', '7120000');
      await expect(finance).toHaveAttribute('data-quarter', '7120000');
      shares.finance = await chromeShare(page);
      await page.getByRole('button', { name: 'Close' }).click();
      // A stop's card, from where the second stop snapped.
      const placed = (await page.getByTestId('map').getAttribute('data-stops'))!.split(' ').map((s) => s.split(/[:,]/).map(Number));
      const [sx, sy] = await toScreen(page, [placed[1]![1]!, placed[1]![2]!]);
      await page.mouse.click(sx, sy);
      await expect(page.getByTestId('stop-card')).toBeVisible();
      shares.stop = await chromeShare(page);

      const rounded = Object.fromEntries(Object.entries(shares).map(([k, v]) => [k, Math.round(v * 1000) / 10]));
      test.info().annotations.push({ type: 'chrome %', description: JSON.stringify(rounded) });
      expect(shares.rest, JSON.stringify(rounded)).toBeLessThanOrEqual(REST);
      expect(shares.restWithLine, JSON.stringify(rounded)).toBeLessThanOrEqual(REST);
      for (const panel of ['founding', 'draft', 'inspector', 'finance', 'stop']) expect(shares[panel], `${panel} ${JSON.stringify(rounded)}`).toBeLessThanOrEqual(PANEL);
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
