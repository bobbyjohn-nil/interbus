// A key never presses a control something else lies over, where no one can see what it presses (Panels.tsx coverOf): under
// another panel its panel comes up, so the press shows the control and the next works it (dropdown.spec.ts); under a card no
// raise lifts, the day's or the lender's, the press waits, and so do the keys a control takes for itself. Its control is shown
// in its panel's body, or its panel's own box, first, as Tab shows it, clear of sticky headings.
import { expect, test, type Locator, type Page } from './base';
import { LINE_COLOURS } from '../src/sim/config/lines';
import { foundCompany, leaveHome, STARTING_CENTS } from './found';
import { city, holdSpeed, setFare, setSpeed, withDebugLine, type SaveData } from './shell';

/** The debug line's game at `size`, 1152×720 unless it says, edited by `edit`, past Home, with nothing open. */
async function game(page: Page, edit?: (data: SaveData) => void, size = { width: 1152, height: 720 }) {
  await page.setViewportSize(size);
  await page.goto('./');
  await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
  await leaveHome(page);
  await foundCompany(page);
  await withDebugLine(page, edit);
}

/** Focuses `el` as the keyboard does: from the control before it, by Tab. */
async function tabOnto(page: Page, el: Locator) {
  await el.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(el).toBeFocused();
}

/** What shows over the middle of `el`: its panel's id, or the card it lies under. */
const over = (el: Locator) =>
  el.evaluate((e) => {
    const r = e.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return hit?.closest('[data-movable]')?.getAttribute('data-movable') ?? hit?.closest('[data-testid]')?.getAttribute('data-testid') ?? null;
  });

