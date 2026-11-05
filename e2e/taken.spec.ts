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

  // The hand-back as the game closes a panel under the keyboard asked whether the player's last key was their own close in the
  // effect after the paint: an Escape pressed between the commit that took Lines off the page and that effect counted, and the
  // focus stayed on the page, where Space plays (the review of the dragged card's fix, 2 runs of 3 at a quarter of the
  // processor's speed). The commit keeps the answer now. Here the Escape comes in that gap, from a MutationObserver, the
  // processor at a twentieth of its speed so React's effects wait for a task of their own. Shown failing (TS-04) with the
  // player's own close asked after the paint. And Build so focused showed the ring, but Space played: the Escape, a silent key,
  // kept its silence for the hand-on that came after it, which took Build's source as the mouse had left it (the systems
  // audit's twenty-first round, 4 runs of 4 that landed in the gap). Space presses Build now, as without the Escape: shown
  // failing (TS-04) on 409570e.
  test('an Escape pressed as the game closes Lines under the keyboard still gives Build the focus, and Space presses it', async ({ page }) => {
    test.setTimeout(90_000);
    await game(page, (d) => void (d.lines = []));
    const build_ = page.getByTestId('build');
    await bought(page);
    const panel = page.getByTestId('inspector');
    await tabOnto(page, panel.getByRole('button', { name: 'Edit route' }));
    await page.evaluate(() => {
      const box = document.querySelector('[data-movable="lines"]')!;
      const watch = new MutationObserver(() => {
        if (box.isConnected) return;
        watch.disconnect();
        // Where a key goes once the control with the focus has left the page: the page's body.
        document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      });
      watch.observe(document.body, { childList: true, subtree: true });
    });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 20 });
    await page.keyboard.press('Control+z');
    await expect(panel).toHaveCount(0, { timeout: 30_000 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await expect(build_).toBeFocused();
    await page.keyboard.press(' ');
    await expect(page.getByTestId('build-menu')).toBeVisible();
    await expect(page.getByTestId('sim-panel')).toHaveAttribute('data-speed', '0');
  });

  // The same hand-on with a key in the way, the sim's answer held as it went in: a Shift, whose silence was kept for the hand-on
  // after it, and an Escape that closed Lines' headway list, counted as the player's own close of Lines, which left the focus
  // on the page. Either way Space then played, 15 runs of 15 at five sizes (the systems audit's twenty-first round). Shown
  // failing (TS-04) on 409570e. And Ctrl+Z itself on Lines' ×, counted as a press of the × (the round's review): shown failing
  // (TS-04) with every key on a × counted.
  test('a Shift, an Escape that closes a list, or Ctrl+Z on Lines’ × as the answer is on its way leaves Build the focus and Space', async ({ page }) => {
    test.setTimeout(120_000);
    await page.addInitScript(holdAnswers);
    await game(page, (d) => void (d.lines = []));
    const build_ = page.getByTestId('build');
    const panel = page.getByTestId('inspector');
    const menu = page.getByTestId('build-menu');
    for (const between of ['Shift', 'list', '×'] as const) {
      await bought(page);
      const peak = panel.getByTestId('headway-peak');
      await tabOnto(page, between === '×' ? panel.getByRole('button', { name: 'Close', exact: true }) : peak);
      await hold(page);
      await page.keyboard.press('Control+z');
      if (between === 'Shift') await page.keyboard.press('Shift');
      else if (between === 'list') {
        await page.keyboard.press('ArrowDown');
        await expect(page.getByRole('listbox')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.getByRole('listbox')).toHaveCount(0);
        await expect(peak).toBeFocused();
      }
      await expect(panel).toBeVisible();
      await release(page);
      await expect(panel).toHaveCount(0, { timeout: 10_000 });
      await expect(build_, between).toBeFocused();
      await page.keyboard.press(' ');
      await expect(menu, between).toBeVisible();
      await expect(page.getByTestId('sim-panel')).toHaveAttribute('data-speed', '0');
      await page.keyboard.press('Escape');
      await expect(menu).toHaveCount(0);
    }
  });

  // The systems audit's twenty-second round: the keyboard in an open list, which is drawn in the page's main landmark outside its
  // button's panel, was in no panel and held for no hand-on, so as Ctrl+Z's answer took the list away, with its line taken back
  // or its fare's row gone, the focus fell to the page, where Space played, 30 runs of 30, where the same moment with the list
  // closed handed on. A focus in an open list is its button's now (heldFocus.ts standsFor). Shown failing (TS-04) with the list's
  // focus its own.
  test('the keyboard in an open list Ctrl+Z’s answer takes away goes where its button’s would: Lines gone, to Build', async ({ page }) => {
    test.setTimeout(120_000);
    await page.addInitScript(holdAnswers);
    await game(page, (d) => void (d.lines = []));
    await bought(page);
    const panel = page.getByTestId('inspector');
    await tabOnto(page, panel.getByTestId('headway-peak'));
    await hold(page);
    await page.keyboard.press('Control+z');
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('listbox')).toBeFocused();
    await release(page);
    await expect(panel).toHaveCount(0, { timeout: 10_000 });
    await expect(page.getByTestId('build')).toBeFocused();
    await page.keyboard.press(' ');
    await expect(page.getByTestId('build-menu')).toBeVisible();
    await expect(page.getByTestId('sim-panel')).toHaveAttribute('data-speed', '0');
  });

  test('the keyboard in an open list Ctrl+Z’s answer takes away goes where its button’s would: to the line left, and the next fare', async ({ page }) => {
    test.setTimeout(120_000);
    await page.addInitScript(holdAnswers);
    await game(page);
    // Lines on Line 2, its headway list open as Ctrl+Z takes back Line 2: Lines on Line 1, its Buses list has the keyboard.
    await bought(page);
    const panel = page.getByTestId('inspector');
    await tabOnto(page, panel.getByTestId('headway-peak'));
    await hold(page);
    await page.keyboard.press('Control+z');
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('listbox')).toBeFocused();
    await release(page);
    await expect(panel.getByTestId('line-card')).toHaveAttribute('data-line', '1', { timeout: 10_000 });
    await expect(panel.getByTestId('line-model')).toBeFocused();
    // Finance's fare list of the line Ctrl+Z takes back, open: the fare list of the line left has the keyboard.
    await bought(page);
    const id = await panel.getByTestId('line-card').getAttribute('data-line');
    await panel.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByTestId('dock').getByRole('button', { name: 'Finance', exact: true }).click();
    const finance = page.getByTestId('finance');
    await finance.getByTestId('finance-lines').click();
    await tabOnto(page, finance.getByRole('button', { name: `Fare for Line ${id}` }));
    await hold(page);
    await page.keyboard.press('Control+z');
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('listbox', { name: `Fare for Line ${id}` })).toBeFocused();
    await release(page);
    await expect(finance.getByRole('button', { name: `Fare for Line ${id}` })).toHaveCount(0, { timeout: 10_000 });
    await expect(finance.getByRole('button', { name: 'Fare for Line 1' })).toBeFocused();
  });

  // A real Escape in that gap, heard on the page, the control the keyboard was on gone with Lines: React put the game's waiting
  // hand-on through in the Escape's own dispatch, ahead of the Escape's own update, so Build took its source as the mouse had left
  // it and Space played, 3 runs of 3 (the review of the twenty-first round), where the test above's Escape, sent by the page
  // itself, ends its dispatch before React's turn. The page is held in the gap by a request the test answers once the key is
  // sent. Shown failing (TS-04) with every silent key silent wherever it was heard.
  test('a real Escape in the gap as the game closes Lines under the keyboard leaves Build the focus and Space', async ({ page }) => {
    test.setTimeout(120_000);
    await game(page, (d) => void (d.lines = []));
    const build_ = page.getByTestId('build');
    await bought(page);
    const panel = page.getByTestId('inspector');
    await tabOnto(page, panel.getByRole('button', { name: 'Edit route' }));
    await page.evaluate(() => {
      const box = document.querySelector('[data-movable="lines"]')!;
      const watch = new MutationObserver(() => {
        if (box.isConnected) return;
        watch.disconnect();
        // Held in the task that took Lines off the page until the test has sent the key, and a little after, for it to come in.
        const hold = new XMLHttpRequest();
        hold.open('GET', './zz-gap', false);
        try {
          hold.send();
        } catch {
          // answered or not, the key is on its way
        }
        const t = performance.now();
        while (performance.now() - t < 400);
      });
      watch.observe(document.body, { childList: true, subtree: true });
    });
    const cdp = await page.context().newCDPSession(page);
    const escape = { key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 };
    let sent: Promise<unknown> | null = null;
    await page.route('**/zz-gap', async (route) => {
      sent = cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...escape }).then(() => cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', ...escape }));
      await new Promise((done) => setTimeout(done, 150));
      await route.fulfill({ status: 204, body: '' });
    });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 20 });
    await page.keyboard.press('Control+z');
    await expect(panel).toHaveCount(0, { timeout: 30_000 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await expect.poll(() => sent !== null, { timeout: 10_000 }).toBe(true);
    await sent;
    await frames(page);
    await expect(build_).toBeFocused();
    await page.keyboard.press(' ');
    await expect(page.getByTestId('build-menu')).toBeVisible();
    await expect(page.getByTestId('sim-panel')).toHaveAttribute('data-speed', '0');
  });

  // Lines the keyboard opened from the dock, closed so, gave the page the focus too, its opener turned off with the line (the
  // review of #194, 3 runs of 3 at three sizes). Shown failing (TS-04) with Build given only for a panel the mouse opened.
  test('a panel gone with what it showed under the keyboard, opened by the mouse or the keyboard, and the dock’s Lines turned off, give Build the focus', async ({ page }) => {
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
    // Lines opened by the keyboard from the dock, the same way.
    await bought(page);
    await panel.getByRole('button', { name: 'Close', exact: true }).click();
    await tabOnto(page, lines);
    await page.keyboard.press('Enter');
    await expect(panel).toBeVisible();
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
    // Create pressed, then Edit route opened in Lines while its line is on its way: the answer leaves the route editor out, where
    // it put the editor down and opened Lines on the new line in its place (the review of #194, 3 runs of 3, older). Shown
    // failing (TS-04) with the press kept through the line tool's going.
    const third = await drawTwo(page);
    await hold(page);
    await third.create.click();
    await expect.poll(() => sent('create-line')).toBe(4);
    await panel.getByRole('button', { name: 'Edit route' }).click();
    const editor = page.getByTestId('route-editor');
    await expect(editor).toBeVisible();
    await release(page);
    await expect(page.getByTestId('undo')).toHaveText('Undo: Create Line 4', { timeout: 10_000 });
    await frames(page);
    await expect(editor).toBeVisible();
  });

  // The player's own close by a key of a panel the mouse opened leaves the page the focus, so Space plays, as Escape does
  // (focusback.spec's tier test): the new line's card's Cancel, counted as the game's close, gave Build the keyboard, and Space
  // opened the Build menu (the review of #194, 3 runs of 3 at three sizes, new in it); and nothing held a ×'s or Help's ?
  // there. Shown failing (TS-04) with Cancel not counted the player's, and with Escape alone counted.
  test('the player’s own close by a key leaves Space to the game: the new line’s Cancel, Finance’s × and Help’s ?', async ({ page }) => {
    test.setTimeout(90_000);
    await game(page);
    const speed = page.getByTestId('sim-panel');
    /** Space plays, the page holding the focus, and Space again pauses. */
    const spacePlays = async (after: string) => {
      expect(await page.evaluate(() => document.activeElement === document.body), `the page has the focus after ${after}`).toBe(true);
      await page.keyboard.press(' ');
      await expect(speed, `Space plays after ${after}`).not.toHaveAttribute('data-speed', '0');
      await page.keyboard.press(' ');
      await expect(speed).toHaveAttribute('data-speed', '0');
    };
    const { draft } = await drawTwo(page);
    await tabOnto(page, draft.getByRole('button', { name: 'Cancel' }));
    await page.keyboard.press('Enter');
    await expect(draft).toHaveCount(0);
    await spacePlays('Cancel');
    await page.getByTestId('dock').getByRole('button', { name: 'Finance', exact: true }).click();
    const finance = page.getByTestId('finance');
    await tabOnto(page, finance.getByRole('button', { name: 'Close', exact: true }));
    await page.keyboard.press('Enter');
    await expect(finance).toHaveCount(0);
    await spacePlays('Finance’s ×');
    await page.getByRole('button', { name: 'Saves' }).click();
    await page.getByTestId('saves').getByRole('button', { name: 'Help' }).click();
    const help = page.getByTestId('help');
    await expect(help).toBeVisible();
    // The keyboard on its chosen view's tab, not its ×, so the ? alone closes it.
    await tabOnto(page, help.locator('[role="tab"][aria-selected="true"]'));
    await page.keyboard.press('?');
    await expect(help).toHaveCount(0);
    await spacePlays('Help’s ?');
  });
});
