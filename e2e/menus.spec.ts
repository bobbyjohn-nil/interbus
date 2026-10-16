// The game's menus (the systems audit, D26, its second round): the Build menu, the demand menu, the
// dropdown lists and the cards beside the pointer draw over the movable panels, and a press on a menu's
// item works that item, never a panel under it; one press on the compass with a menu open closes the
// menu and still works the compass; and the keyboard leaves a dropdown's list, and goes through the
// Build menu's tools, as the browser's own controls let it. Shown failing (TS-04) on 7d5ca2b: Homes
// lay under Finance, where a press landed on Finance instead; the compass press only closed the menu,
// the board staying flat; Tab out of the speed list went to the map's canvas; and Tab from Build went
// on past its open menu, Place a stop never focused. The systems audit's fourth round: Escape closing
// a menu the mouse opened leaves Space to time, arrows or not (shown failing below).
import { expect, test, type Locator, type Page } from '@playwright/test';
import { foundCompany } from './found';
import { city } from './shell';

const [W, H] = [1152, 720]; // I13's tightest size
type Box = { x: number; y: number; width: number; height: number };

/** Whether a press at the middle of `l` lands on it, not on something drawn over it. */
const onTop = (l: Locator) =>
  l.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
  });
const inside = (b: Box, x: number, y: number) => x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height;
const middle = (b: Box): [number, number] => [b.x + b.width / 2, b.y + b.height / 2];

