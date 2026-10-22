// The copy convention on the page (D25: "Capitalization is important, make sure everything has proper
// grammar"; src/ui/copyRules.ts): one game from Home through a day's close, every heading, button,
// label, option, column, caption, tooltip and accessible name read on each screen it passes. Shown
// failing (TS-04) on the build before the copy pass, which listed 34: 'off', 'every 10 min', 'interbus',
// 'build 859ca0b', a colour swatch named '#c0392b' and the draft card's 'every 20 min needs …'.
//
// The same screens hold the accessibility floor (PLAN §8, UX-08; e2e/a11y.ts): every control 24 px or
// more each way and the text 12 px or more on each, and axe-core on the ones that bring something new.
// Shown failing (TS-04) on the build before it: the Build menu's 11 px descriptions, Finance's chart
// labels at 9.3 px, and axe-core's region rule on the speed menu, whose list sat loose in the body.
import { expect, test, type Page } from '@playwright/test';
import { DEBUG_STOPS } from '../src/sim/commands/debugLine';
import { copyProblems } from '../src/ui/copyRules';
import { axeProblems, smallThings } from './a11y';
import { foundCompany, leaveHome } from './found';
import { build, city, onDepotLand, setSpeed, toScreen, zoomOutOnce } from './shell';

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

test.describe('the copy convention and the accessibility floor', () => {
  test.skip(!city.sim, 'no sim file in this build yet');

  test('every label, tooltip and name on the way from Home to a day’s close keeps it, and every screen holds the floor', async ({ page }) => {
    test.setTimeout(150_000);
    const seen = new Map<string, string[]>();
    const small = new Map<string, string[]>();
    const axe = new Map<string, string[]>();
    // axe-core takes about half a second a screen, so it reads those that bring something new: a card, a panel, a menu.
    const AXED = new Set(['founding', 'speed menu', 'build menu', 'stop site card', 'draft card', 'line panel', 'route editor', 'finance', 'finance lines', 'stop card', 'saves', 'day card', 'contracts']);
    const read = async (where: string) => {
      seen.set(where, await screenWords(page));
      small.set(where, await smallThings(page));
      if (AXED.has(where)) axe.set(where, await axeProblems(page));
    };
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

    await page.getByTestId('build').click();
    await read('build menu');
    // A stop placed on its own (D25): the card at the pointer, and the lone stop's card.
    await build(page, 'Place a stop');
    const [hx, hy] = await toScreen(page, [-71.0903, 42.33995]);
    await page.mouse.move(hx - 20, hy);
    await page.mouse.move(hx, hy, { steps: 3 });
    await expect(page.getByTestId('stop-site-card')).toHaveAttribute('data-ok', 'yes', { timeout: 10_000 });
    await read('stop site card');
    await page.mouse.click(hx, hy);
    await page.keyboard.press('Escape');
    await expect(async () => {
      await page.mouse.click(hx, hy);
      await expect(page.getByTestId('stop-card')).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 10_000 });
    await read('lone stop card');
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await build(page, 'Place a depot');
    const [dx, dy] = await toScreen(page, onDepotLand());
    await page.mouse.move(dx - 20, dy);
    await page.mouse.move(dx, dy, { steps: 3 });
    await expect(page.getByTestId('depot-card')).toHaveAttribute('data-ok', 'yes', { timeout: 10_000 });
    await read('depot card');
    await page.mouse.click(dx, dy);
    await build(page, 'Draw a line');
    for (const stop of DEBUG_STOPS) {
      const [x, y] = await toScreen(page, stop.at);
      await page.mouse.click(x, y);
    }
    await expect(page.getByTestId('draft-card')).toHaveAttribute('data-price', '20600000', { timeout: 10_000 });
    await read('draft card');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByTestId('inspector')).toBeVisible();
    await read('line panel');
    await page.getByRole('button', { name: 'Edit route' }).click();
    await page.getByTestId('route-editor').getByRole('button', { name: /^Remove / }).first().click();
    await expect(page.getByTestId('route-editor')).toHaveAttribute('data-refusal', '', { timeout: 10_000 });
    await read('route editor');
    await page.getByRole('button', { name: 'Cancel' }).click();
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: 'Finance', exact: true }).click();
    await read('finance');
    await page.getByTestId('finance-breakdown').click();
    await page.getByRole('button', { name: 'Buying and building' }).click();
    await read('finance breakdown');
    await page.getByTestId('finance-lines').click();
    await read('finance lines');
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    const placed = (await page.getByTestId('map').getAttribute('data-stops'))!.split(' ').map((s) => s.split(/[:,]/).map(Number));
    const [sx, sy] = await toScreen(page, [placed[1]![1]!, placed[1]![2]!]);
    await page.mouse.click(sx, sy);
    await expect(page.getByTestId('stop-card')).toBeVisible();
    await read('stop card');
    // Panels stay open together (D25): the stop card goes before Saves opens, each read alone.
    await page.getByTestId('stop-card').getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: 'Saves' }).click();
    await page.getByTestId('slot-1').getByRole('button', { name: 'Save here' }).click();
    await expect(page.getByTestId('slot-1-when')).toBeVisible();
    await read('saves');
    await page.getByRole('button', { name: 'Close', exact: true }).click();

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
    expect([...small].flatMap(([where, things]) => things.map((t) => `${where}: ${t}`))).toEqual([]);
    expect([...axe].flatMap(([where, found]) => found.map((f) => `${where}: ${f}`))).toEqual([]);
  });
});
