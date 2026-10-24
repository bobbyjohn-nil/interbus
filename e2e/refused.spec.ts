// A close that leaves the cash short of a new line's or a route edit's price, with the keyboard on its Create or Save route (the
// systems audit's seventeenth round): turned off under the keyboard, the button let the focus fall to the page, where Space paused
// the game with the day's card up, as the sixteenth round found of a line card's Buy and run. Refused, each keeps the focus now and
// its name, described by the words why, and Space presses nothing. Shown failing (TS-04) on main, the focus on the page and the
// game paused.
import { expect, test, type Locator, type Page } from './base';
import { DEBUG_STOPS } from '../src/sim/commands/debugLine';
import { foundCompany, leaveHome } from './found';
import { build, city, frames, toScreen, withDebugLine, type SaveData } from './shell';

/** The debug line's game a minute and a half before day 2 closes, paused. */
const CLOCK = 86_400 + 18 * 3_600 + 58 * 60 + 30;

/** The cash a save's ledger sums to. */
const cashOf = (d: SaveData) => (d.ledger as { amountCents: number }[]).reduce((sum, row) => sum + row.amountCents, 0);

/** The debug line's game at CLOCK, the cash set by `cash` where it is given, past Home. */
async function nearTheClose(page: Page, cash?: (d: SaveData) => number) {
  const edit = (d: SaveData) => {
    d.clock.elapsed = CLOCK;
    if (cash) (d.ledger as Record<string, unknown>[]).push({ day: 2, kind: 'buses', amountCents: cash(d) - cashOf(d), lineId: null });
  };
  if (cash) {
    await withDebugLine(page, edit);
    return;
  }
  await page.goto('./');
  await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
  await leaveHome(page);
  await foundCompany(page);
  await withDebugLine(page, edit);
}

const clickAt = async (page: Page, at: readonly [number, number]) => {
  const [x, y] = await toScreen(page, at);
  await page.mouse.click(x, y);
};

/** The close at 60× (the key 2), the keyboard on `button`, which it refuses: the focus stays on it, and Space presses nothing. */
async function refusedByTheClose(page: Page, button: Locator, card: Locator) {
  await page.keyboard.press('2');
  await expect(page.getByTestId('day-card')).toBeVisible({ timeout: 30_000 });
  await expect(card).toHaveAttribute('data-refusal', 'insufficient_funds');
  await expect(button).toBeFocused();
  await expect(button).toHaveAttribute('aria-disabled', 'true');
  await expect(button).toHaveAccessibleDescription(/^\$[\d,.]+ short$/);
  await page.keyboard.press(' ');
  await expect(page.getByTestId('sim-panel')).not.toHaveAttribute('data-speed', '0');
  await expect(button).toBeFocused();
}

test.describe('a close that refuses the Create or Save route the keyboard is on', () => {
  test.skip(!city.sim, 'no sim file in this build yet');

  test('leaves the focus on the new line’s Create, where Space presses nothing', async ({ page }) => {
    test.setTimeout(90_000);
    await nearTheClose(page);
    /** A new line on the debug line's first two stops: its card, and its price. */
    const drawTwo = async () => {
      await build(page, 'Draw a line');
      const draft = page.getByTestId('draft-card');
      await frames(page);
      await clickAt(page, DEBUG_STOPS[0]!.at);
      await clickAt(page, DEBUG_STOPS[1]!.at);
      await expect(draft).toHaveAttribute('data-price', /^[1-9]\d*$/, { timeout: 10_000 });
      await expect(draft).toHaveAttribute('data-refusal', '');
      return { draft, price: Number(await draft.getAttribute('data-price')) };
    };
    const { price } = await drawTwo();
    await page.keyboard.press('Escape');
    // Again, with the cash $20 over what Create may spend, the floor's $150k under it: the close takes more than $20.
    await nearTheClose(page, () => price - 15_000_000 + 2_000);
    const { draft } = await drawTwo();
    const create = draft.getByRole('button', { name: 'Create' });
    await draft.getByRole('button', { name: 'Remove last stop' }).focus();
    await page.keyboard.press('Shift+Tab');
    await expect(create).toBeFocused();
    await refusedByTheClose(page, create, draft);
  });

  test('leaves the focus on the route editor’s Save route, where Space presses nothing', async ({ page }) => {
    test.setTimeout(90_000);
    await nearTheClose(page);
    /** The route editor on the debug line, a new stop clicked past Longwood: its card, and its price less what comes down. */
    const extend = async () => {
      await page.getByRole('button', { name: 'Lines', exact: true }).click();
      await page.getByTestId('inspector').getByRole('button', { name: 'Edit route' }).click();
      const editor = page.getByTestId('route-editor');
      await expect(editor).toBeVisible();
      await frames(page);
      await clickAt(page, [-71.098, 42.346]);
      await expect(editor).toHaveAttribute('data-price', /^[1-9]\d*$/, { timeout: 10_000 });
      await expect(editor).toHaveAttribute('data-refusal', '');
      return { editor, net: Number(await editor.getAttribute('data-price')) - Number((await editor.getAttribute('data-refund')) || 0) };
    };
    const { net } = await extend();
    await page.keyboard.press('Escape');
    await nearTheClose(page, () => net - 15_000_000 + 2_000);
    const { editor } = await extend();
    const save = editor.getByRole('button', { name: 'Save route' });
    await editor.getByRole('button', { name: 'Cancel' }).focus();
    await page.keyboard.press('Shift+Tab');
    await expect(save).toBeFocused();
    await refusedByTheClose(page, save, editor);
  });
});
