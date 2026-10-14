// The Build menu's tools as the systems audit (D26) found them: a refused click in a line's draft took
// every later click with it, the draft card and Place a stop's card went stale when the game changed
// under them, and Escape or a press meant only to close a menu also put the tool down or used it.
// Each test here failed before its fix. (Place a depot's card and the cash it needs are the depot
// rule's unit tests: src/sim/rules/depot.test.ts and src/worker/host.test.ts.)
import { expect, test, type Page } from '@playwright/test';
import { DEBUG_STOPS } from '../src/sim/commands/debugLine';
import { foundCompany, STARTING_CENTS } from './found';
import { build, city, onDepotLand, pointAt, toScreen, zoomOutOnce } from './shell';

/** On Huntington Avenue between Symphony and the MFA, more than 250 m from each. */
const ON_HUNTINGTON: [number, number] = [-71.0903, 42.33995];
const [COPLEY, SYMPHONY, MFA, LONGWOOD] = DEBUG_STOPS.map((s) => s.at) as [[number, number], [number, number], [number, number], [number, number]];

async function clickAt(page: Page, at: [number, number]) {
  const [x, y] = await toScreen(page, at);
  await page.mouse.click(x, y);
}

/** A founded company one step out from the opening view, with its first depot bought if `depot`. */
async function start(page: Page, depot: boolean) {
  await page.goto('./');
  await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
  await foundCompany(page);
  await zoomOutOnce(page);
  if (!depot) return;
  await build(page, 'Place a depot');
  await clickAt(page, onDepotLand());
  await expect(page.getByTestId('sim-panel')).toHaveAttribute('data-cash', String(STARTING_CENTS - 15_000_000));
}

