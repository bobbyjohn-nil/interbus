// The game's own dropdown (D25: "I don't like the default dropdown menus, there should be custom
// ones"; Dropdown.tsx): its list opens on the choice you have and keeps the option the keyboard is on
// in view, and it opens beside its button within the window's top and bottom, upward where there is more room above,
// every option in reach of the mouse. Shown failing (TS-04) on the dropdown before the systems
// audit's (D26) fix: End left the highlighted $5.00 hidden in the list, and under a button low in the
// window the fare list ran past the window's bottom, its last fares out of reach.
import { expect, test, type Locator, type Page } from './base';
import { FARES_CENTS } from '../src/sim/rules/fare';
import { usd } from '../src/ui/format';
import { foundCompany } from './found';
import { build, city, withDebugLine } from './shell';

const [W, H] = [1152, 720]; // I13's tightest size
const fareText = (k: number) => usd(FARES_CENTS[k]!, { cents: true });

/** Whether an option lies whole inside its list's box, where the list shows it. */
const inView = (option: Locator) =>
  option.evaluate((el) => {
    const [o, list] = [el.getBoundingClientRect(), el.closest('[role="listbox"]')!.getBoundingClientRect()];
    return o.top >= list.top - 0.5 && o.bottom <= list.bottom + 0.5;
  });

