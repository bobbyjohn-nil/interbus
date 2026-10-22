// Help (PLAN §8's keyboard shortcuts, listed; src/ui/shell/Help.tsx): ? opens it and closes it again, in the game and on
// Home, but never from a field, where it is typed; Saves opens it in the game and Home beside its card, in Saves' place; one
// the keyboard opened takes the focus, and its tables are a Tab stop the arrows scroll while they scroll; and it holds the
// accessibility floor. Shown failing (TS-04) on the build before Help, which had none of it.
import { expect, test, type Page } from '@playwright/test';
import { axeProblems, smallThings } from './a11y';
import { foundCompany, leaveHome } from './found';
import { city } from './shell';

test.describe('Help', () => {
  test.skip(!city.sim, 'no sim file in this build yet');

  async function ready(page: Page) {
    await page.goto('./');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
  }

  test('? opens it and closes it again, and Escape closes it; typed into the company’s name, it is the name’s', async ({ page }) => {
    await ready(page);
    await leaveHome(page);
    const help = page.getByTestId('help');
    const name = page.getByTestId('founding-card').getByLabel('Name');
    await name.fill('Back Bay');
    await name.press('?');
    await expect(name).toHaveValue('Back Bay?');
    await expect(help).toHaveCount(0);
    await foundCompany(page);
    await page.keyboard.press('?');
    await expect(help).toBeVisible();
    await expect(help.getByRole('heading', { name: 'Keys' })).toBeVisible();
    await page.keyboard.press('?');
    await expect(help).toHaveCount(0);
    await page.keyboard.press('?');
    await expect(help).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(help).toHaveCount(0);
  });

  test('Saves opens it in the game, and Home beside its card in Saves’ place, as ? does there', async ({ page }) => {
    await ready(page);
    await leaveHome(page);
    await foundCompany(page);
    const help = page.getByTestId('help');
    const saves = page.getByTestId('saves');
    await page.getByTestId('saves-chip').click();
    await saves.getByRole('button', { name: 'Help', exact: true }).click();
    await expect(help).toBeVisible();
    await expect(saves).toBeVisible();
    await saves.getByRole('button', { name: 'Back to Home' }).click();
    const home = page.getByTestId('home');
    await expect(home).toBeVisible();
    await expect(help).toHaveCount(0);
    await home.getByRole('button', { name: 'Help', exact: true }).click();
    await expect(help).toBeVisible();
    await home.getByRole('button', { name: 'Saves', exact: true }).click();
    await expect(saves).toBeVisible();
    await expect(help).toHaveCount(0);
    await page.keyboard.press('?');
    await expect(help).toBeVisible();
    await expect(saves).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(help).toHaveCount(0);
    await expect(home).toBeVisible();
  });

  test('from the keyboard it takes the focus, its tables a Tab stop the arrows scroll, and it holds the floor and axe-core', async ({ page }) => {
    await page.setViewportSize({ width: 1152, height: 720 });
    await ready(page);
    await leaveHome(page);
    await foundCompany(page);
    const build = page.getByTestId('build');
    await build.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(build).toBeFocused();
    await page.keyboard.press('?');
    const help = page.getByTestId('help');
    await expect(help).toBeVisible();
    // The panel's box has it, so the next Tab is its Close, and the one after its tables, which scroll at 720 px high.
    await expect.poll(() => help.evaluate((el) => el.parentElement === document.activeElement)).toBe(true);
    await page.keyboard.press('Tab');
    await expect(help.getByRole('button', { name: 'Close', exact: true })).toBeFocused();
    await page.keyboard.press('Tab');
    const tables = help.getByRole('region', { name: 'Help' });
    await expect(tables).toBeFocused();
    for (let k = 0; k < 4; k++) await page.keyboard.press('ArrowDown');
    await expect.poll(() => tables.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    expect(await smallThings(page)).toEqual([]);
    expect(await axeProblems(page)).toEqual([]);
  });
});