test.describe('the Build menu’s tools', () => {
  test.skip(!city.sim, 'no sim file in this build yet');

  test('a refused click in a line’s draft is not kept: later clicks add stops, and Remove last stop takes off what the card shows', async ({ page }) => {
    await start(page, false);
    await build(page, 'Draw a line');
    const draft = page.getByTestId('draft-card');
    // With no depot the card says so first, and cannot name Copley clicked again: Remove last stop takes
    // off Symphony, the last stop it shows, and the refused click with it. (Metro 40s, once the card
    // prices them, show it answers all three clicks.)
    for (const at of [COPLEY, SYMPHONY, COPLEY]) await clickAt(page, at);
    await draft.getByRole('button', { name: 'Buses' }).click();
    await page.getByRole('option', { name: /^Metro 40 · / }).click();
    await expect(draft).toContainText(/needs \d+ Metro 40/, { timeout: 10_000 });
    await expect(draft).toHaveAttribute('data-refusal', 'needs_depot');
    await expect(draft).toContainText('2 stops');
    await draft.getByRole('button', { name: 'Remove last stop' }).click();
    await expect(draft).toContainText('1 stop ·');
    await draft.getByRole('button', { name: 'Buses' }).click();
    await page.getByRole('option', { name: /^Sparrow · / }).click();
    await draft.getByRole('button', { name: 'Cancel' }).click();
    await build(page, 'Place a depot');
    await clickAt(page, onDepotLand());
    await expect(page.getByTestId('sim-panel')).toHaveAttribute('data-cash', String(STARTING_CENTS - 15_000_000));

    await build(page, 'Draw a line');
    // Copley, Symphony, then Copley again: refused, and the card says why.
    for (const at of [COPLEY, SYMPHONY, COPLEY]) await clickAt(page, at);
    await expect(draft).toHaveAttribute('data-refusal', 'stop_twice', { timeout: 10_000 });
    await expect(draft).toContainText('2 stops');
    await expect(draft).toContainText('A line stops here only once');
    // The MFA takes the refused click's place, and Longwood follows it.
    await clickAt(page, MFA);
    await clickAt(page, LONGWOOD);
    await expect(draft).toContainText('4 stops', { timeout: 10_000 });
    await expect(draft).toHaveAttribute('data-refusal', '');
    await expect(draft).toHaveAttribute('data-price', '20600000');
    // Refused again: one press of Remove last stop takes the refusal off, then Backspace the last stop.
    await clickAt(page, SYMPHONY);
    await expect(draft).toHaveAttribute('data-refusal', 'stop_twice', { timeout: 10_000 });
    await draft.getByRole('button', { name: 'Remove last stop' }).click();
    await expect(draft).toHaveAttribute('data-refusal', '');
    await expect(draft).toContainText('4 stops');
    await page.keyboard.press('Backspace');
    await expect(draft).toContainText('3 stops');
    await draft.getByRole('button', { name: 'Cancel' }).click();

    // A double-click on a stop places it once: one Backspace leaves the draft empty.
    await build(page, 'Draw a line');
    const [x, y] = await toScreen(page, SYMPHONY);
    await page.mouse.dblclick(x, y);
    await expect(draft).toContainText('1 stop', { timeout: 10_000 });
    await page.keyboard.press('Backspace');
    await expect(draft).toContainText('Click the map to place stops');
  });

  test('the new line’s card follows the game under it: undoing the depot refuses Create', async ({ page }) => {
    await start(page, true);
    await build(page, 'Draw a line');
    const draft = page.getByTestId('draft-card');
    for (const at of [COPLEY, SYMPHONY, MFA, LONGWOOD]) await clickAt(page, at);
    await expect(draft).toHaveAttribute('data-price', '20600000', { timeout: 10_000 });
    await expect(draft).toHaveAttribute('data-refusal', '');
    await page.keyboard.press('Control+z');
    await expect(page.getByTestId('sim-panel')).toHaveAttribute('data-cash', String(STARTING_CENTS));
    await expect(draft).toHaveAttribute('data-refusal', 'needs_depot');
    await expect(draft).toContainText('Place a depot first');
    await expect(draft.getByRole('button', { name: 'Create' })).toBeDisabled();
  });

  test('Place a stop’s card follows the stops under a resting pointer: placed, it names the stop; undone, a Sign again', async ({ page }) => {
    await start(page, false);
    const panel = page.getByTestId('sim-panel');
    await build(page, 'Place a stop');
    const card = page.getByTestId('stop-site-card');
    const [x, y] = await pointAt(page, ON_HUNTINGTON);
    await page.mouse.move(x, y);
    await expect(card).toHaveAttribute('data-ok', 'yes', { timeout: 10_000 });
    await expect(card).toContainText('A Sign here');
    // Past the pointer's 100 ms report, so the press itself asks nothing new.
    await page.waitForTimeout(300);
    await page.mouse.down();
    await page.mouse.up();
    await expect(panel).toHaveAttribute('data-cash', String(STARTING_CENTS - 400_000));
    await expect(card).toHaveAttribute('data-ok', 'no');
    await expect(card).toContainText(/^Stop \d+ stands within 250 m/);
    await page.keyboard.press('Control+z');
    await expect(panel).toHaveAttribute('data-cash', String(STARTING_CENTS));
    await expect(card).toHaveAttribute('data-ok', 'yes');
    await expect(card).toContainText('A Sign here');
  });

  test('Escape with the Build menu or a dropdown open closes only that menu', async ({ page }) => {
    await start(page, true);
    await build(page, 'Draw a line');
    const draft = page.getByTestId('draft-card');
    await clickAt(page, COPLEY);
    await clickAt(page, SYMPHONY);
    await expect(draft).toContainText('2 stops', { timeout: 10_000 });
    await page.getByRole('button', { name: 'Finance', exact: true }).click();
    const finance = page.getByTestId('finance');
    await expect(finance).toBeVisible();

    const menu = page.getByTestId('build-menu');
    await page.getByTestId('build').click();
    await expect(menu).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await expect(draft).toContainText('2 stops');
    await expect(finance).toBeVisible();

    await draft.getByRole('button', { name: 'Buses' }).click();
    const list = page.getByRole('listbox', { name: 'Buses' });
    await expect(list).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(list).toHaveCount(0);
    await expect(draft).toContainText('2 stops');
    await expect(finance).toBeVisible();

    // With no menu open, Escape puts the tool down and closes the panels, as before.
    await page.keyboard.press('Escape');
    await expect(draft).toHaveCount(0);
    await expect(finance).toHaveCount(0);
  });

  test('a press on the map outside an open menu only closes it: no stop, no depot and no draft stop; a press on a control still works it', async ({ page }) => {
    await start(page, false);
    const panel = page.getByTestId('sim-panel');
    const map = page.getByTestId('map');
    const menu = page.getByTestId('build-menu');
    const stops = async () => ((await map.getAttribute('data-stops')) ?? '').split(' ').filter(Boolean).length;

    // Each press lands clear of the menu it closes (the Build menu stands over the MFA and the largest parcel).
    const outside = async (box: { x: number; y: number; width: number; height: number } | null, at: [number, number]) => {
      const [x, y] = await toScreen(page, at);
      expect(box && x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height, `${at} under the menu`).toBe(false);
      await page.mouse.click(x, y);
    };

    // Place a stop: the press that closes the Build menu places none; the next press, at Copley, does.
    await build(page, 'Place a stop');
    await page.getByTestId('build').click();
    await expect(menu).toBeVisible();
    await outside(await menu.boundingBox(), SYMPHONY);
    await expect(menu).toHaveCount(0);
    await clickAt(page, COPLEY);
    await expect(panel).toHaveAttribute('data-cash', String(STARTING_CENTS - 400_000));
    await expect.poll(stops).toBe(1);
    await page.keyboard.press('Escape');

    // Place a depot: the press that closes the Build menu leaves the tool out and the land free.
    await build(page, 'Place a depot');
    await page.getByTestId('build').click();
    await expect(menu).toBeVisible();
    await outside(await menu.boundingBox(), onDepotLand(1));
    await expect(menu).toHaveCount(0);
    const [dx, dy] = await pointAt(page, onDepotLand(1));
    await expect(page.getByTestId('depot-card')).toHaveAttribute('data-ok', 'yes', { timeout: 10_000 });
    await page.mouse.click(dx, dy);
    await expect(panel).toHaveAttribute('data-cash', String(STARTING_CENTS - 400_000 - 15_000_000));

    // Draw a line: the press that closes the model dropdown adds no stop.
    await build(page, 'Draw a line');
    const draft = page.getByTestId('draft-card');
    await clickAt(page, SYMPHONY);
    await expect(draft).toContainText('1 stop', { timeout: 10_000 });
    await draft.getByRole('button', { name: 'Buses' }).click();
    const list = page.getByRole('listbox', { name: 'Buses' });
    await expect(list).toBeVisible();
    await outside(await list.boundingBox(), LONGWOOD);
    await expect(list).toHaveCount(0);
    await clickAt(page, COPLEY);
    await expect(draft).toContainText('2 stops', { timeout: 10_000 });
    await expect(draft).toHaveAttribute('data-refusal', '');
    // A double-click whose first press only closes the dropdown: its second click is a click of its own.
    await draft.getByRole('button', { name: 'Buses' }).click();
    await expect(list).toBeVisible();
    const box = await list.boundingBox();
    const [lx, ly] = await toScreen(page, LONGWOOD);
    expect(box && lx >= box.x && lx <= box.x + box.width && ly >= box.y && ly <= box.y + box.height, 'Longwood under the dropdown').toBe(false);
    await page.mouse.dblclick(lx, ly);
    await expect(list).toHaveCount(0);
    await expect(draft).toContainText('3 stops', { timeout: 10_000 });

    // A press on another control closes the menu and still works that control: Finance opens at once.
    await page.getByTestId('build').click();
    await expect(menu).toBeVisible();
    await page.getByRole('button', { name: 'Finance', exact: true }).click();
    await expect(menu).toHaveCount(0);
    await expect(page.getByTestId('finance')).toBeVisible();
  });
});
