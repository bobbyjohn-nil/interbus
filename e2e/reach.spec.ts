// Where the lost-graphics card sits against what the player must reach while it shows (the systems
// audit's fifth round): with Lines and Finance open, every panel button and the speed menu's options;
// at a day's close with nothing built, the shortest day card, its Continue, and the card's own words
// and Reload. A measurement, not a check: the PR checks skip it (set MEASURE_REACH=1). It prints each
// box and whether `elementFromPoint` finds the element at 5%, 50% and 95% of its middle row. The
// lane's first fix, `.map-notice.top.lost { z-index: calc(var(--layer-cards) + 1) }` in place of the
// `.app:has(.day-card)` rule in app.css, is measured by putting that rule back (DECISIONS, Measured).
// Then Back to Home's question in a tab another tab's saves have left behind (the systems audit's sixth round), with every slot
// full, so Saves reaches its height and scrolls: its share of the window, and its answers' reach after a press of the mouse.
import { expect, test, type Locator, type Page } from './base';
import { BACK_HOME_ASK_COPY, NEWER_LINE_COPY } from '../src/ui/copy';
import { usd } from '../src/ui/format';
import { foundCompany } from './found';
import { chromeShare, setFare, setSpeed, withDebugLine } from './shell';

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

test.describe('Back to Home’s question’s reach', () => {
  test.skip(!MEASURE, 'a measurement: set MEASURE_REACH=1');

  test('at 1152×720, with every slot full, after a press of the mouse', async ({ context }) => {
    test.setTimeout(150_000);
    const live = (p: Page) => p.evaluate(() => JSON.parse(localStorage.getItem('interbus.save.boston')!) as { data: { clock: { elapsed: number }; lines: { fareCents: number }[] } });
    const elapsed = async (p: Page) => Number(await p.getByTestId('sim-panel').getAttribute('data-elapsed'));
    const a = await context.newPage();
    await a.setViewportSize({ width: 1152, height: 720 }); // I13's tight size, for Saves with Back to Home's question
    await a.goto('./');
    await foundCompany(a);
    await withDebugLine(a);
    const b = await context.newPage();
    await b.goto('./');
    const continueB = b.getByTestId('home-continue');
    await expect(continueB).toContainText('Back Bay Transit · Year 1, Q1, Day 2 ·', { timeout: 30_000 });

    // A plays on into day 3 and changes a fare, paused: B's Home names that game, and Continue goes on with it.
    await a.bringToFront();
    await setSpeed(a, '5,400×');
    await expect.poll(() => elapsed(a), { timeout: 60_000 }).toBeGreaterThan(2 * 86_400);
    await a.getByTestId('play').click();
    await setFare(a, 'Line 1', '$3.00');
    await expect.poll(async () => (await live(a)).data.lines[0]!.fareCents).toBe(300);
    const fromA = await live(a);
    const cashA = Number(await a.getByTestId('sim-panel').getAttribute('data-cash'));
    await expect(continueB).toContainText(`Back Bay Transit · Year 1, Q1, Day 3 · ${usd(cashA)}`);
    await b.bringToFront();
    await continueB.click();
    await expect(b.getByTestId('sim-panel')).toHaveAttribute('data-elapsed', String(fromA.data.clock.elapsed));
    await expect(b.getByTestId('saves-chip')).toHaveText('Saves');

    // B plays on, so its saves are the newest: A, still on its game, says it is overtaken and writes nothing over them.
    await setSpeed(b, '600×');
    await expect(a.getByTestId('saves-chip')).toHaveText('Autosave off', { timeout: 10_000 });
    await expect(a.getByTestId('notice')).toHaveText('Another tab changed the autosave');
    await expect.poll(() => elapsed(b), { timeout: 30_000 }).toBeGreaterThan(fromA.data.clock.elapsed + 3_600);
    await b.getByTestId('play').click();
    await expect(b.getByTestId('sim-panel')).toHaveAttribute('data-speed', '0');
    await expect.poll(async () => (await live(b)).data.clock.elapsed).toBe(await elapsed(b));
    const fromB = await live(b);
    expect(fromB.data.lines[0]!.fareCents).toBe(300);
    await a.bringToFront();
    await setSpeed(a, '600×');
    await expect.poll(() => elapsed(a)).toBeGreaterThan(fromA.data.clock.elapsed + 1_800);
    await a.getByTestId('play').click();
    await expect(a.getByTestId('sim-panel')).toHaveAttribute('data-speed', '0');
    await a.waitForTimeout(500);
    expect((await live(a)).data.clock.elapsed).toBe(fromB.data.clock.elapsed);
    await expect(a.getByTestId('saves-chip')).toHaveText('Autosave off');

    // Fill every slot (kept), then play on again, so the question shows with Saves at its tallest.
    await a.getByTestId('day-card').getByRole('button', { name: 'Continue' }).click();
    await a.getByTestId('saves-chip').click();
    const savesA = a.getByTestId('saves');
    for (let k = 0; k < 3; k++) {
      await savesA.getByRole('button', { name: 'Save here' }).nth(k).click();
      await a.waitForTimeout(400);
    }
    await savesA.getByRole('button', { name: 'Close', exact: true }).click();
    await setSpeed(a, '600×');
    await a.waitForTimeout(1500);
    await a.getByTestId('play').click();
    await a.getByTestId('saves-chip').click();
    await expect(savesA.getByTestId('saves-refused')).toHaveText(NEWER_LINE_COPY);
    const before = await chromeShare(a);
    await savesA.getByRole('button', { name: 'Back to Home' }).click();
    await expect(savesA.getByTestId('saves-home-ask')).toHaveText(BACK_HOME_ASK_COPY);
    const after = await chromeShare(a);
    await a.waitForTimeout(300);
    const reach = async (name: string) => savesA.getByRole('button', { name }).evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { box: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)], top: [0.1, 0.5, 0.9].map((f) => el.contains(document.elementFromPoint(r.x + r.width * f, r.y + r.height / 2))) };
    });
    const panel = await savesA.evaluate((el) => { const r = el.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height), el.scrollHeight, el.clientHeight, el.scrollTop]; });
    console.log(`1152×720 Saves ${(before * 100).toFixed(2)}% → ${(after * 100).toFixed(2)}% with the question; panel ${panel.join(' ')} (x y w h, scroll height, client height, scroll top)`);
    console.log(`1152×720 Replace this game ${JSON.stringify(await reach('Replace this game'))}, Keep playing ${JSON.stringify(await reach('Keep playing'))}`);
  });
});
