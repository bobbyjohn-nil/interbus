// Panels that move and stay open together (D25: "when you open 2 tabs, they conflict and you can't use
// it, either make it so that the tabs are moveable or make it so that one closes when you open another,
// preferably the former"). Finance and Saves open side by side, neither covering the other; Finance
// drags by its heading and keeps its place when closed and opened again; a press brings a panel to
// the front; and the line tool's card takes its own place beside them, the tool still out. Shown
// failing (TS-04) on the shell before the layer, where opening Finance closed the tool and Saves
// replaced Finance. The systems audit's (D26) two below were shown failing on the layer before their
// fix: Contracts opened past the bottom of a 720 px window, over the dock and the map's credit, and behind
// Lines, pressed before it opened; and a narrower window left a panel dragged near the right edge out
// of sight and cut off one that opened in a free place. The systems audit's fourth round: Tab into a
// panel dragged past the window's edge scrolls nothing (shown failing below).
import { expect, test, type Locator, type Page } from '@playwright/test';
import { DEBUG_STOPS } from '../src/sim/commands/debugLine';
import { LINE_COLOURS } from '../src/sim/config/lines';
import { foundCompany } from './found';
import { build, city, toScreen, withDebugLine, zoomOutOnce } from './shell';

const apart = async (a: Locator, b: Locator) => {
  const [p, q] = [(await a.boundingBox())!, (await b.boundingBox())!];
  return p.x + p.width <= q.x || q.x + q.width <= p.x || p.y + p.height <= q.y || q.y + q.height <= p.y;
};
const z = (l: Locator) => l.evaluate((el) => Number(getComputedStyle(el.closest('.movable')!).zIndex));
/** Whether a press at the middle of `l` lands on it, not on a panel over it. */
const onTop = (l: Locator) =>
  l.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
  });
