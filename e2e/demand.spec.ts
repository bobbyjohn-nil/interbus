// The demand menu (D25: "the demand points are always on, they should be toggleable ... Different kinds
// of demand should be separated, such as the purple and blue, have a separate dropdown or other type of
// menu to toggle demand point types"). Shown failing (TS-04) with the toggle doing nothing, where the
// map still drew every dot; with Escape left to the page, where it also closed the open panel; and with
// Space left to the page after the mouse pressed an item, where it played instead once a button pressed
// with the mouse no longer kept Space.
import { expect, test } from './base';
import { foundCompany, leaveHome } from './found';
import { city, setSpeed, withDebugLine } from './shell';

test.describe('the demand menu', () => {
  test.skip(!city.sim, 'no sim file in this build yet');

  test('shows and hides homes and jobs separately, remembers the choice, and keeps an open panel on Escape', async ({ page }) => {
    await page.goto('./?counts'); // the map counts the dots it draws only when asked
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

  // The systems audit's twelfth round: MapLibre settles after every frame that leaves nothing to load, and while time runs the
  // buses ask for frame after frame, so the map counted the dots it drew after each: 15–17 ms a frame on Inner Boston, 57–70
  // times in 10 s in Low graphics, for this spec's counts alone.
  test('a player’s page counts no dots, and asked, the map counts them once a settle, never at a frame the buses alone ask for', async ({ page }) => {
    await page.goto('./');
    const map = page.getByTestId('map');
    await expect(map).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(page);
    await withDebugLine(page);
    await setSpeed(page, '600×');
    // Frames the buses ask for, one after another (vehicles.ts counts them on the map's container): 2 to 30 a second here.
    const frames = async () => Number((await map.getAttribute('data-asked')) ?? 0);
    const asked = await frames();
    await expect.poll(async () => (await frames()) - asked, { timeout: 30_000 }).toBeGreaterThanOrEqual(10);
    expect(await map.getAttribute('data-dots'), 'no count in a player’s page').toBe('');
    expect(await map.getAttribute('data-dots-counted')).toBeNull();

    await page.goto('./?counts');
    await expect(map).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await leaveHome(page, 'continue');
    await expect.poll(async () => Number(await map.getAttribute('data-dots')), { timeout: 30_000 }).toBeGreaterThan(100);
    await setSpeed(page, '600×');
    // Once the menu has gone and the map has settled, the buses alone draw: ten of their frames, each of which ended in a settle.
    await page.waitForTimeout(1_000);
    const [counted, from] = [Number(await map.getAttribute('data-dots-counted')), await frames()];
    await expect.poll(async () => (await frames()) - from, { timeout: 30_000 }).toBeGreaterThanOrEqual(10);
    expect(Number(await map.getAttribute('data-dots-counted')) - counted, 'counts as the buses alone drew').toBeLessThanOrEqual(1);
  });
});
