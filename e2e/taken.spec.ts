// The keyboard's control taken from under it by something other than its own press, and a press's guard after an undo (the
// systems audit's twentieth round, its second lane, on #191's fixes, each found 3 runs of 3 at each of three sizes). Ctrl+Z
// took a stop card's step down or a line's row, Finance's rows and Buying and building, and the dock's Lines with the only
// line; another tab's delete took a Saves row's Load; a quarter's close took Finance's group as it emptied the quarter's
// column; a panel the mouse opened, the keyboard in it, closed with what it showed; and each time the focus fell to the page,
// where Space played. A list the mouse opened and Escape closed was held as the keyboard's, so a hand-on later gave the next
// list Space. Sell them and Close it, taken back by Ctrl+Z before their answer, sent nothing at the next press; Create,
// answered with a Close it or straight after an undo that took a line back, kept its card open and waited for good; and a
// waiting Create's label was darker than a turned-off button's. Each shown failing (TS-04) with its fix taken out.
import { expect, test, type Locator, type Page } from './base';
import { DEBUG_STOPS } from '../src/sim/commands/debugLine';
import { foundCompany, leaveHome } from './found';
import { countSends } from './keys';
import { build, city, frames, holdAnswers, toScreen, withDebugLine, type SaveData } from './shell';

// The tests share nothing, so the e2e's sevenths share them out one by one.
test.describe.configure({ mode: 'parallel' });

/** On Huntington Avenue between Symphony and the MFA, more than 250 m from each (presses.spec.ts). */
const ON_HUNTINGTON: [number, number] = [-71.0903, 42.33995];

