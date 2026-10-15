// The demand menu (D25: "the demand points are always on, they should be toggleable ... Different kinds
// of demand should be separated, such as the purple and blue, have a separate dropdown or other type of
// menu to toggle demand point types"). Shown failing (TS-04) with the toggle doing nothing, where the
// map still drew every dot; with Escape left to the page, where it also closed the open panel; and with
// Space left to the page after the mouse pressed an item, where it played instead once a button pressed
// with the mouse no longer kept Space.
import { expect, test } from '@playwright/test';
import { foundCompany, leaveHome } from './found';
import { city } from './shell';

test.describe('the demand menu', () => {
  test.skip(!city.sim, 'no sim file in this build yet');

  test('shows and hides homes and jobs separately, remembers the choice, and keeps an open panel on Escape', async ({ page }) => {
    await page.goto('./');
    const map = page.getByTestId('map');
    await expect(map).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(page);
    await expect(map).toHaveAttribute('data-dot-kinds', 'home,job');
    await expect.poll(async () => Number(await map.getAttribute('data-dots')), { timeout: 30_000 }).toBeGreaterThan(100);
    const all = Number(await map.getAttribute('data-dots'));

    const chip = page.getByTestId('demand-chip');
    await chip.click();
    const menu = page.getByTestId('demand-menu');
    const homes = menu.getByRole('menuitemcheckbox', { name: /Homes/ });
    const jobs = menu.getByRole('menuitemcheckbox', { name: /Jobs/ });
    await expect(homes).toHaveAttribute('aria-checked', 'true');
    await expect(jobs).toHaveAttribute('aria-checked', 'true');
    await expect(homes).toContainText(/Where people live · ≈[\d,]+ people/);
    await expect(jobs).toContainText(/Where people work · ≈[\d,]+ jobs/);

    // Homes off: only the jobs draw.
    await homes.click();
    await expect(homes).toHaveAttribute('aria-checked', 'false');
    await expect(map).toHaveAttribute('data-dot-kinds', 'job');
    await expect.poll(async () => Number(await map.getAttribute('data-dots')), { timeout: 10_000 }).toBeLessThan(all);
    expect(Number(await map.getAttribute('data-dots'))).toBeGreaterThan(0);
    // Space and Enter turn the item the mouse pressed on and off too, and leave time alone: the menu
    // keeps them, where the page's Space would pause or play after a button pressed with the mouse.
    const panel = page.getByTestId('sim-panel');
    const speed = (await panel.getAttribute('data-speed'))!;
    await page.keyboard.press('Space');
    await expect(homes).toHaveAttribute('aria-checked', 'true');
    await expect(map).toHaveAttribute('data-dot-kinds', 'home,job');
    await page.keyboard.press('Enter');
    await expect(homes).toHaveAttribute('aria-checked', 'false');
    await expect(map).toHaveAttribute('data-dot-kinds', 'job');
    await expect(panel).toHaveAttribute('data-speed', speed);
    // Jobs off too, from the keyboard: nothing draws.
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Space');
    await expect(jobs).toHaveAttribute('aria-checked', 'false');
    await expect(map).toHaveAttribute('data-dot-kinds', '');
    await expect(map).toHaveAttribute('data-dots', '0', { timeout: 10_000 });

    // Escape closes the menu and leaves an open panel open.
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await page.getByRole('button', { name: 'Finance' }).click();
    await expect(page.getByTestId('finance')).toBeVisible();
    await chip.click();
    await expect(menu).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await expect(page.getByTestId('finance')).toBeVisible();

    // The choice holds across a reload; both back on, every dot draws again.
    await page.reload();
    await expect(map).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await expect(map).toHaveAttribute('data-dot-kinds', '');
    await leaveHome(page, 'continue');
    await chip.click();
    await homes.click();
    await jobs.click();
    await expect(map).toHaveAttribute('data-dot-kinds', 'home,job');
    await expect.poll(async () => Number(await map.getAttribute('data-dots')), { timeout: 10_000 }).toBe(all);
  });
});
