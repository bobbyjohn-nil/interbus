// Help (PLAN §8's keyboard shortcuts, listed; src/ui/shell/Help.tsx): ? opens it and closes it again, in the game and on
// Home, but never from a field, where it is typed, nor from an open list, which keeps its keys; Saves opens it in the game in
// Saves' place, and Home beside its card in Saves' place, and leaving Home closes it; one the keyboard opened takes the focus
// and hands it back as it closes, and its tables are a Tab stop the arrows scroll while they scroll; and it holds the
// accessibility floor. Shown failing (TS-04) on the build before Help, which had none of it, and each of its review's cases
// (#157) with its fix taken out.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { axeProblems, smallThings } from './a11y';
import { foundCompany, leaveHome } from './found';
import { city } from './shell';

test.describe('Help', () => {
  test.skip(!city.sim, 'no sim file in this build yet');

  async function ready(page: Page) {
    await page.goto('./');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
  }

  /** Puts the keyboard on `button` as Tab would, so what it opens takes the focus (focusSource). */
  async function tabOnto(page: Page, button: Locator) {
    await button.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(button).toBeFocused();
  }

  test('? opens it and closes it again, held opens it once, and Escape closes it; in the company’s name it is the name’s', async ({ page }) => {
    await ready(page);
    await leaveHome(page);
    const help = page.getByTestId('help');
    const card = page.getByTestId('founding-card');
    const name = card.getByLabel('Name');
    await name.fill('Back Bay');
    await name.press('?');
    await expect(name).toHaveValue('Back Bay?');
    await expect(help).toHaveCount(0);
    // A colour is no field: ? opens Help from it (the review of #157).
    await card.getByRole('radio').first().focus();
    await page.keyboard.press('?');
    await expect(help).toBeVisible();
    await page.keyboard.press('?');
    await expect(help).toHaveCount(0);
    await foundCompany(page);
    // Held: the second keydown is a repeat, which opens nothing more, so Help stays open.
    await page.keyboard.down('?');
    await page.keyboard.down('?');
    await page.keyboard.up('?');
    await expect(help).toBeVisible();
    await expect(help.getByRole('heading', { name: 'Keys' })).toBeVisible();
    await page.keyboard.press('?');
    await expect(help).toHaveCount(0);
    await page.keyboard.press('?');
    await expect(help).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(help).toHaveCount(0);
  });

  test('an open list keeps its keys: ? opens no Help over it, and opens it once the list has closed', async ({ page }) => {
    await ready(page);
    await leaveHome(page);
    await foundCompany(page);
    const speed = page.getByTestId('speed-menu');
    await speed.focus();
    await page.keyboard.press('ArrowDown');
    const list = page.getByRole('listbox');
    await expect(list).toBeVisible();
    await page.keyboard.press('?');
    await expect(page.getByTestId('help')).toHaveCount(0);
    await expect(list).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(list).toHaveCount(0);
    await page.keyboard.press('?');
    await expect(page.getByTestId('help')).toBeVisible();
  });

  test('Saves opens it in the game in Saves’ place, and Home beside its card in Saves’ place; leaving Home closes it', async ({ page }) => {
    await ready(page);
    const home = page.getByTestId('home');
    const help = page.getByTestId('help');
    const saves = page.getByTestId('saves');
    // Home's Help, then New game: the founding card shows alone (with Help it took 31.6% of 1152×720).
    await home.getByRole('button', { name: 'Help', exact: true }).click();
    await expect(help).toBeVisible();
    await leaveHome(page);
    await expect(help).toHaveCount(0);
    await foundCompany(page);
    // Saves' Help takes Saves' place (the two together took 35.5% of 1152×720).
    await page.getByTestId('saves-chip').click();
    await saves.getByRole('button', { name: 'Help', exact: true }).click();
    await expect(help).toBeVisible();
    await expect(saves).toHaveCount(0);
    await help.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByTestId('saves-chip').click();
    await saves.getByRole('button', { name: 'Back to Home' }).click();
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
    // Continue closes it too.
    await home.getByTestId('home-continue').click();
    await expect(home).toHaveCount(0);
    await expect(help).toHaveCount(0);
  });

  test('closing it hands the focus back: to Home’s Help on Home, and to the Saves chip from Saves’ Help', async ({ page }) => {
    await ready(page);
    const home = page.getByTestId('home');
    const help = page.getByTestId('help');
    const homeHelp = home.getByTestId('home-help');
    await tabOnto(page, homeHelp);
    await page.keyboard.press('Enter');
    await expect(help).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(help.getByRole('button', { name: 'Close', exact: true })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(help).toHaveCount(0);
    await expect(homeHelp).toBeFocused();

    await leaveHome(page);
    await foundCompany(page);
    const chip = page.getByTestId('saves-chip');
    await tabOnto(page, chip);
    await page.keyboard.press('Enter');
    const savesHelp = page.getByTestId('saves').getByRole('button', { name: 'Help', exact: true });
    for (let k = 0; k < 40 && !(await savesHelp.evaluate((el) => el === document.activeElement)); k++) await page.keyboard.press('Tab');
    await expect(savesHelp).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(help).toBeVisible();
    await expect.poll(() => help.evaluate((el) => el.parentElement === document.activeElement)).toBe(true);
    await page.keyboard.press('Escape');
    await expect(help).toHaveCount(0);
    await expect(chip).toBeFocused();
  });

  test('from the keyboard it takes the focus, its tables a Tab stop the arrows scroll, and it holds the floor and axe-core', async ({ page }) => {
    await page.setViewportSize({ width: 1152, height: 720 });
    await ready(page);
    await leaveHome(page);
    await foundCompany(page);
    const build = page.getByTestId('build');
    await tabOnto(page, build);
    await page.keyboard.press('?');
    const help = page.getByTestId('help');
    await expect(help).toBeVisible();
    // The panel's box has it, so the next Tab is its Close, and the one after its tables, which scroll at 720 px high.
    await expect.poll(() => help.evaluate((el) => el.parentElement === document.activeElement)).toBe(true);
    await page.keyboard.press('Tab');
    await expect(help.getByRole('button', { name: 'Close', exact: true })).toBeFocused();
    await page.keyboard.press('Tab');
    const tables = help.getByRole('region', { name: 'Keys and the map' });
    await expect(tables).toBeFocused();
    for (let k = 0; k < 4; k++) await page.keyboard.press('ArrowDown');
    await expect.poll(() => tables.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    expect(await smallThings(page)).toEqual([]);
    expect(await axeProblems(page)).toEqual([]);
  });
});
