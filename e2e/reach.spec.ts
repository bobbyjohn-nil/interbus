// Where the lost-graphics card sits against what the player must reach while it shows (the systems
// audit's fifth round): with Lines and Finance open, every panel button and the speed menu's options;
// at a day's close with nothing built, the shortest day card, its Continue, and the card's own words
// and Reload. A measurement, not a check: the PR checks skip it (set MEASURE_REACH=1). It prints each
// box and whether `elementFromPoint` finds the element at 5%, 50% and 95% of its middle row. The
// lane's first fix, `.map-notice.top.lost { z-index: calc(var(--layer-cards) + 1) }` in place of the
// `.app:has(.day-card)` rule in app.css, is measured by putting that rule back (DECISIONS, Measured).
import { expect, test, type Locator, type Page } from '@playwright/test';
import { foundCompany } from './found';
import { setSpeed, withDebugLine } from './shell';

const MEASURE = process.env.MEASURE_REACH === '1';
const SIZES = [
  [1152, 720],
  [1366, 768],
  [1440, 900],
] as const;

async function takeGraphics(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.querySelector<HTMLCanvasElement>('.maplibregl-canvas')!.getContext('webgl2')!.getExtension('WEBGL_lose_context')!.loseContext();
  });
}

function onTop(target: Locator): Promise<boolean[]> {
  return target.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return [0.05, 0.5, 0.95].map((f) => el.contains(document.elementFromPoint(r.x + r.width * f, r.y + r.height / 2)));
  });
}

const box = (target: Locator) =>
  target.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)].join(' ');
  });

async function lost(page: Page, width: number, height: number): Promise<Locator> {
  await page.setViewportSize({ width, height });
  await page.goto('./?gpu=full');
  await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
  await foundCompany(page);
  return page.getByTestId('gpu-card');
}

test.describe('the lost card’s reach', () => {
  test.skip(!MEASURE, 'a measurement: set MEASURE_REACH=1');

  for (const [width, height] of SIZES) {
    test(`at ${width}×${height}, with Lines and Finance open and the speed menu`, async ({ page }) => {
      const card = await lost(page, width, height);
      await withDebugLine(page);
      for (const name of ['Lines', 'Finance']) await page.getByRole('button', { name, exact: true }).click();
      await takeGraphics(page);
      await expect(card).toContainText('The browser took the map’s graphics away.');
      console.log(`${width}×${height} lost card ${await box(card)}`);
      const panels = page.locator('.panel');
      for (let i = 0; i < (await panels.count()); i++) {
        const panel = panels.nth(i);
        const buttons = panel.locator('button');
        const hidden: string[] = [];
        let shown = 0;
        for (let k = 0; k < (await buttons.count()); k++) {
          const button = buttons.nth(k);
          if (!(await button.isVisible())) continue;
          shown++;
          if (!(await onTop(button))[1]) hidden.push(`${(await button.innerText()).trim()} (${await box(button)})`);
        }
        console.log(`${width}×${height} ${await panel.getAttribute('aria-label')} ${await box(panel)}: ${hidden.length} of ${shown} buttons hidden ${hidden.join(', ')}`);
      }
      await page.getByTestId('speed-menu').click();
      const options = page.getByRole('option');
      const seen: string[] = [];
      for (let k = 0; k < (await options.count()); k++) seen.push(JSON.stringify(await onTop(options.nth(k))));
      console.log(`${width}×${height} speed options ${seen.join(' ')}`);
    });

    test(`at ${width}×${height}, with the shortest day card`, async ({ page }) => {
      test.setTimeout(120_000);
      const card = await lost(page, width, height);
      await setSpeed(page, '5,400×');
      const dayCard = page.getByTestId('day-card');
      await expect(dayCard).toBeVisible({ timeout: 60_000 });
      await takeGraphics(page);
      await expect(card).toContainText('The browser took the map’s graphics away.');
      const go = dayCard.getByRole('button', { name: 'Continue' });
      const reload = card.getByRole('button', { name: 'Reload' });
      console.log(`${width}×${height} lost card ${await box(card)}, day card ${await box(dayCard)}, dock ${await box(page.locator('.dock'))}`);
      console.log(`${width}×${height} Continue ${await box(go)} ${JSON.stringify(await onTop(go))}, words ${JSON.stringify(await onTop(card.locator('p')))}, Reload ${JSON.stringify(await onTop(reload))}`);
    });
  }
});
