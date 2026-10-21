// A late game of many lines (the systems audit's seventh round, the screens with many lines): the fixture's 18 lines, drawn by
// Create's own rule along its corridors both ways (src/sim/scene.ts lateScene), imported through Saves at 1152×720, I13's
// tightest size. Each test was shown failing (TS-04) with its fix taken out.
import { createHash } from 'node:crypto';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { loadCity } from '../src/sim/city/simfile';
import { encode } from '../src/sim/save/save';
import { FIXTURE_CORRIDORS, lateScene } from '../src/sim/scene';
import { foundCompany } from './found';

/** The fixture's late game, imported over a founded company, paused. */
async function lateGame(page: Page) {
  await page.setViewportSize({ width: 1152, height: 720 });
  const simFile = page.waitForResponse((r) => /\/cities\/sim-[^/]+\.json$/.test(new URL(r.url()).pathname));
  await page.goto('./');
  const text = await (await simFile).text();
  const loaded = loadCity(text);
  if (!loaded.ok) throw new Error(loaded.problem);
  const { city } = loaded;
  const world = lateScene(city, { id: city.id, revision: city.extent, hash: createHash('sha256').update(text).digest('hex') }, FIXTURE_CORRIDORS, 30);
  await foundCompany(page);
  await page.getByRole('button', { name: 'Saves' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import a save file' }).click();
  await page.getByRole('button', { name: 'Replace this game' }).click();
  await (await chooser).setFiles({ name: 'late.json', mimeType: 'application/json', buffer: Buffer.from(encode(world.state, { sha: 'late', version: '0.0.0' })) });
  await expect(page.getByTestId('notice')).toContainText('Save file loaded');
  await page.getByTestId('saves').getByRole('button', { name: 'Close' }).click();
  return world;
}

/** Whether `el` shows whole in the part of `panel` the window shows, and how far past the panel's foot it ends. */
async function shownIn(panel: Locator, el: Locator) {
  const [p, b] = [(await panel.boundingBox())!, (await el.boundingBox())!];
  return { whole: b.y >= p.y - 1 && b.y + b.height <= p.y + p.height + 1, below: Math.round(b.y + b.height - (p.y + p.height)) };
}

test.describe('a late game of many lines', () => {
  // The line card's link opened Finance's Lines on its line, the row expanded but below the panel's foot, under the lines
  // before it, and nothing scrolled to it: the link seemed to do nothing.
  test('the line card’s “Fare and money in Finance” shows that line’s money and fare band', async ({ page }) => {
    const world = await lateGame(page);
    const last = world.state.lines.at(-1)!;
    expect(world.state.lines.length).toBe(18);
    await page.getByRole('button', { name: 'Lines', exact: true }).click();
    const lines = page.getByTestId('inspector');
    await lines.getByRole('tab', { name: last.name, exact: true }).click();
    await lines.getByRole('button', { name: 'Fare and money in Finance' }).click();
    const finance = page.getByTestId('finance');
    await expect(finance.getByRole('button', { name: last.name, exact: true })).toHaveAttribute('aria-expanded', 'true');
    await expect(finance.getByTestId('fare-band')).toBeVisible();
    for (const part of [finance.getByTestId(`line-money-${last.id}`), finance.getByTestId('line-forecast'), finance.getByTestId('fare-band')]) {
      expect(await shownIn(finance, part)).toMatchObject({ whole: true });
    }
  });

  // The tabs are a tablist, so the arrow keys move along them and Tab leaves them for the card (WAI-ARIA's tabs pattern):
  // before, the arrows did nothing, and the keyboard took a Tab press a tab to reach the line card. A change picked on a low
  // line showed its Run it below the panel's foot, and nothing scrolled to it (30 lines' tabs at 1152×720).
  test('the Lines tabs take the arrow keys, and a change picked on the last line shows its Run it', async ({ page }) => {
    const world = await lateGame(page);
    const [first, second, last] = [world.state.lines[0]!, world.state.lines[1]!, world.state.lines.at(-1)!];
    await page.getByRole('button', { name: 'Lines', exact: true }).click();
    const panel = page.getByTestId('inspector');
    const tab = (name: string) => panel.getByRole('tab', { name, exact: true });
    await tab(first.name).focus();
    await page.keyboard.press('ArrowRight');
    await expect(tab(second.name)).toBeFocused();
    await expect(tab(second.name)).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowLeft');
    await expect(tab(first.name)).toBeFocused();
    await page.keyboard.press('End');
    await expect(tab(last.name)).toBeFocused();
    await expect(tab(last.name)).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Home');
    await expect(tab(first.name)).toBeFocused();
    // One Tab leaves the tabs for the card's first control.
    await page.keyboard.press('Tab');
    await expect(panel.getByTestId('line-model')).toBeFocused();

    // 600 px tall, so the fixture's 18 lines' tabs push the card past the panel's foot as 30 lines' do at 720.
    await page.setViewportSize({ width: 1152, height: 600 });
    await tab(last.name).click();
    await panel.getByTestId('headway-peak').click();
    await page.getByRole('option', { name: 'Every 30 min' }).click();
    const run = panel.getByTestId('headway-change').getByRole('button', { name: 'Run it' });
    await expect(run).toBeVisible();
    expect(await shownIn(panel, panel.getByTestId('headway-change'))).toMatchObject({ whole: true });
  });
});