test.describe('the game’s dropdown', () => {
  // The systems audit's seventh round: a list is placed in the window's pixels as it opens, and when the window narrowed (1440×900
  // to 1152×720) its panel moved 288 px left to stay whole while the list stayed at x 1201–1400, past the window's edge, holding
  // the focus. It closes now, the focus back on its button, as Escape does. Shown failing (TS-04) with no close on a resize.
  test('closes when the window changes size, giving the focus back to its button', async ({ page }) => {
    test.skip(!city.sim, 'no sim file in this build yet');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('./');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(page);
    await withDebugLine(page);
    await page.getByRole('button', { name: 'Lines' }).click();
    const button = page.getByTestId('inspector').getByRole('button', { name: 'Buses' });
    await button.click();
    const list = page.getByRole('listbox', { name: 'Buses' });
    await expect(list).toBeFocused();
    await page.setViewportSize({ width: 1152, height: 720 });
    await expect(list).toHaveCount(0);
    await expect(button).toBeFocused();
    expect(await button.evaluate((b) => b.getBoundingClientRect().right)).toBeLessThanOrEqual(1152);
  });

  test.skip(!city.sim, 'no sim file in this build yet');

  test('keeps the keyboard’s option in view, opens on the chosen one, and opens upward with no room below', async ({ page }) => {
    // A founded game with a line, Finance open at its Lines: the line's fare.
    await page.setViewportSize({ width: W, height: H });
    await page.goto('./');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(page);
    await withDebugLine(page);
    await page.getByRole('button', { name: 'Finance', exact: true }).click();
    await page.getByTestId('finance-lines').click();
    const fare = page.getByRole('button', { name: 'Fare for Line 1' });
    const list = page.getByRole('listbox', { name: 'Fare for Line 1' });
    const active = async () => list.locator(`[id="${await list.getAttribute('aria-activedescendant')}"]`);

    await fare.focus();
    await page.keyboard.press('ArrowDown');
    await expect(list).toBeVisible();
    // End: the last fare, in view.
    await page.keyboard.press('End');
    await expect(await active()).toHaveText(fareText(FARES_CENTS.length - 1));
    expect(await inView(await active())).toBe(true);
    // Home, then fourteen steps down: the fifteenth fare, in view, and Enter picks it.
    await page.keyboard.press('Home');
    expect(await inView(await active())).toBe(true);
    for (let k = 0; k < 14; k++) await page.keyboard.press('ArrowDown');
    await expect(await active()).toHaveText(fareText(14));
    expect(await inView(await active())).toBe(true);
    await page.keyboard.press('Enter');
    await expect(list).toHaveCount(0);
    await expect(fare).toContainText(fareText(14));
    // Opened again, the list shows the fare chosen; an arrow on its button while it is open leaves it showing.
    await page.keyboard.press('ArrowDown');
    await expect(await active()).toHaveText(fareText(14));
    expect(await inView(await active())).toBe(true);
    await fare.focus();
    await page.keyboard.press('ArrowDown');
    await expect(list).toBeVisible();
    await fare.click();
    await expect(list).toHaveCount(0);

    // Finance dragged down by its heading until the fare's button ends 250 px above the window's
    // bottom: too little room below for the list, so it opens above.
    const b = (await fare.boundingBox())!;
    const h = (await page.getByTestId('finance').getByRole('heading', { name: 'Finance' }).boundingBox())!;
    await page.mouse.move(h.x + 10, h.y + h.height / 2);
    await page.mouse.down();
    await page.mouse.move(h.x + 10, h.y + h.height / 2 + (H - 250 - b.y - b.height), { steps: 8 });
    await page.mouse.up();
    const button = (await fare.boundingBox())!;
    expect(button.y + button.height).toBeCloseTo(H - 250, 0);
    await fare.click();
    await expect(list).toBeVisible();
    const r = (await list.boundingBox())!;
    expect(r.height).toBeGreaterThan(250);
    expect(r.y).toBeGreaterThanOrEqual(0);
    expect(r.y + r.height).toBeLessThanOrEqual(button.y);
    // The wheel scrolls the list to its end, and a click there picks the dearest fare.
    await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
    await page.mouse.wheel(0, 2_000);
    const last = list.getByRole('option', { name: fareText(FARES_CENTS.length - 1), exact: true });
    await expect.poll(() => inView(last)).toBe(true);
    const o = (await last.boundingBox())!;
    expect(o.y + o.height).toBeLessThanOrEqual(H);
    await page.mouse.click(o.x + o.width / 2, o.y + o.height / 2);
    await expect(fare).toContainText(fareText(FARES_CENTS.length - 1));
  });

  /** Finance dragged past the window's right edge, the keyboard kept on Line 1's fare through the drag: the fare's button, and
   *  where the panel stands. */
  async function fareDraggedOff(page: Page) {
    await page.setViewportSize({ width: W, height: H });
    await page.goto('./');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(page);
    await withDebugLine(page);
    await page.getByRole('button', { name: 'Finance', exact: true }).click();
    const finance = page.getByTestId('finance');
    await finance.getByTestId('finance-lines').click();
    const fare = page.getByRole('button', { name: 'Fare for Line 1' });
    // The keyboard's focus, so it shows (:focus-visible): from the control before it, by Tab.
    await fare.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(fare).toBeFocused();
    const h = (await finance.getByRole('heading', { name: 'Finance' }).boundingBox())!;
    await page.mouse.move(h.x + 10, h.y + h.height / 2);
    await page.mouse.down();
    await page.mouse.move(h.x + 10 + W, h.y + h.height / 2, { steps: 8 });
    await page.mouse.up();
    await expect(fare).toBeFocused();
    const at = () => page.locator('[data-movable="finance"]').boundingBox().then((b) => b!.x);
    expect(await at()).toBeGreaterThan(W - 100);
    return { fare, at };
  }

  // Finance dragged past the window's right edge, the keyboard kept on a fare through the drag (a drag's press keeps the focus
  // where it was): ArrowDown opened the fare's list wholly off the window, holding the keys, and Enter set a fare unseen (the
  // systems audit's seventeenth round). A key that works the control the keyboard is on brings its panel in first, as Tab does:
  // ArrowDown, which the list's button takes to open its list, and Enter, which presses it. Shown failing (TS-04) with no key's
  // reveal (the list at x 1313–1377 on the 1152-wide window), and for Enter with only the keys a control takes.
  for (const key of ['ArrowDown', 'Enter'])
    test(`opens beside its button in a panel dragged past the window’s edge, ${key} bringing the panel in`, async ({ page }) => {
      const { fare } = await fareDraggedOff(page);
      await page.keyboard.press(key);
      const list = page.getByRole('listbox', { name: 'Fare for Line 1' });
      await expect(list).toBeFocused();
      const [b, l] = [(await fare.boundingBox())!, (await list.boundingBox())!];
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(W);
      expect(l.x).toBeGreaterThanOrEqual(0);
      expect(l.x + l.width).toBeLessThanOrEqual(W);
      await page.keyboard.press('Escape');
      await expect(fare).toBeFocused();
    });

  // A key that works nothing there moves nothing: Space, which plays and pauses once a press has dragged the panel (the fare's
  // button keeps Space only where the keyboard brought the focus to it), brought the panel back as it played, and so did an
  // arrow the fare's button takes no notice of, where a player had just dragged it out of the way (the round's review). Shown
  // failing (TS-04) with every acting key bringing it in, Space among them.
  test('leaves a panel dragged past the window’s edge where it is for Space, which plays, and for a key that works nothing', async ({ page }) => {
    const { at } = await fareDraggedOff(page);
    const was = await at();
    const speed = page.getByTestId('sim-panel');
    await page.keyboard.press(' ');
    await expect(speed).not.toHaveAttribute('data-speed', '0');
    expect(await at()).toBe(was);
    for (const key of ['ArrowRight', 'ArrowLeft', 'PageDown', 'Home']) await page.keyboard.press(key);
    await page.keyboard.press(' ');
    await expect(speed).toHaveAttribute('data-speed', '0');
    await expect(page.getByRole('listbox')).toHaveCount(0);
    expect(await at()).toBe(was);
  });

  // The new line's Buses list, opened with the line's card in its free place at the window's right, started at its button's left
  // and ran 11 px past the window's edge, its corner and shadow cut (the systems audit's seventeenth round). It keeps 8 px inside
  // the window, as it does at the top and bottom. Shown failing (TS-04) with the list at its button's left: 913–1163 on 1152.
  test('keeps the new line’s Buses list inside the window', async ({ page }) => {
    await page.setViewportSize({ width: W, height: H });
    await page.goto('./');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(page);
    await build(page, 'Draw a line');
    await page.getByTestId('draft-model').click();
    const list = page.getByRole('listbox', { name: 'Buses' });
    await expect(list).toBeVisible();
    const l = (await list.boundingBox())!;
    expect(l.x).toBeGreaterThanOrEqual(8);
    expect(l.x + l.width).toBeLessThanOrEqual(W - 8);
  });
});