/** The debug line's game, edited by `edit`, past Home, with nothing open. */
async function game(page: Page, edit?: (data: SaveData) => void) {
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

/** Clicks the map at `at`, a stop's place for the tool that is out. */
async function clickAt(page: Page, at: readonly [number, number]) {
  const [x, y] = await toScreen(page, at);
  await page.mouse.click(x, y);
}

/** A line drawn on the debug line's first two stops (its others lie below a 720 px window's foot): its card, and its Create. */
async function drawTwo(page: Page) {
  await build(page, 'Draw a line');
  const draft = page.getByTestId('draft-card');
  await frames(page);
  for (const stop of DEBUG_STOPS.slice(0, 2)) await clickAt(page, stop.at);
  await expect(draft).toContainText('2 stops', { timeout: 10_000 });
  await expect(draft).toHaveAttribute('data-refusal', '', { timeout: 10_000 });
  return { draft, create: draft.getByRole('button', { name: 'Create' }) };
}

/** A line drawn and bought by the mouse, as drawTwo: Lines opens on it. */
async function bought(page: Page) {
  const { draft, create } = await drawTwo(page);
  await create.click();
  await expect(draft).toHaveCount(0, { timeout: 10_000 });
}

/** Holds the sim's answers back (holdAnswers, added before the page loads) until release. */
const hold = (page: Page) => page.evaluate(() => void ((window as unknown as { held: unknown[] }).held = []));
/** The types of the answers held, in order. */
const heldTypes = (page: Page) => page.evaluate(() => ((window as unknown as { held: [unknown, string][] | null }).held ?? []).map(([, type]) => type).join(','));
/** Hands the page the answers held, in one task. */
const release = (page: Page) => page.evaluate(() => (window as unknown as { release: () => void }).release());

test.describe('the keyboard’s control taken from under it, and a press after an undo', () => {
  test.skip(!city.sim, 'no sim file in this build yet');

  test('a stop card’s step down and a line’s row, taken by Ctrl+Z, hand the focus to the step up and the line left', async ({ page }) => {
    test.setTimeout(90_000);
    await game(page);
    // Line 2 on Stops 1 and 2, so Stop 2's card has a row for each line.
    await bought(page);
    const panel = page.getByTestId('inspector');
    await expect(panel.getByTestId('line-card')).toHaveAttribute('data-line', '2');
    await tabOnto(page, panel.getByTestId('line-stops').getByRole('button', { name: 'Stop 2', exact: true }));
    await page.keyboard.press('Enter');
    const card = page.getByTestId('stop-card');
    await expect(card.locator('.line-row')).toHaveCount(2);
    // The step down, gone as Ctrl+Z takes back the step up: the step up now in its place.
    await tabOnto(page, card.getByRole('button', { name: /^Make it a Shelter/ }));
    await page.keyboard.press('Enter');
    await expect(card).toHaveAttribute('data-tier', '2', { timeout: 10_000 });
    await tabOnto(page, card.getByRole('button', { name: /^Make it a Sign/ }));
    await page.keyboard.press('Control+z');
    await expect(card).toHaveAttribute('data-tier', '1', { timeout: 10_000 });
    await expect(card.getByRole('button', { name: /^Make it a Shelter/ })).toBeFocused();
    // Line 2's row, the keyboard on its line's button, gone as Ctrl+Z takes back Line 2: Line 1's row has it.
    await tabOnto(page, card.getByRole('button', { name: 'Line 2', exact: true }));
    await page.keyboard.press('Control+z');
    await expect(card.locator('.line-row')).toHaveCount(1, { timeout: 10_000 });
    await expect(card.getByRole('button', { name: 'Line 1', exact: true })).toBeFocused();
  });

  test('Finance’s rows, taken by Ctrl+Z, hand the focus to the control in their place: a line’s fare list and Buying and building', async ({ page }) => {
    test.setTimeout(90_000);
    await game(page);
    await bought(page);
    await page.getByTestId('inspector').getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByTestId('dock').getByRole('button', { name: 'Finance', exact: true }).click();
    const finance = page.getByTestId('finance');
    // Lines: Line 2's fare list, its row gone with Line 2. The last of the body's controls, so the last now has it.
    await finance.getByTestId('finance-lines').click();
    await tabOnto(page, finance.getByRole('button', { name: 'Fare for Line 2' }));
    await page.keyboard.press('Control+z');
    await expect(finance.getByRole('button', { name: 'Fare for Line 2' })).toHaveCount(0, { timeout: 10_000 });
    await expect(finance.getByRole('button', { name: 'Fare for Line 1' })).toBeFocused();
    // Breakdown: Buying and building, gone as Ctrl+Z takes back the day's only purchase.
    await bought(page);
    await finance.getByTestId('finance-breakdown').click();
    const group = finance.getByRole('button', { name: 'Buying and building' });
    await tabOnto(page, group);
    await page.keyboard.press('Control+z');
    await expect(group).toHaveCount(0, { timeout: 10_000 });
    await expect(finance.getByTestId('finance-body').locator('button:focus')).toHaveCount(1);
  });

  test('Finance’s Buying and building, gone at the quarter’s close with the keyboard on it, hands the focus on in Finance', async ({ page }) => {
    test.setTimeout(90_000);
    // Day 8, the quarter's last, at 23:58:30, and a stop bought on day 3: the group holds money in the quarter's column alone.
    await game(page, (d) => {
      d.clock.elapsed = 7 * 86_400 + 18 * 3_600 + 58 * 60 + 30;
      d.ledger.push({ day: 3, kind: 'stops', amountCents: -400_000, lineId: null });
    });
    await page.getByTestId('dock').getByRole('button', { name: 'Finance', exact: true }).click();
    const finance = page.getByTestId('finance');
    await finance.getByTestId('finance-breakdown').click();
    const group = finance.getByRole('button', { name: 'Buying and building' });
    await tabOnto(page, group);
    await page.keyboard.press('2'); // 60×: the close in a game minute and a half
    await expect(page.getByTestId('day-card')).toBeVisible({ timeout: 30_000 });
    await expect(group).toHaveCount(0);
    await expect(finance.getByTestId('finance-body').locator('button:focus')).toHaveCount(1);
  });

  test('another tab’s delete takes a Saves row’s Load from under the keyboard, and the row has the focus', async ({ page, context }) => {
    test.setTimeout(120_000);
    await game(page);
    await page.getByRole('button', { name: 'Saves' }).click();
    const row = page.getByTestId('saves').getByTestId('slot-2');
    await row.getByRole('button', { name: 'Save here' }).click();
    await expect(row).toHaveAttribute('data-empty', 'no', { timeout: 10_000 });
    await tabOnto(page, row.getByRole('button', { name: 'Load', exact: true }));
    // Another page of the game, at Home, deletes slot 2.
    const other = await context.newPage();
    await other.goto('./');
    await expect(other.getByTestId('home')).toBeVisible({ timeout: 30_000 });
    await other.getByTestId('home-saves').click();
    const there = other.getByTestId('saves').getByTestId('slot-2');
    await there.getByRole('button', { name: 'Delete', exact: true }).click();
    await there.getByRole('button', { name: 'Delete Slot 2' }).click();
    await expect(there).toHaveAttribute('data-empty', 'yes', { timeout: 10_000 });
    await other.close();
    await page.bringToFront();
    // This page lists its slots again at the other's write, at most 2 s on: the row reads Empty, its Load gone.
    await expect(row).toHaveAttribute('data-empty', 'yes', { timeout: 15_000 });
    await expect(row).toBeFocused();
  });

  test('a panel the mouse opened, the keyboard in it, gone with what it showed, and the dock’s Lines turned off, give Build the focus', async ({ page }) => {
    test.setTimeout(120_000);
    await game(page, (d) => void (d.lines = []));
    const build_ = page.getByTestId('build');
    const lines = page.getByTestId('dock').getByRole('button', { name: 'Lines', exact: true });
    await expect(lines).toBeDisabled();
    // Lines, opened by the game after the mouse's Create, the keyboard on Edit route: Ctrl+Z takes back the only line.
    await bought(page);
    const panel = page.getByTestId('inspector');
    await tabOnto(page, panel.getByRole('button', { name: 'Edit route' }));
    await page.keyboard.press('Control+z');
    await expect(panel).toHaveCount(0, { timeout: 10_000 });
    await expect(build_).toBeFocused();
    // The dock's Lines, Escape's hand-back from a Lines the keyboard's Create opened, turned off as Ctrl+Z takes the line back.
    const { draft, create } = await drawTwo(page);
    await tabOnto(page, create);
    await page.keyboard.press('Enter');
    await expect(draft).toHaveCount(0, { timeout: 10_000 });
    await expect(panel).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(lines).toBeFocused();
    await page.keyboard.press('Control+z');
    await expect(lines).toBeDisabled({ timeout: 10_000 });
    await expect(build_).toBeFocused();
    // A stop placed on its own, its card opened by a click, the keyboard on Take it down: Ctrl+Z takes back the placing.
    await build(page, 'Place a stop');
    await clickAt(page, ON_HUNTINGTON);
    await expect(page.getByTestId('undo')).toHaveText(/^Undo: Place Stop/, { timeout: 10_000 });
    await page.keyboard.press('Escape');
    const card = page.getByTestId('stop-card');
    await expect(async () => {
      await clickAt(page, ON_HUNTINGTON);
      await expect(card).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 10_000 });
    await tabOnto(page, card.getByRole('button', { name: /^Take it down/ }));
    await page.keyboard.press('Control+z');
    await expect(card).toHaveCount(0, { timeout: 10_000 });
    await expect(build_).toBeFocused();
  });

  test('a list the mouse opened and Escape closed is no control of the keyboard’s, so after a hand-on Space still plays', async ({ page }) => {
    test.setTimeout(90_000);
    await game(page);
    await bought(page);
    const panel = page.getByTestId('inspector');
    await expect(panel.getByTestId('line-card')).toHaveAttribute('data-line', '2');
    await panel.getByTestId('line-model').click();
    await expect(page.getByRole('listbox')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('listbox')).toHaveCount(0);
    // Ctrl+Z takes back Line 2, and Lines shows Line 1 in its place: Space plays, and opens no list of Line 1's.
    await page.keyboard.press('Control+z');
    await expect(panel.getByTestId('line-card')).toHaveAttribute('data-line', '1', { timeout: 10_000 });
    await frames(page);
    await page.keyboard.press(' ');
    await expect(page.getByTestId('sim-panel')).not.toHaveAttribute('data-speed', '0');
    await expect(page.getByRole('listbox')).toHaveCount(0);
  });

  test('Sell them and Close it, taken back by Ctrl+Z before their answer, send again at the next press', async ({ page }) => {
    test.setTimeout(90_000);
    const sent = await countSends(page);
    await page.addInitScript(holdAnswers);
    // Line 1 on 4 Sparrows where its headways need 2: two are spare.
    await game(page, (d) => void Object.assign((d.lines as Record<string, unknown>[])[0]!, { buses: 4 }));
    await page.getByRole('button', { name: 'Lines', exact: true }).click();
    const panel = page.getByTestId('inspector');
    const spares = panel.getByTestId('line-spares');
    await hold(page);
    await spares.getByRole('button', { name: /^Sell / }).click();
    await expect.poll(() => sent('sell-spares')).toBe(1);
    await page.keyboard.press('Control+z');
    await expect.poll(() => heldTypes(page)).toMatch(/snapshot.*undone.*snapshot/);
    await release(page);
    await frames(page);
    await spares.getByRole('button', { name: /^Sell / }).click();
    await expect.poll(() => sent('sell-spares')).toBe(2);
    await expect(spares).toHaveCount(0, { timeout: 10_000 });
    // Close it, the same way: its ask stays, and a press closes the line.
    await panel.getByRole('button', { name: 'Close line' }).click();
    const ask = panel.getByTestId('close-line');
    await hold(page);
    await ask.getByRole('button', { name: 'Close it' }).click();
    await expect.poll(() => sent('close-line')).toBe(1);
    await page.keyboard.press('Control+z');
    await expect.poll(() => heldTypes(page)).toMatch(/snapshot.*undone.*snapshot/);
    await release(page);
    await frames(page);
    await ask.getByRole('button', { name: 'Close it' }).click();
    await expect.poll(() => sent('close-line')).toBe(2);
    await expect(panel).toHaveCount(0, { timeout: 10_000 });
  });

  test('Create closes its card on its own answer, with Close it or after Ctrl+Z, and waits looking as a turned-off button does', async ({ page }) => {
    test.setTimeout(120_000);
    const sent = await countSends(page);
    await page.addInitScript(holdAnswers);
    await game(page);
    await page.getByRole('button', { name: 'Lines', exact: true }).click();
    const panel = page.getByTestId('inspector');
    const shown = panel.getByTestId('line-card');
    await expect(shown).toHaveAttribute('data-line', '1');
    // The new line's card with no stops yet, its Remove last stop turned off: the label a turned-off button draws.
    await build(page, 'Draw a line');
    const draft = page.getByTestId('draft-card');
    const remove = draft.getByRole('button', { name: 'Remove last stop' });
    await expect(remove).toBeDisabled();
    const off = await remove.evaluate((e) => getComputedStyle(e).color);
    await frames(page);
    for (const stop of DEBUG_STOPS.slice(0, 2)) await clickAt(page, stop.at);
    await expect(draft).toContainText('2 stops', { timeout: 10_000 });
    await expect(draft).toHaveAttribute('data-refusal', '', { timeout: 10_000 });
    const create = draft.getByRole('button', { name: 'Create' });
    // Create pressed, then Close it on Line 1, the two answered together: Line 2 stands and Line 1 has gone.
    await hold(page);
    await create.click();
    await expect(create).toHaveAttribute('aria-disabled', 'true');
    expect(await create.evaluate((e) => getComputedStyle(e).color), 'a waiting Create’s label').toBe(off);
    await panel.getByRole('button', { name: 'Close line' }).click();
    await panel.getByTestId('close-line').getByRole('button', { name: 'Close it' }).click();
    await expect.poll(() => sent('close-line')).toBe(1);
    await expect.poll(() => heldTypes(page)).toMatch(/snapshot.*snapshot/);
    await release(page);
    await expect(draft).toHaveCount(0, { timeout: 10_000 });
    await expect(shown).toHaveAttribute('data-line', '2');
    // Line 3 bought on Line 2's stops; then Ctrl+Z, taking it back, sent just before a Create of the same stops, the two
    // answered together: the Create buys a new Line 3, and the count of lines is as it was.
    await bought(page);
    await expect(page.getByTestId('undo')).toHaveText('Undo: Create Line 3');
    const again = await drawTwo(page);
    await hold(page);
    await page.keyboard.press('Control+z');
    await again.create.click();
    await expect.poll(() => sent('create-line')).toBe(3);
    await expect.poll(() => heldTypes(page)).toMatch(/undone.*snapshot.*snapshot/);
    await release(page);
    await expect(again.draft).toHaveCount(0, { timeout: 10_000 });
    await expect(shown).toHaveAttribute('data-line', '3');
    await expect(page.getByTestId('undo')).toHaveText('Undo: Create Line 3');
    expect(await sent('create-line')).toBe(3);
  });
});
