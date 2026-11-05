// A press on a panel's scrollbar only scrolls it, so it leaves the keyboard's focus as it came, as a drag by a panel's heading
// does (Panels' onScrollbar, App's focusSource): Space then presses the control the keyboard is on, as Enter does, and plays
// nothing. Playwright's Chrome hides its scrollbars (--hide-scrollbars), which a player's Chrome on Windows or Linux draws, so this
// file's browser keeps them.
import { expect, test } from './base';
import config from '../playwright.config';
import { LINE_COLOURS } from '../src/sim/config/lines';
import { foundCompany, leaveHome } from './found';
import { city, withDebugLine } from './shell';

test.use({ launchOptions: { ...config.use?.launchOptions, ignoreDefaultArgs: ['--hide-scrollbars'] } });

test.describe('a panel’s scrollbar', () => {
  test.skip(!city.sim, 'no sim file in this build yet');

  // The systems audit's twenty-fourth round: with 30 lines at 1152×720 and the keyboard on Line 3's name in Finance's Lines, a
  // press on the body's scrollbar scrolled it, the name kept the focus and its ring, and Space played the game where Enter would
  // have opened the name's money, 6 runs of 6 at 1152×720 and Chrome's 125%. Shown failing (TS-04) with a scrollbar's press read
  // as any pointer's.
  test('leaves Space to the control the keyboard is on', async ({ page }) => {
    test.setTimeout(150_000);
    await page.setViewportSize({ width: 1152, height: 720 });
    await page.goto('./');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await leaveHome(page);
    await foundCompany(page);
    const N = 30;
    await withDebugLine(page, (d) => {
      const [first] = d.lines as Record<string, unknown>[];
      d.lines = [first, ...Array.from({ length: N - 1 }, (_, k) => ({ ...first, id: k + 2, name: `Line ${k + 2}`, colour: LINE_COLOURS[(k + 1) % LINE_COLOURS.length], stopIds: [1, 2] }))];
      d.nextIds = { ...d.nextIds, line: N + 1 };
    });
    await expect(page.getByTestId('play')).toHaveAttribute('aria-label', 'Play');
    await page.getByRole('button', { name: 'Finance', exact: true }).click();
    const finance = page.getByTestId('finance');
    await finance.getByTestId('finance-lines').click();
    const body = finance.getByTestId('finance-body');
    const name = finance.getByTestId('line-money-3').locator('button.line-name');
    await name.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(name).toBeFocused();
    // The scrollbar's thumb, at the top of its track with the body at its top, dragged 40 px down, as the round's second lane
    // dragged it: Chrome's scrollbar here has an arrow 15 px tall at each end of its track.
    const bar = await body.evaluate((b) => {
      const e = b as HTMLElement;
      return { width: e.offsetWidth - e.clientWidth, thumb: ((e.clientHeight - 30) * e.clientHeight) / e.scrollHeight };
    });
    expect(bar.width).toBeGreaterThan(0);
    const bb = (await body.boundingBox())!;
    const [x, y] = [bb.x + bb.width - bar.width / 2, bb.y + 15 + bar.thumb / 2];
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + 40, { steps: 5 });
    await page.mouse.up();
    await expect.poll(() => body.evaluate((b) => b.scrollTop)).toBeGreaterThan(0);
    await expect(name).toBeFocused();
    const open = await name.getAttribute('aria-expanded');
    await page.keyboard.press(' ');
    await expect(name).toHaveAttribute('aria-expanded', open === 'true' ? 'false' : 'true');
    await expect(page.getByTestId('play')).toHaveAttribute('aria-label', 'Play');
  });
});
