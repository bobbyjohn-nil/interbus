// A panel with little room (the systems audit's eighth round): the Lines panel dragged as low as it goes, 160 px of it left in the
// window at 1152×720 (Panels.tsx), with the debug line. A change picked there opens its card below the panel's foot, so the card
// is scrolled into view; its body scrolls, never the heading (the drag handle) and Close above it. Each test was shown failing
// (TS-04) with its fix taken out.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { foundCompany } from './found';
import { withDebugLine } from './shell';

/** Whether `el` shows whole in the part of `panel` the window shows. */
async function shownIn(panel: Locator, el: Locator) {
  const [p, b] = [(await panel.boundingBox())!, (await el.boundingBox())!];
  return { whole: b.y >= p.y - 1 && b.y + b.height <= p.y + p.height + 1, below: Math.round(b.y + b.height - (p.y + p.height)) };
}

/** Lines open with the debug line, dragged by its heading as low as it goes. */
async function linesLow(page: Page) {
  await page.setViewportSize({ width: 1152, height: 720 });
  await page.goto('./');
  await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
  await foundCompany(page);
  await withDebugLine(page);
  await page.getByRole('button', { name: 'Lines', exact: true }).click();
  const panel = page.getByTestId('inspector');
  const h = (await panel.getByRole('heading').first().boundingBox())!;
  await page.mouse.move(h.x + 10, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(h.x + 10, 720 + 200, { steps: 8 });
  await page.mouse.up();
  return panel;
}

test.describe('the Lines panel dragged low', () => {
  // The headway change card was revealed (#140), the model swap card beside it never: it opened 24 px under the panel's foot,
  // Buy and swap with it.
  test('a bus model picked shows its swap card whole, Buy and swap with it', async ({ page }) => {
    const panel = await linesLow(page);
    const model = panel.getByTestId('line-model');
    await model.focus();
    expect(await shownIn(panel, model)).toMatchObject({ whole: true });
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    const swap = panel.getByTestId('model-change');
    await expect(swap).toBeVisible();
    expect(await shownIn(panel, swap)).toMatchObject({ whole: true });
    expect(await shownIn(panel, swap.getByRole('button', { name: 'Buy and swap' }))).toMatchObject({ whole: true });
  });

  // The reveal scrolled the whole panel, 126 px: its heading and Close ended above its top, and moving or closing it took a
  // scroll back up first.
  test('a headway picked shows its change card, and the heading and Close stay in view', async ({ page }) => {
    const panel = await linesLow(page);
    await panel.getByTestId('headway-peak').click();
    await page.getByRole('option', { name: 'Every 30 min' }).click();
    await expect(panel.getByTestId('headway-change')).toBeVisible();
    expect(await shownIn(panel, panel.getByTestId('headway-change'))).toMatchObject({ whole: true });
    expect(await shownIn(panel, panel.getByRole('heading').first())).toMatchObject({ whole: true });
    expect(await shownIn(panel, panel.getByRole('button', { name: 'Close', exact: true }))).toMatchObject({ whole: true });
  });

  // Close line's ask opened under the controls, 65 px below the foot, and nothing scrolled to it, so the button seemed to do
  // nothing (the review of the change).
  test('Close line shows its ask whole, Close it with it', async ({ page }) => {
    const panel = await linesLow(page);
    await panel.getByRole('button', { name: 'Close line' }).click();
    const ask = panel.getByTestId('close-line');
    await expect(ask).toBeVisible();
    expect(await shownIn(panel, ask)).toMatchObject({ whole: true });
    expect(await shownIn(panel, ask.getByRole('button', { name: 'Close it' }))).toMatchObject({ whole: true });
  });
});
