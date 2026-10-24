// The day card at PLAN's smallest window, 1152×720 (the systems audit, D26): a busy quarter's last
// close (its report card, a contract paid, a medal, snow named for tomorrow, interest and every kind of
// buying and selling) is taller than the window. The card stays inside it above the dock, as the panels
// do, what does not fit scrolls inside it, and Continue stays in view. Shown failing (TS-04) before the
// fix: the card ran from 60 px to 800, Continue lay below the window's edge where no press reached it,
// nothing scrolled, and the card lay over the dock's buttons until the next close replaced it.
import { expect, test, type Locator, type Page } from './base';
import { axeProblems } from './a11y';
import { foundCompany } from './found';
import { city, setSpeed, withBusyQuarterClose, withDebugLine } from './shell';

/** The report's words and figures that the stamp, as drawn, lies over. */
const coveredBy = (stamp: Locator) =>
  stamp.evaluate((el) => {
    const s = el.getBoundingClientRect();
    const words = document.createTreeWalker(el.closest('.report')!, NodeFilter.SHOW_TEXT);
    const covered: string[] = [];
    for (let n = words.nextNode(); n; n = words.nextNode()) {
      if (el.contains(n) || !n.textContent?.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      for (const r of range.getClientRects()) {
        if (r.left < s.right && s.left < r.right && r.top < s.bottom && s.top < r.bottom) covered.push(n.textContent.trim());
      }
    }
    return covered;
  });

/** A stamp set down on the report card now: the animations it starts with, and how it shows in their first moment. */
const freshStamp = (stamp: Locator) =>
  stamp.evaluate((el) => {
    const copy = el.cloneNode(true) as HTMLElement;
    el.parentElement!.append(copy);
    const seen = { animations: copy.getAnimations().map((a) => (a as CSSAnimation).animationName), opacity: getComputedStyle(copy).opacity };
    copy.remove();
    return seen;
  });

/** The contrast on the card's paper of a stamp set down with `word`, as WCAG counts it: drawn in the word's colour. */
const stampContrast = (stamp: Locator, word: string) =>
  stamp.evaluate((el, word) => {
    const copy = el.cloneNode(true) as HTMLElement;
    copy.dataset.stamp = word;
    copy.textContent = word;
    el.parentElement!.append(copy);
    const channel = (v: number) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    const light = (css: string) => {
      const [r, g, b] = css.match(/[\d.]+/g)!.slice(0, 3).map((v) => channel(Number(v)));
      return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
    };
    const [ink, paper] = [light(getComputedStyle(copy).color), light(getComputedStyle(el.closest('.day-card')!).backgroundColor)];
    copy.remove();
    return (Math.max(ink, paper) + 0.05) / (Math.min(ink, paper) + 0.05);
  }, word);

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
    await page.addInitScript(() =>
      document.addEventListener('animationend', (e) => {
        if (e.target instanceof Element && e.target.matches('.stamp')) (window as unknown as { landed?: string }).landed = e.animationName;
      }),
    );
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
    await expect(card.getByTestId('event-news')).toHaveText(/ from Q2 Day 2, for \d+ days?/);
    await expect(card.locator('tr[data-kind="interest"]')).toHaveCount(1);
    await expect(card.getByTestId('medal-news')).toHaveCount(1);

    // The city's stamp on the report card (PLAN §4's charm moments): its word for the payout, pressed down as the card
    // showed, now at rest over none of the report's words or figures, at the card's widest or narrowest. Set down with less
    // motion asked for, it is simply there, rather than waiting unseen for a landing that never comes; and each word's colour
    // stands 4.5:1 on the card's paper, Fined's the softest.
    const stamp = card.getByTestId('report-stamp');
    const payout = Number(await card.getByTestId('report-card').getAttribute('data-payout'));
    await expect(stamp).toHaveText(payout > 0 ? 'Approved' : payout < 0 ? 'Fined' : 'Noted');
    await expect.poll(() => page.evaluate(() => (window as unknown as { landed?: string }).landed)).toBe('stamp-down');
    await expect(stamp).toHaveCSS('opacity', '1');
    expect(await coveredBy(stamp)).toEqual([]);
    await card.evaluate((el) => void (el.style.maxWidth = '260px'));
    expect(await coveredBy(stamp)).toEqual([]);
    await card.evaluate((el) => void (el.style.maxWidth = ''));
    expect(await freshStamp(stamp)).toEqual({ animations: ['stamp-down'], opacity: '0' });
    // Less motion stays asked for from here on: turned back, the stamp would land again, unseen at first, under the checks below.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(await freshStamp(stamp)).toEqual({ animations: [], opacity: '1' });
    for (const word of ['Approved', 'Noted', 'Fined']) expect(await stampContrast(stamp, word), word).toBeGreaterThanOrEqual(4.5);

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
    // Its rows hold nothing focusable, so while they scroll the box is a Tab stop named by the card's heading, for the
    // keyboard's arrows where the browser lets no scrolling box take the focus by itself (axe-core's
    // scrollable-region-focusable, the accessibility pass; useScrollStop).
    const rows = card.locator('.day-card-scroll');
    await expect(rows).toHaveAttribute('tabindex', '0');
    await expect(rows).toHaveRole('region');
    await expect(rows).toHaveAccessibleName('Year 1, Q1, Day 8 closed');
    expect(await axeProblems(page)).toEqual([]);
    expect(await go.boundingBox()).toEqual(at);

    // A press on Continue, where the player sees it, closes the card.
    await page.mouse.click(at.x + at.width / 2, at.y + at.height / 2);
    await expect(card).toHaveCount(0);
  });

  test('keeps the keyboard on its rows at the next close, back at their top, and hands it to Continue once they fit', async ({ page }) => {
    // The next close built its card anew, and the focus on its rows fell to the page (the systems audit's fourteenth round). In
    // a window 400 px high the next close's rows scroll too; back at 720 they fit, and the rows stop being a stop. Shown
    // failing (TS-04) with the card built anew at each close, without the rows' return to their top (29 px down), and without the
    // hand-off to Continue.
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1152, height: 720 });
    await page.goto('./');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(page);
    await withBusyQuarterClose(page);
    await setSpeed(page, '600×');
    const card = page.getByTestId('day-card');
    await expect(card).toBeVisible({ timeout: 30_000 });
    const first = (await card.getAttribute('aria-label'))!;
    const rows = card.locator('.day-card-scroll');
    await expect(rows).toHaveAttribute('tabindex', '0');
    await rows.focus();
    await page.keyboard.press('End');
    await expect.poll(() => rows.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    await page.setViewportSize({ width: 1152, height: 400 });
    await page.keyboard.press('5'); // 5,400×: the next close in about 16 s
    await expect(card).not.toHaveAttribute('aria-label', first, { timeout: 40_000 });
    await expect(rows).toHaveAttribute('tabindex', '0');
    await expect(rows).toBeFocused();
    expect(await rows.evaluate((el) => el.scrollTop)).toBe(0);
    await page.setViewportSize({ width: 1152, height: 720 });
    await expect(rows).not.toHaveAttribute('tabindex');
    await expect(card.getByRole('button', { name: 'Continue' })).toBeFocused();
  });

  test('adds no Tab stop on a close whose rows fit', async ({ page }) => {
    await page.goto('./');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(page);
    // The debug line's game at 23:50, ten minutes before its day closes (shell.ts).
    await withDebugLine(page, (d) => void (d.clock.elapsed = 86_400 + 18 * 3_600 + 50 * 60));
    await setSpeed(page, '600×');
    const card = page.getByTestId('day-card');
    await expect(card).toBeVisible({ timeout: 30_000 });
    const rows = card.locator('.day-card-scroll');
    expect(await rows.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);
    await expect(rows).not.toHaveAttribute('tabindex');
    await expect(rows).not.toHaveAttribute('role');
  });

  // Help opened with ? from a busy card's rows went on over the next close, whose rows fit, and gave the focus back to the rows as
  // it closed: no Tab stop any more, where Space paused the game and Enter did nothing (the systems audit's sixteenth round). Rows
  // that do not scroll hand the focus to Continue as they take it, as they do when they stop scrolling under it. Shown failing
  // (TS-04) on main, the focus on the rows.
  test('hands the keyboard to Continue as Help, opened from its busy rows, closes over a close whose rows fit', async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1152, height: 720 });
    await page.goto('./');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(page);
    await withBusyQuarterClose(page);
    await setSpeed(page, '600×');
    const card = page.getByTestId('day-card');
    await expect(card).toBeVisible({ timeout: 30_000 });
    const first = (await card.getAttribute('aria-label'))!;
    const rows = card.locator('.day-card-scroll');
    await expect(rows).toHaveAttribute('tabindex', '0');
    // The rows reached from the keyboard, so Help opened from them takes the focus, as a panel the keyboard opens does.
    await card.getByRole('button', { name: 'Continue' }).focus();
    await page.keyboard.press('Shift+Tab');
    await expect(rows).toBeFocused();
    await page.keyboard.press('?');
    const help = page.getByTestId('help');
    await expect(help).toBeVisible();
    await expect.poll(() => help.evaluate((el) => el.closest('[data-movable]')!.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('5'); // 5,400×: the next close in about 16 s
    await expect(card).not.toHaveAttribute('aria-label', first, { timeout: 40_000 });
    await expect(rows).not.toHaveAttribute('tabindex');
    await page.keyboard.press('?');
    await expect(help).toHaveCount(0);
    // Help's hand-back, an effect after it has gone, gives the rows the focus, which they hand on as they take it: on main they
    // kept it until something measured them again, which may come or not.
    await expect.poll(() => page.evaluate(() => document.activeElement !== document.body)).toBe(true);
    expect(await page.evaluate(() => !!document.activeElement?.matches('.day-card-scroll'))).toBe(false);
    await expect(card.getByRole('button', { name: 'Continue' })).toBeFocused();
  });

  // In the middle at the top, the card lay over the second panel opened: while time runs a close's card comes every 16 s at
  // 5,400×, and with Lines open 73.5% of Finance lay under it at 1152×720, its views among it, so a press on Breakdown landed on
  // the card (the systems audit's fifteenth round). It stands beside the panels where a gap holds it now, narrower if it must
  // be. Shown failing (TS-04) on main, where Finance's views lay under it at each of I13's sizes.
  for (const [width, height] of [[1152, 720], [1366, 768], [1440, 900]] as const) {
    test(`stands beside Lines and Finance, opened before time runs, at ${width}×${height}`, async ({ page }) => {
      test.setTimeout(90_000);
      await page.setViewportSize({ width, height });
      await page.goto('./');
      await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
      await foundCompany(page);
      // The debug line's game a minute before its day closes.
      await withDebugLine(page, (d) => void (d.clock.elapsed = 86_400 + 18 * 3_600 + 59 * 60));
      await page.getByRole('button', { name: 'Lines', exact: true }).click();
      await page.getByRole('button', { name: 'Finance', exact: true }).click();
      await expect(page.locator('.panel h2')).toHaveCount(2);
      await setSpeed(page, '60×');
      const card = page.getByTestId('day-card');
      await expect(card).toBeVisible({ timeout: 30_000 });
      await page.getByRole('button', { name: 'Pause' }).click();
      // The panels' headings, Finance's views and each panel's Close, at their middles, and the card's own heading and Continue.
      const under = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('.panel h2, [data-testid="finance"] [role="tab"], .panel > .close')].flatMap((el) => {
          const r = el.getBoundingClientRect();
          return el.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)) ? [] : [el.textContent ?? ''];
        }),
      );
      expect(under).toEqual([]);
      for (const part of [card.locator('h2'), card.getByRole('button', { name: 'Continue' })]) {
        const r = (await part.boundingBox())!;
        expect(await page.evaluate(([x, y]) => !!document.elementFromPoint(x!, y!)?.closest('[data-testid="day-card"]'), [r.x + r.width / 2, r.y + r.height / 2])).toBe(true);
      }
      // And a press on Breakdown lands on it.
      await page.getByTestId('finance').getByRole('tab', { name: 'Breakdown' }).click({ timeout: 5_000 });
      await expect(page.getByTestId('finance').getByRole('tab', { name: 'Breakdown' })).toHaveAttribute('aria-selected', 'true');
    });
  }

  /** The debug line's game a minute before its day closes, at `width`×`height`, with `panels` opened from the dock, played to the close's card and paused. */
  async function cardBeside(page: Page, width: number, height: number, panels: readonly string[]) {
    await page.setViewportSize({ width, height });
    await page.goto('./');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(page);
    await withDebugLine(page, (d) => void (d.clock.elapsed = 86_400 + 18 * 3_600 + 59 * 60));
    for (const name of panels) await page.getByRole('button', { name, exact: true }).click();
    await expect(page.locator('.panel h2')).toHaveCount(panels.length);
    await setSpeed(page, '60×');
    const card = page.getByTestId('day-card');
    await expect(card).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Pause' }).click();
    return card;
  }

  /** Whether the card lies over none of the open panels, across. */
  const clearOfPanels = (card: Locator) =>
    card.evaluate((el) => {
      const c = el.getBoundingClientRect();
      return [...document.querySelectorAll('.panel-layer > [data-movable]')].every((p) => {
        const r = p.getBoundingClientRect();
        return c.right <= r.left || c.left >= r.right;
      });
    });

  // Beside the panels the card stood over the speed menu's list, every option under it at 1152×720 with Lines and Finance open,
  // so no speed could be picked until Continue (the review of the fifteenth round's fixes). A menu stands over the card now while
  // one shows. Shown failing (TS-04) without that, the pick landing on the card.
  test('the speed menu opens over the card beside Lines and Finance, and a speed can be picked', async ({ page }) => {
    test.setTimeout(90_000);
    await cardBeside(page, 1152, 720, ['Lines', 'Finance']);
    await page.getByTestId('speed-menu').click();
    await page.getByRole('option').filter({ has: page.locator('.dropdown-label', { hasText: /^600×$/ }) }).click({ timeout: 5_000 });
    await expect(page.getByTestId('speed-menu')).toContainText('600×');
  });

  // Raised over the card, an open list lay over the map's credit too: a fare list in Finance over "Protomaps" at 1152×720, and
  // with Finance dragged left over "© OpenStreetMap contributors" (the systems audit's sixteenth round), which stays in view
  // whenever the map shows (CLAUDE.md). The corner stands over the lists while a card shows, as over the menus. Shown failing
  // (TS-04) on main, the list over the credit.
  test('leaves the map’s credit over an open list that reaches the corner', async ({ page }) => {
    test.setTimeout(90_000);
    await cardBeside(page, 1152, 720, ['Lines', 'Finance']);
    await page.getByTestId('speed-menu').click();
    const list = page.getByRole('listbox');
    await expect(list).toBeVisible();
    // The list laid over the corner, as a fare list low in Finance lies there.
    const credit = page.getByText('© OpenStreetMap contributors');
    const c = (await credit.boundingBox())!;
    await list.evaluate((el, [x, y]) => Object.assign(el.style, { left: `${x! - 40}px`, top: `${y! - 40}px`, bottom: 'auto' }), [c.x + c.width / 2, c.y + c.height / 2]);
    expect(await onTop(credit)).toBe(true);
  });

  // Placed only as it showed, the card stood where it was as a panel opened or closed under it, or the window narrowed, and no test
  // held the watch that places it again; dragged, it moved at each step of the drag, into the middle and back (the review of the
  // fifteenth round's fixes). Shown failing (TS-04) without the watch, and with the card placed at each step of a drag.
  test('moves beside a panel opened while it shows and back as it closes, keeps clear as the window narrows, and moves once a drag ends', async ({ page }) => {
    test.setTimeout(90_000);
    const card = await cardBeside(page, 1366, 768, ['Lines']);
    const middle = () => card.evaluate((el) => Math.abs(el.getBoundingClientRect().left + el.getBoundingClientRect().width / 2 - window.innerWidth / 2));
    expect(await middle()).toBeLessThan(2);
    await page.getByRole('button', { name: 'Finance', exact: true }).click();
    await expect(page.locator('.panel h2')).toHaveCount(2);
    await expect.poll(() => clearOfPanels(card)).toBe(true);
    await page.setViewportSize({ width: 1152, height: 720 });
    await expect.poll(() => clearOfPanels(card)).toBe(true);
    // Finance dragged 200 px left in ten steps: the card stays where it is through the drag, then stands clear of where Finance went.
    const left = () => card.evaluate((el) => Math.round(el.getBoundingClientRect().left));
    const finance = page.locator('[data-movable="finance"]');
    const from = await left();
    const wasAt = (await finance.boundingBox())!.x;
    const h = (await page.getByTestId('finance').locator('h2').boundingBox())!;
    await page.mouse.move(h.x + 10, h.y + h.height / 2);
    await page.mouse.down();
    for (let k = 1; k <= 10; k++) {
      await page.mouse.move(h.x + 10 - 20 * k, h.y + h.height / 2);
      expect(await left(), `the drag's step ${k}`).toBe(from);
    }
    expect((await finance.boundingBox())!.x).toBeLessThan(wasAt - 150);
    await page.mouse.up();
    await expect.poll(() => clearOfPanels(card)).toBe(true);
    // Finance closed: nothing is in the middle's way.
    await page.getByRole('button', { name: 'Finance', exact: true }).click();
    await expect(page.locator('.panel h2')).toHaveCount(1);
    await expect.poll(middle).toBeLessThan(2);
  });
});