/** Drags Finance by its heading until its top left lies 30 px above and 20 px left of `spot`'s, over it. */
async function coverWithFinance(page: Page, spot: Box): Promise<Box> {
  const finance = page.getByTestId('finance');
  const from = (await finance.boundingBox())!;
  const h = (await finance.getByRole('heading', { name: 'Finance' }).boundingBox())!;
  await page.mouse.move(h.x + 10, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(h.x + 10 + spot.x - 20 - from.x, h.y + h.height / 2 + spot.y - 30 - from.y, { steps: 8 });
  await page.mouse.up();
  const box = (await finance.boundingBox())!;
  expect(inside(box, ...middle(spot)), 'Finance lies over the spot').toBe(true);
  return box;
}

/** Marks the focused element `as`, and reads the mark of the one focused (its tag where it has none). */
const mark = (page: Page, as: string) => page.evaluate((a) => document.activeElement?.setAttribute('data-was', a), as);
const focused = (page: Page) => page.evaluate(() => document.activeElement?.getAttribute('data-was') ?? document.activeElement?.tagName ?? '');

test.describe('the menus', () => {
  test.skip(!city.sim, 'no sim file in this build yet');

  test('draw over the panels, with the cards beside the pointer, and a press on an item works the item, never the panel under it', async ({ page }) => {
    await page.setViewportSize({ width: W, height: H });
    await page.goto('./');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(page);
    await page.getByRole('button', { name: 'Finance', exact: true }).click();
    const finance = page.getByTestId('finance');
    await expect(finance).toBeVisible();

    // The demand menu, with Finance dragged over where it opens: Homes shows and a press turns it off.
    const chip = page.getByTestId('demand-chip');
    const demand = page.getByTestId('demand-menu');
    const homes = demand.getByRole('menuitemcheckbox', { name: /Homes/ });
    await chip.click();
    const homesAt = (await homes.boundingBox())!;
    await page.keyboard.press('Escape');
    await coverWithFinance(page, homesAt);
    await chip.focus();
    await page.keyboard.press('Enter');
    await expect(homes).toHaveAttribute('aria-checked', 'true');
    expect(await onTop(homes), 'Homes over Finance').toBe(true);
    await page.mouse.click(...middle((await homes.boundingBox())!));
    await expect(homes).toHaveAttribute('aria-checked', 'false');
    await page.keyboard.press('Escape');
    await expect(demand).toHaveCount(0);
    await expect(finance).toBeVisible();

    // The Build menu, with Finance dragged over where it opens: a press on Place a stop takes the tool out.
    const build = page.getByTestId('build');
    const menu = page.getByTestId('build-menu');
    const placeStop = menu.getByRole('button', { name: 'Place a stop' });
    await build.click();
    const stopAt = (await placeStop.boundingBox())!;
    await page.keyboard.press('Escape');
    const over = await coverWithFinance(page, stopAt);
    await build.focus();
    await page.keyboard.press('Enter');
    await expect(menu).toBeVisible();
    expect(await onTop(placeStop), 'Place a stop over Finance').toBe(true);
    await page.mouse.click(...middle((await placeStop.boundingBox())!));
    await expect(menu).toHaveCount(0);
    await expect(build).toHaveAttribute('aria-pressed', 'true');
    await expect(finance).toBeVisible();

    // Place a stop's card beside the pointer, on the map 30 px left of Finance: it opens to the
    // pointer's right, over Finance (painted over it: a press would land on it, did it take presses).
    const [x, y] = [over.x - 30, over.y + over.height / 2];
    await page.mouse.move(x - 40, y);
    await page.mouse.move(x, y, { steps: 4 });
    const card = page.getByTestId('stop-site-card');
    await expect(card).toBeVisible();
    const c = (await card.boundingBox())!;
    expect(c.x + c.width, 'the card reaches over Finance').toBeGreaterThan(over.x + 20);
    const shown = await card.evaluate((el, [px, py]) => {
      el.style.pointerEvents = 'auto';
      const hit = el.contains(document.elementFromPoint(px!, py!));
      el.style.pointerEvents = '';
      return hit;
    }, [over.x + 10, c.y + c.height / 2]);
    expect(shown, 'the card over Finance').toBe(true);

    // Finance dragged down past the dock, which draws over the panels: it stops with its heading above the dock, still under a press.
    const heading = finance.getByRole('heading', { name: 'Finance' });
    const h = (await heading.boundingBox())!;
    await page.mouse.move(h.x + 10, h.y + h.height / 2);
    await page.mouse.down();
    await page.mouse.move(W / 2, H + 200, { steps: 8 });
    await page.mouse.up();
    const dock = (await page.getByTestId('dock').boundingBox())!;
    const low = (await heading.boundingBox())!;
    expect(low.y + low.height, 'the heading above the dock').toBeLessThanOrEqual(dock.y);
    expect(await onTop(heading), 'the heading under a press').toBe(true);
  });

  test('one press on the compass with a menu open closes the menu and works the compass', async ({ page }) => {
    await page.goto('./?gpu=full'); // the compass works on the full rung; CI's browser draws in software (gpu.ts)
    const map = page.getByTestId('map');
    await expect(map).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(page);
    // The demand menu, beside the compass; the Build menu and the dropdowns close by the same rule (pressAway.test.ts).
    await page.getByTestId('demand-chip').click();
    await expect(page.getByTestId('demand-menu')).toBeVisible();
    await page.getByTestId('compass').click();
    await expect(page.getByTestId('demand-menu')).toHaveCount(0);
    await expect(map).toHaveAttribute('data-mode', '3d');
  });

  test('Tab and Shift+Tab out of an open dropdown go on from its button, as from the browser’s own select', async ({ page }) => {
    await page.goto('./');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(page);
    const speed = page.getByTestId('speed-menu');
    const list = page.getByRole('listbox', { name: 'Speed' });
    // Where Tab and Shift+Tab go from the speed menu's button, its list closed.
    await speed.focus();
    await page.keyboard.press('Tab');
    await mark(page, 'after');
    await speed.focus();
    await page.keyboard.press('Shift+Tab');
    await mark(page, 'before');

    for (const [open, key, where] of [
      ['ArrowDown', 'Tab', 'after'],
      ['ArrowDown', 'Shift+Tab', 'before'],
      ['click', 'Tab', 'after'],
    ] as const) {
      if (open === 'click') await speed.click();
      else {
        await speed.focus();
        await page.keyboard.press(open);
      }
      await expect(list).toBeVisible();
      await expect(list).toBeFocused();
      await page.keyboard.press(key);
      await expect(list).toHaveCount(0);
      expect(await focused(page), `${key} from the list opened by ${open}`).toBe(where);
    }
  });

  // Escape hands the focus back to the menu's button as it closes the menu, and focusSource took that for the keyboard
  // reaching the button, so Space opened the menu the mouse had opened again instead of playing; and so it did after the
  // arrows had moved through the menu, once Escape alone was let off. The button gets the focus back as it had it when
  // the menu opened (focusSource.ts); a button Tab reached keeps Space through it (#112, #120). Shown failing (TS-04) on
  // abb5f2f: after Escape alone the speed stayed 0 (Space opened the Speed list again); and on the first fix, which
  // let Escape off but not the arrows before it (Escape among focusSource's modifiers), the same after ArrowDown, End
  // and Escape.
  test('Escape closing a menu the mouse opened leaves Space to play and pause, arrows or not; one reached with Tab keeps Space', async ({ page }) => {
    await page.goto('./');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(page);
    const panel = page.getByTestId('sim-panel');
    const speed = page.getByTestId('speed-menu');
    const list = page.getByRole('listbox', { name: 'Speed' });
    for (const keys of [[], ['ArrowDown', 'End']])
      for (const [chip, menu, after] of [
        [speed, list, '3'],
        [page.getByTestId('demand-chip'), page.getByTestId('demand-menu'), '0'],
      ] as const) {
        await chip.click();
        await expect(menu).toBeVisible();
        for (const key of keys) await page.keyboard.press(key);
        await page.keyboard.press('Escape');
        await expect(menu).toHaveCount(0);
        await expect(chip).toBeFocused();
        await page.keyboard.press('Space');
        await expect(panel, `after ${[...keys, 'Escape'].join(', ')}`).toHaveAttribute('data-speed', after);
        await expect(menu).toHaveCount(0);
      }
    // Reached with Tab, the speed menu's button keeps Space through Escape: Space opens its list again.
    await page.getByTestId('play').focus();
    await page.keyboard.press('Tab');
    await expect(speed).toBeFocused();
    await page.keyboard.press('Space');
    await expect(list).toBeVisible();
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Escape');
    await expect(list).toHaveCount(0);
    await page.keyboard.press('Space');
    await expect(list).toBeVisible();
    await expect(panel).toHaveAttribute('data-speed', '0');
  });

  test('with the Build menu open, Tab goes through its three tools in order, and on past the last closes it', async ({ page }) => {
    await page.goto('./');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(page);
    const build = page.getByTestId('build');
    const menu = page.getByTestId('build-menu');
    // Where Tab and Shift+Tab go from Build, its menu closed.
    await build.focus();
    await page.keyboard.press('Tab');
    await mark(page, 'after');
    await build.focus();
    await page.keyboard.press('Shift+Tab');
    await mark(page, 'before');

    await build.focus();
    await page.keyboard.press('Enter');
    await expect(menu).toBeVisible();
    for (const tool of ['Place a stop', 'Draw a line', 'Place a depot']) {
      await page.keyboard.press('Tab');
      await expect(menu.getByRole('button', { name: tool })).toBeFocused();
    }
    await page.keyboard.press('Tab');
    await expect(menu).toHaveCount(0);
    expect(await focused(page)).toBe('after');

    // Shift+Tab from Build closes it too; Escape on a tool closes it with the focus back on Build; and
    // Enter on a tool the keyboard reached takes it out.
    await build.focus();
    await page.keyboard.press('Enter');
    await expect(menu).toBeVisible();
    await page.keyboard.press('Shift+Tab');
    await expect(menu).toHaveCount(0);
    expect(await focused(page)).toBe('before');
    await build.focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await expect(build).toBeFocused();
    await build.focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(menu.getByRole('button', { name: 'Draw a line' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(menu).toHaveCount(0);
    await expect(page.getByTestId('draft-card')).toBeVisible();
  });
});
