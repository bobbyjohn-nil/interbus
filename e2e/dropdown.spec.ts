// The game's own dropdown (D25: "I don't like the default dropdown menus, there should be custom
// ones"; Dropdown.tsx): its list opens on the choice you have and keeps the option the keyboard is on
// in view, and it opens beside its button within the window's top and bottom, upward where there is more room above,
// every option in reach of the mouse. Shown failing (TS-04) on the dropdown before the systems
// audit's (D26) fix: End left the highlighted $5.00 hidden in the list, and under a button low in the
// window the fare list ran past the window's bottom, its last fares out of reach.
import { expect, test, type Locator, type Page } from './base';
import { LINE_COLOURS } from '../src/sim/config/lines';
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
  /** Finance dragged past the window's right edge, the focus kept on Line 1's fare: reached by Tab, or pressed by the mouse and its list closed. */
  async function fareDraggedOff(page: Page, focused: 'by Tab' | 'by the mouse' = 'by Tab') {
    await page.setViewportSize({ width: W, height: H });
    await page.goto('./');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(page);
    await withDebugLine(page);
    await page.getByRole('button', { name: 'Finance', exact: true }).click();
    const finance = page.getByTestId('finance');
    await finance.getByTestId('finance-lines').click();
    const fare = page.getByRole('button', { name: 'Fare for Line 1' });
    if (focused === 'by Tab') {
      // The keyboard's focus, so it shows (:focus-visible): from the control before it, by Tab.
      await fare.focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
    } else {
      await fare.click();
      await expect(page.getByRole('listbox')).toBeVisible();
      await page.keyboard.press('Escape');
    }
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
  // reveal (the list at x 1313–1377 on the 1152-wide window), and for Enter with only the keys a control takes. And Space, which
  // presses it as Enter does: the drag leaves the focus as the keyboard brought it, where its press had told the page the pointer
  // acted, so Space played (the systems audit's twenty-first round).
  for (const [key, name] of [['ArrowDown', 'ArrowDown'], ['Enter', 'Enter'], [' ', 'Space']] as const)
    test(`opens beside its button in a panel dragged past the window’s edge, ${name} bringing the panel in`, async ({ page }) => {
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

  // A key that works nothing there moves nothing: Space where it plays and pauses, on a fare the mouse pressed (the fare's button
  // keeps Space only where the keyboard brought the focus to it), brought the panel back as it played, and so did an arrow the
  // fare's button takes no notice of, where a player had just dragged it out of the way (the round's review). Shown failing
  // (TS-04) with every acting key bringing it in, Space among them.
  test('leaves a panel dragged past the window’s edge where it is for a key that works nothing', async ({ page }) => {
    const { at } = await fareDraggedOff(page);
    const was = await at();
    for (const key of ['ArrowRight', 'ArrowLeft', 'PageDown', 'Home']) await page.keyboard.press(key);
    await expect(page.getByRole('listbox')).toHaveCount(0);
    expect(await at()).toBe(was);
  });

  // A press on another panel's heading raised that panel over the control the keyboard was on, and Space then pressed the control
  // unseen: Buy and run, for $190,000, under Finance (the review of the twenty-first round). Only a drag of the panel the keyboard
  // is in keeps the focus's source. Shown failing (TS-04) with every heading's press keeping it.
  test('leaves Space to the game after a press on another panel’s heading', async ({ page }) => {
    await page.setViewportSize({ width: W, height: H });
    await page.goto('./');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(page);
    await withDebugLine(page);
    await page.getByRole('button', { name: 'Finance', exact: true }).click();
    await page.getByTestId('finance').getByTestId('finance-lines').click();
    const fare = page.getByRole('button', { name: 'Fare for Line 1' });
    await fare.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(fare).toBeFocused();
    await page.getByTestId('dock').getByRole('button', { name: 'Lines', exact: true }).click();
    const lines = page.getByTestId('inspector');
    await expect(lines).toBeVisible();
    await fare.focus(); // the dock's Lines took the press's focus: back to the fare, as the keyboard left it
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(fare).toBeFocused();
    const h = (await lines.locator('h2').first().boundingBox())!;
    await page.mouse.move(h.x + 10, h.y + h.height / 2);
    await page.mouse.down();
    await page.mouse.up();
    await expect(fare).toBeFocused();
    const speed = page.getByTestId('sim-panel');
    await page.keyboard.press(' ');
    await expect(speed).not.toHaveAttribute('data-speed', '0');
    await expect(page.getByRole('listbox')).toHaveCount(0);
  });

  // The systems audit's twenty-second round: a key pressed a control another panel lay over, where no one could see it: Tabbed to
  // a change's Buy and run, then Finance dragged over it or raised over it by a press on its heading, Enter bought the change
  // for $190,000 unseen, 30 runs of 30, and so did Space after a Tab away and back. The keyboard's control raises its panel: at a
  // key's press, which only raises it, so the next press works what the key is on, and as the focus comes to it. Shown failing
  // (TS-04) with no raise: Lines still lay over the fare after Enter.
  test('raises the panel of the control the keyboard is on over another panel lying over it, before a key presses it', async ({ page }) => {
    await page.setViewportSize({ width: W, height: H });
    await page.goto('./');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(page);
    await withDebugLine(page);
    await page.getByRole('button', { name: 'Finance', exact: true }).click();
    await page.getByTestId('finance').getByTestId('finance-lines').click();
    const fare = page.getByRole('button', { name: 'Fare for Line 1' });
    await page.getByTestId('dock').getByRole('button', { name: 'Lines', exact: true }).click();
    const lines = page.getByTestId('inspector');
    await expect(lines).toBeVisible();
    /** The panel drawn over the fare's middle, which is what shows there. */
    const over = () => fare.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('[data-movable]')?.getAttribute('data-movable') ?? null;
    });
    /**
     * Lines raised over the fare by a press on its heading, the keyboard left on the fare; dragged there first, beside Finance, as
     * high as a panel goes and its left edge 30 px left of Finance's, its heading's first pixels pressed there, outside Finance, as
     * Finance lies on top. Its heading went just above Finance's, over the chips, until a panel's top stayed under them (the
     * systems audit's twenty-fourth round).
     */
    const underLines = async (dragged: boolean) => {
      const h = (await lines.locator('h2').first().boundingBox())!;
      await page.mouse.move(h.x + 4, h.y + h.height / 2);
      await page.mouse.down();
      if (dragged) {
        const [l, f] = [(await page.locator('[data-movable="lines"]').boundingBox())!, (await page.locator('[data-movable="finance"]').boundingBox())!];
        await page.mouse.move(h.x + 4 + (f.x - 30 - l.x), h.y + h.height / 2 + (f.y - l.y), { steps: 8 });
      }
      await page.mouse.up();
      await expect(fare).toBeFocused();
      expect(await over()).toBe('lines');
    };
    await fare.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(fare).toBeFocused();
    expect(await over()).toBe('finance');
    // Enter raises Finance and opens nothing; the next Enter opens the fare's list, its button in view.
    await underLines(true);
    await page.keyboard.press('Enter');
    await expect.poll(over).toBe('finance');
    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(fare).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('listbox', { name: 'Fare for Line 1' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(fare).toBeFocused();
    // ArrowDown, which the fare's button takes to open its list, raises Finance too, the list beside the fare in view.
    await underLines(false);
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('listbox', { name: 'Fare for Line 1' })).toBeFocused();
    await expect.poll(over).toBe('finance');
    await page.keyboard.press('Escape');
    await expect(fare).toBeFocused();
    // A Tab away and back raises it too, so Space opens the list in view.
    await underLines(false);
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(fare).toBeFocused();
    await expect.poll(over).toBe('finance');
    await page.keyboard.press(' ');
    await expect(page.getByRole('listbox', { name: 'Fare for Line 1' })).toBeFocused();
    await page.keyboard.press('Escape');
  });

  test('leaves a panel dragged past the window’s edge where it is for Space, which plays on a fare the mouse pressed', async ({ page }) => {
    const { at } = await fareDraggedOff(page, 'by the mouse');
    const was = await at();
    const speed = page.getByTestId('sim-panel');
    await page.keyboard.press(' ');
    await expect(speed).not.toHaveAttribute('data-speed', '0');
    expect(await at()).toBe(was);
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

  // The systems audit's twenty-fourth round: at Chrome's 125%, 1093×614, a fare's list opened below its button in Finance ran to 8 px
  // above the window's foot, under the map's credit and the build chip, which draw over every list: the option the keyboard was
  // on stood with 13 px of its 31 showing, its middle under "Protomaps", for 16 of 21 steps down, and Enter set it, 3 runs of 3.
  // Where it meets them across, a list ends above them now. Shown failing (TS-04) with the list run to the window's foot.
  test('ends a list above the map’s credit where the two meet', async ({ page }) => {
    await page.setViewportSize({ width: 1093, height: 614 });
    await page.goto('./');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(page);
    const N = 14;
    await withDebugLine(page, (d) => {
      const [first] = d.lines as Record<string, unknown>[];
      d.lines = [first, ...Array.from({ length: N - 1 }, (_, k) => ({ ...first, id: k + 2, name: `Line ${k + 2}`, colour: LINE_COLOURS[(k + 1) % LINE_COLOURS.length], stopIds: [1, 2] }))];
      d.nextIds = { ...d.nextIds, line: N + 1 };
    });
    await page.getByRole('button', { name: 'Finance', exact: true }).click();
    await page.getByTestId('finance-lines').click();
    const fare = page.getByRole('button', { name: 'Fare for Line 8', exact: true });
    // Its foot 45% of the way down the window, as the wheel scrolls Finance's body: more room below it than above, and too little
    // for the whole list.
    await fare.evaluate((e) => {
      const body = e.closest('.panel-body') as HTMLElement;
      body.scrollTop += e.getBoundingClientRect().bottom - 0.45 * innerHeight;
    });
    await fare.focus();
    await page.keyboard.press('ArrowDown');
    const list = page.getByRole('listbox', { name: 'Fare for Line 8' });
    await expect(list).toBeVisible();
    const [l, c, f] = [(await list.boundingBox())!, (await page.locator('.corner').boundingBox())!, (await fare.boundingBox())!];
    // Below its fare, and across from the corner.
    expect(l.y).toBeGreaterThan(f.y);
    expect(l.x < c.x + c.width && l.x + l.width > c.x).toBe(true);
    expect(l.y + l.height).toBeLessThanOrEqual(c.y);
  });

  // The systems audit's twenty-fourth round: a list goes with its button as a scroll moves it, but a drag of its panel moved the
  // button with no scroll: with the mouse dragging Finance by its heading and the keyboard on Line 1's fare, ArrowDown opened the
  // fare's list, and the drag on left it 300 px from its button, holding the focus, where Enter set the fare, 3 runs of 3. It goes
  // with its button now. Shown failing (TS-04) with no list told of the drag.
  test('keeps a list beside its button as its panel is dragged', async ({ page }) => {
    await page.setViewportSize({ width: W, height: H });
    await page.goto('./');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(page);
    await withDebugLine(page);
    await page.getByRole('button', { name: 'Finance', exact: true }).click();
    await page.getByTestId('finance-lines').click();
    const fare = page.getByRole('button', { name: 'Fare for Line 1' });
    await fare.focus();
    const h = (await page.locator('[data-movable="finance"] h2').first().boundingBox())!;
    const [x, y] = [h.x + 10, h.y + h.height / 2];
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + 40, { steps: 4 });
    await page.keyboard.press('ArrowDown');
    const list = page.getByRole('listbox', { name: 'Fare for Line 1' });
    await expect(list).toBeFocused();
    await page.mouse.move(x - 300, y + 160, { steps: 8 });
    const [l, b] = [(await list.boundingBox())!, (await fare.boundingBox())!];
    expect(Math.abs(l.x - b.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(l.y - (b.y + b.height + 4))).toBeLessThanOrEqual(1);
    // Dragged on past the window's right edge, the panel took the button off the window, and the list, kept on it, stood 233 px
    // from its button, where Enter set the fare (the review of the twenty-fourth round). It closes as it does once a scroll takes
    // the button out of its view, the focus back on the button; the next key brings the panel in and opens the list beside it.
    // Shown failing (TS-04) with only the button's view counted.
    await page.mouse.move(x + 900, y + 160, { steps: 12 });
    expect((await fare.boundingBox())!.x).toBeGreaterThan(W);
    await expect(list).toHaveCount(0);
    await expect(fare).toBeFocused();
    await page.mouse.up();
    await page.keyboard.press('ArrowDown');
    await expect(list).toBeFocused();
    // Brought in to the window's right edge, the button stands over its list, which is wider and kept 8 px inside the window.
    const [l2, b2] = [(await list.boundingBox())!, (await fare.boundingBox())!];
    expect(b2.x + b2.width).toBeLessThanOrEqual(W);
    expect(l2.x).toBeLessThanOrEqual(b2.x);
    expect(l2.x + l2.width).toBeGreaterThanOrEqual(b2.x + b2.width);
    expect(l2.x + l2.width).toBeLessThanOrEqual(W);
    expect(Math.abs(l2.y - (b2.y + b2.height + 4))).toBeLessThanOrEqual(1);
  });

  // The speed list, open as the day ran on, stayed where it had opened as the date's period name, "Off-peak" become "Peak",
  // narrowed the date chip and moved the speed menu 19.25 px along the top bar: a list followed what held its button only in a
  // panel (the review of #192). The top bar's chips hold it too now. Shown failing (TS-04) with a panel the only holder:
  // 19.25 px, 3 runs of 3.
  test('keeps the speed list under its button as the date’s period name moves it', async ({ page }) => {
    await page.setViewportSize({ width: W, height: H });
    await page.goto('./');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(page);
    await page.getByTestId('play').click();
    await page.locator('body').press('5');
    const menu = page.getByTestId('speed-menu');
    await expect(menu).toContainText('5,400');
    await menu.click();
    await expect(page.getByRole('listbox', { name: 'Speed' })).toBeVisible();
    // Frame by frame in the page: once the period's name has moved the menu, two frames on, how far the list's left edge lies
    // from the menu's. A new game opens at 05:00, off-peak, and peak starts at 06:30, a second on at 5,400×.
    const off = await page.evaluate(() => new Promise<number>((done, fail) => {
      const menu = document.querySelector('[data-testid="speed-menu"]')!;
      const was = menu.getBoundingClientRect().left;
      const t0 = performance.now();
      const frame = () => {
        if (Math.abs(menu.getBoundingClientRect().left - was) > 5) {
          requestAnimationFrame(() => requestAnimationFrame(() => {
            const list = document.querySelector('[role="listbox"]')?.getBoundingClientRect();
            if (list) done(Math.abs(list.left - menu.getBoundingClientRect().left));
            else fail(new Error('the speed list closed'));
          }));
        } else if (performance.now() - t0 > 20_000) fail(new Error('the speed menu never moved'));
        else requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    }));
    expect(off).toBeLessThan(1);
  });
});