/** Drags panel `id` by its heading by (dx, dy). */
async function drag(page: Page, id: string, dx: number, dy: number) {
  const h = (await page.locator(`[data-movable="${id}"] h2`).first().boundingBox())!;
  await page.mouse.move(h.x + 10, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(h.x + 10 + dx, h.y + h.height / 2 + dy, { steps: 8 });
  await page.mouse.up();
}

test.describe('a key on a control something lies over', () => {
  test.skip(!city.sim, 'no sim file in this build yet');

  // The review of the twenty-second round's keyboard fixes: with Finance, Lines and Saves open at 1152×720, no gap beside the
  // panels holds the day's card, which stands in the window's middle, over Lines' change card, and Enter on Buy and run under it
  // bought the change unseen, $380,000, 3 runs of 3, as before those fixes. Shown failing (TS-04) with only a panel counted as
  // lying over a control.
  test('presses nothing under the day’s card', async ({ page }) => {
    test.setTimeout(150_000);
    await game(page, (d) => void (d.clock.elapsed = 86_400 + 18 * 3_600 + 58 * 60));
    await page.getByRole('button', { name: 'Finance', exact: true }).click();
    await page.getByRole('button', { name: 'Lines', exact: true }).click();
    const panel = page.getByTestId('inspector');
    const peak = panel.getByTestId('headway-peak');
    await tabOnto(page, peak);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Home');
    for (let k = 0; k < 16 && !/^Every 5 min$/.test((await page.locator('.dropdown-option.active .dropdown-label').textContent()) ?? ''); k++) await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    const change = panel.getByTestId('headway-change');
    const buy = change.getByRole('button', { name: 'Buy and run' });
    await expect(buy).toBeVisible();
    await page.getByTestId('saves-chip').click();
    await tabOnto(page, buy);
    await page.keyboard.press('2');
    const card = page.getByTestId('day-card');
    await expect(card).toBeVisible({ timeout: 30_000 });
    await expect.poll(() => over(buy)).toBe('day-card');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1_000);
    await expect(change).toBeVisible();
    await expect(buy).toBeFocused();
    await expect(card).toBeVisible();
  });

  // The review: the lender's card, drawn above every panel however they are raised, over Saves' × reached by Tab. The press
  // waits, as no raise shows the ×; pressed, Saves' Delete there goes unseen. Moved out from under the card, the next press works.
  // Shown failing (TS-04) on f7da886, whose first Enter closed Saves unseen.
  test('presses nothing under the lender’s card, and works once the control is out from under it', async ({ page }) => {
    test.setTimeout(150_000);
    await game(page, (d) => {
      d.clock.elapsed = 86_400 + 18 * 3_600 + 50 * 60;
      (d as unknown as { closesBelowFloor: number }).closesBelowFloor = 4;
      d.ledger.push({ day: 1, kind: 'buses', amountCents: -(STARTING_CENTS + 20_000_000), lineId: null });
    });
    await page.getByTestId('checklist').click();
    for (const name of ['Lines', 'Finance']) await page.getByRole('button', { name, exact: true }).click();
    await page.getByTestId('saves-chip').click();
    await setSpeed(page, '5,400×');
    const day = page.getByTestId('day-card');
    await expect(day).toBeVisible({ timeout: 30_000 });
    await day.getByRole('button', { name: 'Continue' }).click();
    const lender = page.locator('[data-movable="lender"]');
    await expect(lender).toBeVisible();
    const saves = page.getByTestId('saves');
    const close = saves.getByRole('button', { name: 'Close', exact: true });
    const [l, c] = [(await lender.boundingBox())!, (await close.boundingBox())!];
    await drag(page, 'saves', Math.round(l.x + l.width / 2 - (c.x + c.width / 2)), Math.round(l.y + 60 - (c.y + c.height / 2)));
    await tabOnto(page, close);
    expect(await over(close)).toBe('lender');
    for (let k = 0; k < 2; k++) await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    await expect(saves).toBeVisible();
    await expect(close).toBeFocused();
    await drag(page, 'saves', 0, Math.round(l.y + l.height + 20 - (c.y + c.height / 2)) - Math.round(l.y + 60 - (c.y + c.height / 2)));
    await expect.poll(() => over(close)).toBe('saves');
    await tabOnto(page, close);
    await page.keyboard.press('Enter');
    await expect(saves).toHaveCount(0);
  });

  // The review: a fare scrolled out past its panel's foot, its middle over Lines, which no raise uncovers, so the fix's presses
  // there did nothing, 3 runs of 3: the press shows the fare in Finance's body first, as Tab does, and works it there. Shown
  // failing (TS-04) with the fare measured where it lay scrolled.
  test('shows a control scrolled out of its panel’s body, and works it', async ({ page }) => {
    test.setTimeout(150_000);
    const N = 14;
    await game(page, (d) => {
      const [first] = d.lines as Record<string, unknown>[];
      d.lines = [first, ...Array.from({ length: N - 1 }, (_, k) => ({ ...first, id: k + 2, name: `Line ${k + 2}`, colour: LINE_COLOURS[(k + 1) % LINE_COLOURS.length], stopIds: [1, 2] }))];
      d.nextIds = { ...d.nextIds, line: N + 1 };
    });
    await page.getByRole('button', { name: 'Finance', exact: true }).click();
    const finance = page.getByTestId('finance');
    await finance.getByTestId('finance-lines').click();
    await page.getByRole('button', { name: 'Lines', exact: true }).click();
    const fare = finance.getByRole('button', { name: `Fare for Line ${N}` });
    const body = finance.getByTestId('finance-body');
    await body.evaluate((b) => void (b.scrollTop = 0));
    // Lines dragged under where the fare lies with Finance's body at its top, past Finance's foot.
    const f = (await fare.boundingBox())!;
    const [mx, my] = [Math.round(f.x + f.width / 2), Math.round(f.y + f.height / 2)];
    const fin = (await page.locator('[data-movable="finance"]').boundingBox())!;
    const lb = (await page.locator('[data-movable="lines"]').boundingBox())!;
    const top = Math.min(my - 5, Math.max(Math.round(fin.y + fin.height) + 2, my - 30));
    await drag(page, 'lines', mx - 40 - Math.round(lb.x), top - Math.round(lb.y));
    await tabOnto(page, fare);
    await body.evaluate((b) => void (b.scrollTop = 0));
    await expect(fare).toBeFocused();
    expect(await over(fare)).toBe('lines');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('listbox', { name: `Fare for Line ${N}` })).toBeFocused();
    expect(await over(fare)).toBe('finance');
    await page.keyboard.press('Escape');
  });
  // The systems audit's twenty-third round: a key's press waited under the day's card, but the keys a control takes for itself
  // did not: with the debug line and a second, Finance on its Lines dragged 200 px left, Lines and Saves open by the mouse and
  // the day's card over Finance's fare, ArrowDown or ArrowUp on the fare opened its list beside a button no one could see, and
  // Enter there set Line 1's fare from $2.25 to $2.50, 3 runs of 3; and ArrowRight or End on Lines' tab for Line 1, under the card
  // too, turned Lines to Line 2 (the fix's review). Under a cover no raise lifts, a control's own keys wait now, as a key's press
  // does: a list's button's ArrowDown and ArrowUp, and a tab's arrows, Home and End. Shown failing (TS-04) with only the press
  // held, and with a list's button's keys alone held.
  test('takes no arrow, Home or End for a control under the day’s card', async ({ page }) => {
    test.setTimeout(150_000);
    await game(page, (d) => {
      d.clock.elapsed = 86_400 + 18 * 3_600 + 58 * 60;
      const [first] = d.lines as Record<string, unknown>[];
      d.lines = [first, { ...first, id: 2, name: 'Line 2', colour: LINE_COLOURS[1], stopIds: [1, 2] }];
      d.nextIds = { ...d.nextIds, line: 3 };
    });
    await page.getByRole('button', { name: 'Finance', exact: true }).click();
    const finance = page.getByTestId('finance');
    await finance.getByTestId('finance-lines').click();
    await page.getByRole('button', { name: 'Lines', exact: true }).click();
    await page.getByTestId('saves-chip').click();
    await expect(page.getByTestId('saves')).toBeVisible();
    await drag(page, 'finance', -200, 0);
    await tabOnto(page, page.getByTestId('saves-chip'));
    await page.keyboard.press('2');
    const card = page.getByTestId('day-card');
    await expect(card).toBeVisible({ timeout: 30_000 });
    const fare = finance.getByRole('button', { name: 'Fare for Line 1' });
    const was = (await fare.textContent()) ?? '';
    await tabOnto(page, fare);
    await expect.poll(() => over(fare)).toBe('day-card');
    for (const key of ['ArrowDown', 'ArrowUp']) {
      await page.keyboard.press(key);
      await page.waitForTimeout(300);
      await expect(page.getByRole('listbox')).toHaveCount(0);
      await expect(fare).toBeFocused();
    }
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    await expect(fare).toHaveText(was);
    const lines = page.getByTestId('inspector');
    const tab = lines.getByRole('tab', { selected: true });
    await expect(tab).toContainText('Line 1');
    await tabOnto(page, tab);
    await expect.poll(() => over(tab)).toBe('day-card');
    for (const key of ['ArrowRight', 'ArrowLeft', 'Home', 'End']) {
      await page.keyboard.press(key);
      await page.waitForTimeout(300);
      await expect(lines.getByRole('tab', { selected: true })).toContainText('Line 1');
      await expect(tab).toBeFocused();
    }
    await expect(card).toBeVisible();
  });

  // The systems audit's twenty-third round: a key's press showed its control in its panel's body (`.panel-body`), but Saves,
  // Contracts, a stop's card, Lines here, the route editor and the new line's card scroll whole: with Saves dragged as low as it
  // goes at 1152×720 and scrolled back to its top, Enter on slot 2's Save here, under the map's credit, was held for good, and on
  // Back to Home, clipped below Saves' foot, it went Home unseen, 3 runs of 3. Shown in its panel's own box too now, the press
  // shows the control, and works it there. Shown failing (TS-04) with the press shown in a panel's body alone.
  test('shows a control scrolled out of a panel that scrolls whole, and works it', async ({ page }) => {
    test.setTimeout(150_000);
    await game(page);
    await page.getByTestId('saves-chip').click();
    const saves = page.getByTestId('saves');
    await expect(saves).toBeVisible();
    await drag(page, 'saves', 0, 720);
    const slot = saves.getByTestId('slot-2');
    const save = slot.getByRole('button', { name: 'Save here' });
    await tabOnto(page, save);
    await saves.evaluate((e) => void (e.scrollTop = 0));
    await expect(save).toBeFocused();
    // Over the button's middle, on the window: the map's credit, whose links carry no test id.
    const under = await save.evaluate((e) => {
      const r = e.getBoundingClientRect();
      const [x, y] = [r.left + r.width / 2, r.top + r.height / 2];
      if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return 'off the window';
      const hit = document.elementFromPoint(x, y);
      return !hit ? 'nothing' : e.contains(hit) ? 'itself' : (hit.closest('[data-movable]')?.getAttribute('data-movable') ?? hit.tagName.toLowerCase());
    });
    expect(['itself', 'saves', 'off the window', 'nothing']).not.toContain(under);
    await page.keyboard.press('Enter');
    await expect(slot).toHaveAttribute('data-empty', 'no');
    expect(await saves.evaluate((e) => e.scrollTop)).toBeGreaterThan(0);
  });

  // The systems audit's twenty-third round: a key's press showed its control within its panel body's box, where Finance's Lines
  // keeps its column headings over the rows as they scroll: with 14 lines and the body scrolled so a line's name lay under the
  // headings, Enter or Space there opened or closed its money unseen, 3 runs of 3. Shown clear of the body's scroll padding now,
  // which keeps the rows from under the headings, the press shows the name, and works it there. Shown failing (TS-04) with the
  // padding left out.
  test('shows a control under its own panel’s sticky headings, and works it', async ({ page }) => {
    test.setTimeout(150_000);
    const N = 14;
    await game(page, (d) => {
      const [first] = d.lines as Record<string, unknown>[];
      d.lines = [first, ...Array.from({ length: N - 1 }, (_, k) => ({ ...first, id: k + 2, name: `Line ${k + 2}`, colour: LINE_COLOURS[(k + 1) % LINE_COLOURS.length], stopIds: [1, 2] }))];
      d.nextIds = { ...d.nextIds, line: N + 1 };
    });
    await page.getByRole('button', { name: 'Finance', exact: true }).click();
    const finance = page.getByTestId('finance');
    await finance.getByTestId('finance-lines').click();
    const body = finance.getByTestId('finance-body');
    // The first line whose name a scroll of the body can bring under the headings' middle.
    const row = await body.evaluate((b) => {
      const th = b.querySelector('thead th')!.getBoundingClientRect();
      for (const button of b.querySelectorAll('tbody button.line-name')) {
        const r = button.getBoundingClientRect();
        const need = b.scrollTop + r.top + r.height / 2 - (th.top + th.height / 2);
        if (need > 0 && need <= b.scrollHeight - b.clientHeight) return Number(button.closest('tr')!.getAttribute('data-line'));
      }
      return 0;
    });
    expect(row).toBeGreaterThan(0);
    const name = finance.getByTestId(`line-money-${row}`).locator('button.line-name');
    await tabOnto(page, name);
    // The body scrolled, as the wheel scrolls it with the keyboard left on the name, until the name's middle lies under the headings.
    await name.evaluate((e) => {
      const scroller = e.closest('.panel-body') as HTMLElement;
      const th = e.closest('table')!.querySelector('thead th')!;
      for (let k = 0; k < 3; k++) {
        const [r, t] = [e.getBoundingClientRect(), th.getBoundingClientRect()];
        scroller.scrollTop += r.top + r.height / 2 - (t.top + t.height / 2);
      }
    });
    await expect(name).toBeFocused();
    const shows = () =>
      name.evaluate((e) => {
        const r = e.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return !!hit && e.contains(hit);
      });
    expect(await shows()).toBe(false);
    const open = await name.getAttribute('aria-expanded');
    await page.keyboard.press('Enter');
    await expect(name).toHaveAttribute('aria-expanded', open === 'true' ? 'false' : 'true');
    expect(await shows()).toBe(true);
  });

  // The review of the twenty-third round's keyboard fixes: held for every control, and measured where it lay, the arrows, Home and
  // End found the map, the chips or the dock over a control scrolled out of its panel, with no card on the window: with 30 lines
  // at 1152×720 and Finance's Lines scrolled back to its top, as a wheel scrolls it with the keyboard left on Line 14's fare,
  // ArrowDown opened no list, and with the keyboard on Line 1's name, ArrowDown stopped scrolling the body once the name had left
  // Finance, at 120 to 139 px of 500, and End and Home did nothing. A control's own keys are held only for a control that takes
  // them now, measured once it shows in its panel, and any other control's scroll its panel. Shown failing (TS-04) with every
  // control's held as it lay, with a control's own held as it lay, and with every control's held once shown.
  test('works a control’s own keys scrolled out of its panel, and scrolls the panel by any other’s', async ({ page }) => {
    test.setTimeout(150_000);
    const N = 30;
    await game(page, (d) => {
      const [first] = d.lines as Record<string, unknown>[];
      d.lines = [first, ...Array.from({ length: N - 1 }, (_, k) => ({ ...first, id: k + 2, name: `Line ${k + 2}`, colour: LINE_COLOURS[(k + 1) % LINE_COLOURS.length], stopIds: [1, 2] }))];
      d.nextIds = { ...d.nextIds, line: N + 1 };
    });
    await page.getByRole('button', { name: 'Finance', exact: true }).click();
    const finance = page.getByTestId('finance');
    await finance.getByTestId('finance-lines').click();
    const body = finance.getByTestId('finance-body');
    /** What shows over the middle of `el`: itself, its own panel, or something outside its panel on the window. */
    const lies = (el: Locator) =>
      el.evaluate((e) => {
        const r = e.getBoundingClientRect();
        const [x, y] = [r.left + r.width / 2, r.top + r.height / 2];
        const hit = x >= 0 && y >= 0 && x < innerWidth && y < innerHeight ? document.elementFromPoint(x, y) : null;
        return !hit ? 'off the window' : e.contains(hit) ? 'itself' : e.closest('[data-movable]')!.contains(hit) ? 'its panel' : 'outside';
      });
    const fare = finance.getByRole('button', { name: 'Fare for Line 14', exact: true });
    await tabOnto(page, fare);
    await body.evaluate((b) => void (b.scrollTop = 0));
    await expect(fare).toBeFocused();
    expect(await lies(fare)).toBe('outside');
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('listbox')).toHaveCount(1);
    expect(await lies(fare)).toBe('itself');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(fare).toBeFocused();
    // Line 1's name, the body scrolled until the name's middle lies 20 px above Finance, over the chips. On CI's Chrome 153, Home
    // there left the body 19 px from its top (run 41995659188), where Chrome 141 takes it to 0, so the test asks only that each
    // key scrolls the body on past where it was.
    const name = finance.getByTestId('line-money-1').locator('button.line-name');
    await tabOnto(page, name);
    const from = await name.evaluate((e) => {
      const scroller = e.closest('.panel-body') as HTMLElement;
      const r = e.getBoundingClientRect();
      scroller.scrollTop += r.top + r.height / 2 - (e.closest('[data-movable]')!.getBoundingClientRect().top - 20);
      return scroller.scrollTop;
    });
    await expect(name).toBeFocused();
    expect(await lies(name)).toBe('outside');
    await page.keyboard.press('ArrowDown');
    await expect.poll(() => body.evaluate((b) => b.scrollTop)).toBeGreaterThan(from);
    await page.keyboard.press('Home');
    await expect.poll(() => body.evaluate((b) => b.scrollTop)).toBeLessThan(from);
    await expect(name).toBeFocused();
  });

  /** The late game whose chips run onto a second line, 46-74 px down, at Chrome's 125% of 1152×720, 922×576: at 5,400×, three
   * medals held, the countdown up and Line 1's fare raised to $2.50, its undo on the second line beside the Contracts chip. */
  async function lateGame(page: Page) {
    await holdSpeed(page, 5);
    await game(
      page,
      (d) => {
        d.clock.elapsed = 288 * 86_400 - 3 * 3_600;
        d.ledger.push({ day: 2, kind: 'buses', amountCents: -100_000_000, lineId: null }, { day: 2, kind: 'contract', amountCents: 6_000_000, lineId: null });
        d.closesBelowFloor = 1;
        d.medals = { bronze: 1, silver: 1, gold: 1 };
        d.tripsCarried = 400_000;
      },
      { width: 922, height: 576 },
    );
    await expect(page.getByTestId('countdown')).toBeVisible();
    await setFare(page, 'Line 1', '$2.50');
    await expect(page.getByTestId('undo')).toHaveText('Undo: Line 1’s fare');
  }

  // The review of the twenty-fourth round's keyboard fixes: the chips draw under the panels, and in that late game Lines, dragged up
  // and left as far as it goes, its top at 56 px, lay over the Undo chip's middle, where Enter undid Line 1's fare unseen. Held
  // instead, Enter did nothing (the twenty-fifth round). The chips come up over the panels while the keyboard is on one, so the key
  // works the chip in sight. Shown failing (TS-04) with the chips kept under the panels: the chip under Lines, the fare not undone.
  test('brings a chip up over the panel dragged onto it as the keyboard comes to it, and presses it in sight', async ({ page }) => {
    test.setTimeout(150_000);
    await lateGame(page);
    const undo = page.getByTestId('undo');
    await page.getByRole('button', { name: 'Lines', exact: true }).click();
    const lines = page.locator('[data-movable="lines"]');
    await drag(page, 'lines', 4 - (await lines.boundingBox())!.x, -400);
    expect((await lines.boundingBox())!.y).toBe(56);
    expect(await over(undo)).toBe('lines');
    await tabOnto(page, undo);
    expect(await over(undo)).toBe('undo');
    await page.keyboard.press('Enter');
    await expect(undo).toHaveCount(0);
    await page.getByRole('button', { name: 'Finance', exact: true }).click();
    await page.getByTestId('finance-lines').click();
    await expect(page.getByRole('button', { name: 'Fare for Line 1' })).toContainText('$2.25');
  });

  // The twenty-fifth round: in that late game, Lines then Finance opened from the dock, Finance's free place, 178 to 618 px across
  // from 56 px down, lay over the Contracts chip's middle, where the keyboard's ring showed the chip's top 10 px and Enter, held,
  // opened nothing, 2 runs of 2. Shown failing (TS-04) with the chips kept under the panels: the chip under Finance, no Contracts.
  test('brings a chip up over a panel in its free place as the keyboard comes to it, and presses it in sight', async ({ page }) => {
    test.setTimeout(150_000);
    await lateGame(page);
    await page.getByRole('button', { name: 'Lines', exact: true }).click();
    await page.getByRole('button', { name: 'Finance', exact: true }).click();
    const chip = page.getByTestId('contracts-chip');
    expect(await over(chip)).toBe('finance');
    await tabOnto(page, chip);
    expect(await over(chip)).toBe('contracts-chip');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('contracts')).toBeVisible();
  });

  // The review of the twenty-fifth round: a chip comes up over the panels as it has the focus, however it came to it. Raised only
  // with the keyboard's ring, the Undo chip the mouse had pressed and let go off stayed under Lines dragged onto it, and the key
  // that rang it raised it and pressed it at once, so Enter undid Line 1's fare unseen, 4 runs of 4. Shown failing (TS-04) with the
  // chips raised only with the keyboard's ring: the chip under Lines as Enter comes.
  test('keeps a chip the mouse left the focus on up over a panel dragged onto it', async ({ page }) => {
    test.setTimeout(150_000);
    await lateGame(page);
    const undo = page.getByTestId('undo');
    await page.getByRole('button', { name: 'Lines', exact: true }).click();
    const u = (await undo.boundingBox())!;
    await page.mouse.move(u.x + u.width / 2, u.y + u.height / 2);
    await page.mouse.down();
    await page.mouse.move(u.x + u.width / 2, u.y + 300, { steps: 4 });
    await page.mouse.up();
    await expect(undo).toBeFocused();
    await expect(undo).toHaveText('Undo: Line 1’s fare');
    const lines = page.locator('[data-movable="lines"]');
    await drag(page, 'lines', 4 - (await lines.boundingBox())!.x, -400);
    await expect(undo).toBeFocused();
    expect(await over(undo)).toBe('undo');
    await page.keyboard.press('Enter');
    await expect(undo).toHaveCount(0);
  });

  // The review of the twenty-fifth round: run onto a second line, the chips' row has a box 806 px across at 922×576, and raised over
  // the panels it took their presses past its chips: a click on Finance's × where the row runs over it left Finance open, 4 of 4,
  // and a drag by its heading there moved nothing; at rest it took the map's. Only the chips take a press now. Shown failing (TS-04)
  // with the row's box taking presses: Finance still open.
  test('takes no press in the chips’ row past its chips', async ({ page }) => {
    test.setTimeout(150_000);
    await lateGame(page);
    // At rest, past the last chip of the second line, the map's.
    const row = (await page.getByTestId('sim-panel').boundingBox())!;
    const onRow = (x: number, y: number) => page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('.top-bar') !== null, [x, y] as const);
    expect(await onRow(row.x + row.width - 10, row.y + row.height - 6)).toBe(false);
    await page.getByRole('button', { name: 'Lines', exact: true }).click();
    await page.getByRole('button', { name: 'Finance', exact: true }).click();
    await tabOnto(page, page.getByTestId('contracts-chip'));
    const close = (await page.getByTestId('finance').getByRole('button', { name: 'Close', exact: true }).boundingBox())!;
    const at = { x: close.x + close.width / 2, y: close.y + 3 };
    expect(at.x).toBeLessThan(row.x + row.width);
    expect(at.y).toBeLessThan(row.y + row.height);
    await page.mouse.click(at.x, at.y);
    await expect(page.getByTestId('finance')).toHaveCount(0);
  });

  // The review of the twenty-fifth round: the day's card stands beside the panels, and with Finance dragged to the right at 922×576
  // it stood over the Contracts chip's middle, above the chips even as they come up, where a key on the chip waits. Shown failing
  // (TS-04) with no hold on the chips: Contracts opened under the card.
  test('presses no chip under the day’s card', async ({ page }) => {
    test.setTimeout(150_000);
    await lateGame(page);
    await page.getByRole('button', { name: 'Finance', exact: true }).click();
    await drag(page, 'finance', 420 - (await page.locator('[data-movable="finance"]').boundingBox())!.x, 0);
    await page.getByTestId('play').click();
    await expect(page.getByTestId('day-card')).toBeVisible({ timeout: 30_000 });
    const chip = page.getByTestId('contracts-chip');
    await tabOnto(page, chip);
    expect(await over(chip)).toBe('day-card');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    await expect(page.getByTestId('contracts')).toHaveCount(0);
  });
});
