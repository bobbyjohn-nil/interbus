// Panels that move and stay open together (D25: "when you open 2 tabs, they conflict and you can't use
// it, either make it so that the tabs are moveable or make it so that one closes when you open another,
// preferably the former"). Finance and Saves open side by side, neither covering the other; Finance
// drags by its heading and keeps its place when closed and opened again; a press brings a panel to
// the front; and the line tool's card takes its own place beside them, the tool still out. Shown
// failing (TS-04) on the shell before the layer, where opening Finance closed the tool and Saves
// replaced Finance.
import { expect, test, type Locator } from '@playwright/test';
import { foundCompany } from './found';
import { build, city } from './shell';

const apart = async (a: Locator, b: Locator) => {
  const [p, q] = [(await a.boundingBox())!, (await b.boundingBox())!];
  return p.x + p.width <= q.x || q.x + q.width <= p.x || p.y + p.height <= q.y || q.y + q.height <= p.y;
};
const z = (l: Locator) => l.evaluate((el) => Number(getComputedStyle(el.closest('.movable')!).zIndex));

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
});
