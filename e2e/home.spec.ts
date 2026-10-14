// Home (the M5 spec, item 3; exit check 1's first step): the first screen over the paused map. New
// game leads to the founding card; Saves' Back to Home returns to it, where Continue names the game
// and goes on with it; New game asks before it replaces that game, and the slots stay.
import { expect, test } from '@playwright/test';
import { foundCompany, leaveHome, STARTING_CENTS } from './found';
import { build, city, onDepotLand, toScreen, zoomOutOnce } from './shell';

test.describe('Home', () => {
  test.skip(!city.sim, 'no sim file in this build yet');

  test('opens first, continues the game, and asks before a new game replaces it', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('./');
    const home = page.getByTestId('home');
    await expect(home).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('home-continue')).toHaveCount(0); // a first visit has nothing to continue
    await expect(page.getByTestId('sim-panel')).toHaveCount(0); // the chip row waits for the game
    await expect(page.getByTestId('build-chip')).toBeVisible();

    await foundCompany(page);
    const panel = page.getByTestId('sim-panel');
    await zoomOutOnce(page);
    await build(page, 'Place a depot');
    const [dx, dy] = await toScreen(page, onDepotLand());
    await page.mouse.click(dx, dy);
    await expect(panel).toHaveAttribute('data-cash', String(STARTING_CENTS - 15_000_000));
    await page.getByRole('button', { name: 'Saves' }).click();
    await page.getByTestId('slot-1').getByRole('button', { name: 'Save here' }).click();

    // Back to Home pauses and saves; Continue names the game and goes on with it.
    await page.getByRole('button', { name: 'Back to Home' }).click();
    await expect(home).toBeVisible();
    await expect(page.getByTestId('home-continue')).toContainText('Back Bay Transit · Year 1, Q1, Day 1 · $324,548');
    await leaveHome(page, 'continue');
    await expect(panel).toHaveAttribute('data-cash', String(STARTING_CENTS - 15_000_000));
    await expect(panel).toHaveAttribute('data-speed', '0');

    // New game asks first; Keep it keeps the game.
    await page.getByRole('button', { name: 'Saves' }).click();
    await page.getByRole('button', { name: 'Back to Home' }).click();
    await home.getByRole('button', { name: 'New game' }).click();
    await expect(home).toContainText('Start over? Back Bay Transit, on Year 1, Q1, Day 1, will be replaced. Your slots stay.');
    await home.getByRole('button', { name: 'Keep it' }).click();
    await expect(page.getByTestId('home-continue')).toBeVisible();

    // Start a new game: the founding card for an unnamed company, the autosave replaced, slot 1 kept.
    await home.getByRole('button', { name: 'New game' }).click();
    await home.getByRole('button', { name: 'Start a new game' }).click();
    await expect(page.getByTestId('founding-card')).toBeVisible();
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('interbus.save.boston') ?? '{}').data?.company?.name)).toBe('');
    expect(await page.evaluate(() => localStorage.getItem('interbus.slot.boston.1'))).toContain('Back Bay Transit');

    // A reload comes back to Home with nothing to continue, since the new company is not yet named.
    await page.reload();
    await expect(home).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('home-continue')).toHaveCount(0);

    // Slot 1 loaded from Home's Saves goes straight into that game.
    await home.getByRole('button', { name: 'Saves' }).click();
    await page.getByTestId('slot-1').getByRole('button', { name: 'Load' }).click();
    await page.getByTestId('slot-1').getByRole('button', { name: 'Replace this game' }).click();
    await expect(home).toBeHidden();
    await expect(page.getByTestId('sim-panel')).toHaveAttribute('data-cash', String(STARTING_CENTS - 15_000_000));
  });
});
