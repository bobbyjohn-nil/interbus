// The day card at PLAN's smallest window, 1152×720 (the systems audit, D26): a busy quarter's last
// close (its report card, a contract paid, a medal, snow named for tomorrow, interest and every kind of
// buying and selling) is taller than the window. The card stays inside it above the dock, as the panels
// do, what does not fit scrolls inside it, and Continue stays in view. Shown failing (TS-04) before the
// fix: the card ran from 60 px to 800, Continue lay below the window's edge where no press reached it,
// nothing scrolled, and the card lay over the dock's buttons until the next close replaced it.
import { expect, test, type Locator } from '@playwright/test';
import { axeProblems } from './a11y';
import { foundCompany } from './found';
import { city, setSpeed, withBusyQuarterClose } from './shell';

/** Whether a press at the middle of `l` lands on it, not on something drawn over it. */
const onTop = (l: Locator) =>
  l.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
  });

test.describe('the day card', () => {
  test.skip(!city.sim, 'no sim file in this build yet');

  test('fits a 1152×720 window on a busy quarter’s last close: its rows scroll inside it, Continue stays in reach, the dock stays clear', async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1152, height: 720 }); // I13's tightest size
    await page.goto('./');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(page);

    // This game as a file, edited to 23:50 on day 8, the quarter's last, and imported back (shell.ts).
    await withBusyQuarterClose(page);

    await setSpeed(page, '600×');
    const card = page.getByTestId('day-card');
    await expect(card).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Pause' }).click();
    await expect(card.getByTestId('report-card')).toBeVisible();
    await expect(card.getByTestId('contract-outcome')).toHaveAttribute('data-outcome', 'paid');
    await expect(card.getByTestId('event-news')).toHaveAttribute('data-news', 'tomorrow');
    await expect(card.locator('tr[data-kind="interest"]')).toHaveCount(1);
    await expect(card.getByTestId('medal-news')).toHaveCount(1);

    // The card inside the window and clear of the dock, Continue in it and taking a press.
    const dock = (await page.getByTestId('dock').boundingBox())!;
    const box = (await card.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(dock.y);
    const go = card.getByRole('button', { name: 'Continue' });
    const at = (await go.boundingBox())!;
    expect(at.y).toBeGreaterThanOrEqual(box.y);
    expect(at.y + at.height).toBeLessThanOrEqual(box.y + box.height);
    expect(await onTop(go)).toBe(true);
    for (const name of ['Lines', 'Finance']) expect(await onTop(page.getByTestId('dock').getByRole('button', { name, exact: true }))).toBe(true);

    // What does not fit scrolls inside the card: the wheel over it brings the cash, its last row, into
    // view, with Continue where it was.
    const cash = card.locator('tr').last();
    await expect(cash).toContainText('Cash');
    expect(await onTop(cash)).toBe(false);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, 2_000);
    await expect.poll(() => onTop(cash)).toBe(true);
    // Its rows hold nothing focusable, so they scroll for the keyboard as a region that takes the focus itself (axe-core's
    // scrollable-region-focusable, the accessibility pass): before, Tab reached only Continue, and the rows below stayed out
    // of a keyboard player's reach where the browser lets no scroller take the focus (Safari).
    expect(await axeProblems(page)).toEqual([]);
    expect(await go.boundingBox()).toEqual(at);

    // A press on Continue, where the player sees it, closes the card.
    await page.mouse.click(at.x + at.width / 2, at.y + at.height / 2);
    await expect(card).toHaveCount(0);
  });
});
