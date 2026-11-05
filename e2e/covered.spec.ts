// A key never presses a control something else lies over, where no one can see what it presses (Panels.tsx coverOf): under
// another panel its panel comes up, so the press shows the control and the next works it (dropdown.spec.ts); under a card no
// raise lifts, the day's or the lender's, the press waits. Its control is shown in its panel's body first, as Tab shows it.
import { expect, test, type Locator, type Page } from './base';
import { LINE_COLOURS } from '../src/sim/config/lines';
import { foundCompany, leaveHome, STARTING_CENTS } from './found';
import { city, setSpeed, withDebugLine, type SaveData } from './shell';

/** The debug line's game at 1152×720, edited by `edit`, past Home, with nothing open. */
async function game(page: Page, edit?: (data: SaveData) => void) {
  await page.setViewportSize({ width: 1152, height: 720 });
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
});