/** Drags a panel by its heading. */
const dragBy = async (page: Page, panel: Locator, heading: string, dx: number, dy: number) => {
  const h = (await panel.getByRole('heading', { name: heading }).boundingBox())!;
  await page.mouse.move(h.x + 10, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(h.x + 10 + dx, h.y + h.height / 2 + dy, { steps: 8 });
  await page.mouse.up();
};

test.describe('movable panels', () => {
  test.skip(!city.sim, 'no sim file in this build yet');

  test('open side by side, drag by the heading, come to the front, and leave a tool out', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('./');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(page);
    const finance = page.getByTestId('finance');
    const saves = page.getByTestId('saves');

    // Two panels at once, side by side, the newer to the left.
    await page.getByRole('button', { name: 'Finance', exact: true }).click();
    await page.getByRole('button', { name: 'Saves' }).click();
    await expect(finance).toBeVisible();
    await expect(saves).toBeVisible();
    expect(await apart(finance, saves)).toBe(true);
    expect((await saves.boundingBox())!.x).toBeLessThan((await finance.boundingBox())!.x);

    // Finance drags by its heading, 300 px left and 200 px down.
    const heading = finance.getByRole('heading', { name: 'Finance' });
    const from = (await finance.boundingBox())!;
    const h = (await heading.boundingBox())!;
    await page.mouse.move(h.x + 10, h.y + h.height / 2);
    await page.mouse.down();
    await page.mouse.move(h.x + 10 - 300, h.y + h.height / 2 + 200, { steps: 8 });
    await page.mouse.up();
    const to = (await finance.boundingBox())!;
    expect(Math.round(to.x - from.x)).toBe(-300);
    expect(Math.round(to.y - from.y)).toBe(200);
    // Pressed last, it is in front of Saves; a press on Saves brings Saves forward.
    expect(await z(finance)).toBeGreaterThan(await z(saves));
    await saves.getByRole('heading', { name: 'Saves' }).click();
    expect(await z(saves)).toBeGreaterThan(await z(finance));

    // A press on any part of Finance still showing brings it forward again; closed, then opened
    // again, it keeps the place it was dragged to.
    await finance.click({ position: { x: 430, y: 200 } });
    expect(await z(finance)).toBeGreaterThan(await z(saves));
    await finance.getByRole('button', { name: 'Close' }).click();
    await expect(finance).toHaveCount(0);
    await page.getByRole('button', { name: 'Finance', exact: true }).click();
    expect((await finance.boundingBox())!.x).toBe(to.x);

    // The line tool's card takes its own place: the tool stays out beside the panels.
    await build(page, 'Draw a line');
    const draft = page.getByTestId('draft-card');
    await expect(draft).toBeVisible();
    await expect(page.getByTestId('build')).toHaveAttribute('aria-pressed', 'true');
    await expect(finance).toBeVisible();
    expect(await apart(draft, saves)).toBe(true);
    // Escape puts everything down.
    await page.keyboard.press('Escape');
    await expect(draft).toHaveCount(0);
    await expect(finance).toHaveCount(0);
    await expect(saves).toHaveCount(0);
  });

  test('open inside the window on a crowded screen, clear of the dock and the map’s credit, the stop card’s Close in reach, the newest in front; dragged as low as they go, stay whole above the dock, their heading under a press', async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1152, height: 720 }); // I13's tightest size
    await page.goto('./');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(page);
    await zoomOutOnce(page);
    // Ten lines: the debug line, and nine more from Copley to Symphony.
    await withDebugLine(page, (d) => {
      const [first] = d.lines as Record<string, unknown>[];
      d.lines = [first, ...Array.from({ length: 9 }, (_, k) => ({ ...first, id: k + 2, name: `Line ${k + 2}`, colour: LINE_COLOURS[(k + 1) % LINE_COLOURS.length], stopIds: [1, 2] }))];
      d.nextIds = { ...d.nextIds, line: 11 };
    });
    // Three panels across the top and a stop's card, then Lines pressed and Contracts opened from the
    // checklist: no row has room for all 510 px of it.
    await page.getByRole('button', { name: 'Lines', exact: true }).click();
    await page.getByRole('button', { name: 'Finance', exact: true }).click();
    await page.getByRole('button', { name: 'Saves' }).click();
    const [sx, sy] = await toScreen(page, DEBUG_STOPS[2]!.at);
    await page.mouse.click(sx, sy);
    const stop = page.getByTestId('stop-card');
    await expect(stop).toBeVisible();
    const lines = page.getByTestId('inspector');
    await lines.locator('h2').first().click();
    await page.getByTestId('checklist').click();
    const contracts = page.getByTestId('contracts');
    await expect(contracts).toBeVisible();
    // Every panel inside the window; what does not fit above the dock scrolls inside its panel.
    const panels = page.locator('.movable');
    await expect(panels).toHaveCount(5);
    for (const box of await panels.all()) {
      const r = (await box.boundingBox())!;
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.width).toBeLessThanOrEqual(1152);
      expect(r.y + r.height).toBeLessThanOrEqual(720);
    }
    // Contracts, the newest, in front of Lines, pressed before it; the dock's buttons and the OSM credit still take a press.
    expect(await z(contracts)).toBeGreaterThan(await z(lines));
    expect(await onTop(contracts.getByRole('heading', { name: 'Contracts' }))).toBe(true);
    for (const name of ['Lines', 'Finance']) expect(await onTop(page.locator('.dock').getByRole('button', { name, exact: true }))).toBe(true);
    expect(await onTop(page.getByRole('link', { name: '© OpenStreetMap contributors' }))).toBe(true);
    // Lines pressed again, then Contracts shown again from the checklist: it comes to the front again.
    await lines.locator('h2').first().click();
    expect(await z(lines)).toBeGreaterThan(await z(contracts));
    await page.getByTestId('checklist').click();
    await expect.poll(async () => (await z(contracts)) > (await z(lines))).toBe(true);
    // No panel hides another: the stop's card, opened before Contracts, still closes with its own button.
    const close = stop.getByRole('button', { name: 'Close' });
    expect(await onTop(close)).toBe(true);
    await close.click();
    await expect(stop).toHaveCount(0);

    // Dragged as low as it goes (the systems audit's third round), a panel stays whole above the dock and the map's
    // credit, its heading under a press: Lines, its heading above its rows of ten tabs, by its heading
    // 700 px down over the dock, and back up; then Saves, 900 px down, its last button in reach. Shown
    // failing (TS-04) on 5f4bce3, where Lines ended at 760 px of the 720 px window, its heading at 738.
    await page.keyboard.press('Escape');
    const floor = Math.min(720 - 72, (await page.getByTestId('dock').boundingBox())!.y);
    await page.getByRole('button', { name: 'Lines', exact: true }).click();
    await expect(lines.getByRole('tab')).toHaveCount(10);
    await dragBy(page, lines, 'Line 1', -500, 700);
    const low = (await lines.boundingBox())!;
    expect(low.y + low.height, 'Lines above the dock').toBeLessThanOrEqual(floor);
    expect(await onTop(lines.getByRole('heading', { name: 'Line 1' })), 'its heading under a press').toBe(true);
    await dragBy(page, lines, 'Line 1', 0, -300);
    expect((await lines.boundingBox())!.y).toBe(low.y - 300);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Saves' }).click();
    const saves = page.getByTestId('saves');
    await expect(saves.getByTestId('slot-3')).toBeVisible();
    await dragBy(page, saves, 'Saves', -700, 900);
    const box = (await saves.boundingBox())!;
    expect(box.y + box.height, 'Saves above the dock').toBeLessThanOrEqual(floor);
    expect(await onTop(saves.getByRole('heading', { name: 'Saves' })), 'its heading under a press').toBe(true);
    await saves.evaluate((el) => void (el.scrollTop = el.scrollHeight));
    expect(await onTop(saves.getByRole('button', { name: 'Back to Home' })), 'Back to Home under a press').toBe(true);
  });

  // Tab into the part of Saves dragged past the right edge scrolled the whole page 272 px left, the top bar, the map and
  // the dock with it, and Finance then opened 272 px left of its place and jumped 272 px from the pointer when dragged.
  // The page never scrolls (the panel layer clips what hangs past the window, app.css), and a control the focus reaches
  // there brings its panel in as far as shows it (Panels.tsx). Shown failing (TS-04) on abb5f2f: html's scrollLeft read
  // 272 once Saves' Close had the focus.
  test('Tab into a panel dragged past the right edge scrolls nothing: the panel comes in to show the control, and panels open and drag where they should', async ({ page }) => {
    await page.setViewportSize({ width: 1152, height: 720 });
    await page.goto('./');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(page);
    const saves = page.getByTestId('saves');
    const finance = page.getByTestId('finance');
    const bar = (await page.getByTestId('sim-panel').boundingBox())!;
    const scrolled = () => page.evaluate(() => [document.documentElement.scrollLeft, document.body.scrollLeft, document.querySelector('.app')!.scrollLeft]);
    await page.getByTestId('saves-chip').click();
    await dragBy(page, saves, 'Saves', 900, 0);
    expect((await saves.boundingBox())!.x).toBe(1152 - 48);
    // Tab from Play reaches Saves' Close, at its top right, past the window's edge.
    const close = saves.getByRole('button', { name: 'Close' });
    await page.getByTestId('play').focus();
    for (let i = 0; i < 6 && !(await close.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab');
    await expect(close).toBeFocused();
    expect(await scrolled()).toEqual([0, 0, 0]);
    expect((await page.getByTestId('sim-panel').boundingBox())!.x).toBe(bar.x);
    const c = (await close.boundingBox())!;
    expect(c.x).toBeGreaterThanOrEqual(0);
    expect(c.x + c.width).toBeLessThanOrEqual(1152);
    // On through Saves to the dock: nothing scrolls.
    for (let i = 0; i < 8; i++) await page.keyboard.press('Tab');
    expect(await scrolled()).toEqual([0, 0, 0]);
    // Finance opens whole inside the window, and follows the pointer when dragged.
    await page.getByRole('button', { name: 'Finance', exact: true }).click();
    const f = (await finance.boundingBox())!;
    expect(f.x).toBeGreaterThanOrEqual(12);
    expect(f.x + f.width).toBeLessThanOrEqual(1152 - 12);
    await dragBy(page, finance, 'Finance', 0, 100);
    const g = (await finance.boundingBox())!;
    expect(Math.round(g.x - f.x)).toBe(0);
    expect(Math.round(g.y - f.y)).toBe(100);
    expect(await scrolled()).toEqual([0, 0, 0]);
  });

  test('keep panels in reach when the window narrows: a dragged one’s heading, open or opened again, and one in a free place whole', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('./');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(page);
    const finance = page.getByTestId('finance');
    const saves = page.getByTestId('saves');
    const dockFinance = page.getByRole('button', { name: 'Finance', exact: true });
    await dockFinance.click();
    // Dragged 400 px right: a strip of it stays on screen, as the layer allows.
    await dragBy(page, finance, 'Finance', 400, 0);
    expect((await finance.boundingBox())!.x).toBeGreaterThan(1366 - 100);
    // Saves opens in a free place to its left, whole, its right edge 64 px from the window's.
    await page.getByRole('button', { name: 'Saves' }).click();
    await expect(saves).toBeVisible();
    const before = (await saves.boundingBox())!;
    expect(before.x + before.width).toBeGreaterThan(1152);
    // The window narrows: Finance comes back within reach (its heading is pressed once it is in front,
    // below), and Saves, never dragged, comes back whole, its Close button free to press.
    await page.setViewportSize({ width: 1152, height: 720 });
    const heading = finance.getByRole('heading', { name: 'Finance' });
    const grabbed = async () => {
      const r = (await heading.boundingBox())!;
      return page.evaluate(([x, y]) => document.elementFromPoint(x!, y!)?.closest('h2')?.textContent, [r.x + 20, r.y + r.height / 2]);
    };
    await expect.poll(async () => (await finance.boundingBox())!.x).toBeLessThanOrEqual(1152 - 48);
    await expect.poll(async () => (await saves.boundingBox())!.x + before.width).toBeLessThanOrEqual(1152 - 12);
    expect(await onTop(saves.getByRole('button', { name: 'Close' }))).toBe(true);
    // Saves pressed, over Finance's heading; Finance closed and opened again, at its place inside the
    // narrower window, comes up in front, its heading under a press.
    await saves.getByRole('heading', { name: 'Saves' }).click();
    expect(await grabbed()).not.toBe('Finance');
    await dockFinance.click();
    await expect(finance).toHaveCount(0);
    await dockFinance.click();
    await expect(finance).toBeVisible();
    expect((await finance.boundingBox())!.x).toBeLessThanOrEqual(1152 - 48);
    expect(await z(finance)).toBeGreaterThan(await z(saves));
    expect(await grabbed()).toBe('Finance');
  });
});
