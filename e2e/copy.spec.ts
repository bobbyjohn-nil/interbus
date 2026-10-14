// The copy convention on the page (D25: "Capitalization is important, make sure everything has proper
// grammar"; src/ui/copyRules.ts): one game from Home through a day's close, every heading, button,
// label, option, column, caption, tooltip and accessible name read on each screen it passes. Shown
// failing (TS-04) on the build before the copy pass, which listed 34: 'off', 'every 10 min', 'interbus',
// 'build 859ca0b', a colour swatch named '#c0392b' and the draft card's 'every 20 min needs …'.
import { expect, test, type Page } from '@playwright/test';
import { DEBUG_STOPS } from '../src/sim/commands/debugLine';
import { copyProblems } from '../src/ui/copyRules';
import { foundCompany, leaveHome } from './found';
import { city, onDepotLand, setSpeed, toScreen, zoomOutOnce } from './shell';

/** The words on screen a player reads as labels, and every tooltip and accessible name. */
function screenWords(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    // The page, not only the app: a dropdown's list is drawn over it (Dropdown.tsx).
    const app = document.body;
    const labels = 'h1, h2, h3, h4, button, label, legend, option, th, caption, p, strong, .chip-label, .chip, .dropdown-label, .dropdown-hint, .demand-name, .demand-what, .build-chip, [role="status"], [role="alert"]';
    for (const el of app.querySelectorAll(labels)) {
      if (el.tagName !== 'OPTION' && !visible(el)) continue;
      // A label's own words: text not inside a nested label of its own.
      const own = [...el.childNodes].map((n) => (n.nodeType === Node.TEXT_NODE ? n.textContent : n instanceof HTMLElement && !n.matches(labels) ? n.innerText : '')).join('');
      if (own.trim()) out.push(own);
    }
    for (const el of app.querySelectorAll('[title], [aria-label], [placeholder]')) {
      if (!visible(el) && el.tagName !== 'OPTION') continue;
      for (const name of ['title', 'aria-label', 'placeholder']) {
        const v = el.getAttribute(name);
        if (v) out.push(v);
      }
    }
    return out;
  });
}

test.describe('the copy convention', () => {
  test.skip(!city.sim, 'no sim file in this build yet');

  test('every label, tooltip and name on the way from Home to a day’s close keeps it', async ({ page }) => {
    test.setTimeout(150_000);
    const seen = new Map<string, string[]>();
    const read = async (where: string) => seen.set(where, await screenWords(page));
    await page.goto('./');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await expect(page.getByTestId('home')).toBeVisible({ timeout: 30_000 });
    await read('home');
    await leaveHome(page);
    await expect(page.getByTestId('founding-card')).toBeVisible();
    await read('founding');
    await foundCompany(page);
    await zoomOutOnce(page);
    await read('rest');
    await page.getByTestId('demand-chip').click();
    await read('demand menu');
    await page.keyboard.press('Escape');
    await page.getByTestId('speed-menu').click();
    await read('speed menu');
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Place a depot' }).click();
    const [dx, dy] = await toScreen(page, onDepotLand());
    await page.mouse.move(dx - 20, dy);
    await page.mouse.move(dx, dy, { steps: 3 });
    await expect(page.getByTestId('depot-card')).toHaveAttribute('data-ok', 'yes', { timeout: 10_000 });
    await read('depot card');
    await page.mouse.click(dx, dy);
    await page.getByRole('button', { name: 'Draw a line' }).click();
    for (const stop of DEBUG_STOPS) {
      const [x, y] = await toScreen(page, stop.at);
      await page.mouse.click(x, y);
    }
    await expect(page.getByTestId('draft-card')).toHaveAttribute('data-price', '20600000', { timeout: 10_000 });
    await read('draft card');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByTestId('inspector')).toBeVisible();
    await read('line panel');
    await page.getByRole('button', { name: 'Close' }).click();
    await page.getByRole('button', { name: 'Finance', exact: true }).click();
    await read('finance');
    await page.getByTestId('finance-breakdown').click();
    await page.getByRole('button', { name: 'Buying and building' }).click();
    await read('finance breakdown');
    await page.getByTestId('finance-lines').click();
    await read('finance lines');
    await page.getByRole('button', { name: 'Close' }).click();
    const placed = (await page.getByTestId('map').getAttribute('data-stops'))!.split(' ').map((s) => s.split(/[:,]/).map(Number));
    const [sx, sy] = await toScreen(page, [placed[1]![1]!, placed[1]![2]!]);
    await page.mouse.click(sx, sy);
    await expect(page.getByTestId('stop-card')).toBeVisible();
    await read('stop card');
    await page.getByRole('button', { name: 'Saves' }).click();
    await page.getByTestId('slot-1').getByRole('button', { name: 'Save here' }).click();
    await expect(page.getByTestId('slot-1-when')).toBeVisible();
    await read('saves');
    await page.getByRole('button', { name: 'Close' }).click();

    // A day to its close: the day card, then the contracts the checklist opens.
    await setSpeed(page, '5,400×');
    const card = page.getByTestId('day-card');
    await expect(card).toBeVisible({ timeout: 60_000 });
    await page.getByRole('button', { name: 'Pause' }).click();
    await read('day card');
    await card.getByRole('button', { name: 'Continue' }).click();
    const checklist = page.getByTestId('checklist');
    if ((await checklist.count()) && (await checklist.evaluate((el) => el.tagName === 'BUTTON'))) {
      await checklist.click();
      await expect(page.getByTestId('contracts')).toBeVisible();
      await read('contracts');
    }

    const problems = [...seen].flatMap(([where, words]) => copyProblems(words).map((p) => `${where}: ${p}`));
    test.info().annotations.push({ type: 'screens read', description: [...seen.keys()].join(', ') });
    expect(problems).toEqual([]);
  });
});
