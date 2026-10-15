// Switching games (D26: systems that work; the systems audit's round 2, each finding reproduced by two
// agents before it counted). A game that takes this one's place, a new one or one loaded from a slot,
// a file or Restart this quarter, brings nothing of the old one on screen: no load notice of the game
// before on a new game's founding card, no bus that game has locked on the new-line card, and no stop's
// card or line inspector the player never opened in it. A panel dragged keeps its place across Back to
// Home and Continue, as for the rest of the page's session, and Lines closes when an undo takes back
// its only line. Shown failing (TS-04) on main before the fix (af5e75d): "Slot loaded" on the new
// game's founding card, "Goliath · … · locked" on the card after a slot and after a new game, Finance
// back at its free place, Lines left pressed and disabled with no panel, and Stop 3's card and Line 1's
// inspector open over the game the slot and the file brought.
import { expect, test, type Page } from '@playwright/test';
import { DEBUG_STOPS } from '../src/sim/commands/debugLine';
import { foundCompany, leaveHome, STARTING_CENTS } from './found';
import { build, city, onDepotLand, toScreen, withDebugLine, zoomOutOnce } from './shell';

async function start(page: Page, name?: string) {
  await page.goto('./');
  await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
  await foundCompany(page, name);
}

/** This game as a save file, edited by `edit`; Saves open. */
async function exported(page: Page, edit: (d: Record<string, unknown>) => void): Promise<string> {
  const download = page.waitForEvent('download');
  await page.getByTestId('saves').getByRole('button', { name: 'Export this game' }).click();
  const save = JSON.parse(Buffer.concat((await (await (await download).createReadStream()).toArray()) as Buffer[]).toString()) as { data: Record<string, unknown> };
  edit(save.data);
  return JSON.stringify(save);
}

/** Imports `text` from the open Saves panel over the founded company and waits for it to become the game. */
async function imported(page: Page, text: string) {
  const chooser = page.waitForEvent('filechooser');
  await page.getByTestId('saves').getByRole('button', { name: 'Import a save file' }).click();
  await page.getByTestId('saves').getByRole('button', { name: 'Replace this game' }).click();
  await (await chooser).setFiles({ name: 'game.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await expect(page.getByTestId('notice')).toContainText('Save file loaded');
}

async function newGame(page: Page) {
  await page.getByTestId('saves').getByRole('button', { name: 'Back to Home' }).click();
  const home = page.getByTestId('home');
  await home.getByRole('button', { name: 'New game' }).click();
  await home.getByRole('button', { name: 'Start a new game' }).click();
  await expect(page.getByTestId('founding-card')).toBeVisible();
}

test.describe('switching games', () => {
  test.skip(!city.sim, 'no sim file in this build yet');

  test('a new game shows no load notice of the game before', async ({ page }) => {
    await start(page);
    await page.getByTestId('saves-chip').click();
    const slot = page.getByTestId('slot-1');
    await slot.getByRole('button', { name: 'Save here' }).click();
    await slot.getByRole('button', { name: 'Load' }).click();
    await slot.getByRole('button', { name: 'Replace this game' }).click();
    const notice = page.getByTestId('notice');
    await expect(notice).toContainText('Slot loaded');
    // Straight away, inside the notice's six seconds: the founding card of an unnamed company, which nothing was loaded into.
    await newGame(page);
    expect(await notice.allTextContents()).toEqual([]);
  });

  test('starts the new-line card on the Sparrow after a load and in a new game, never on a bus that game has locked', async ({ page }) => {
    test.setTimeout(90_000);
    await start(page);
    await page.getByTestId('saves-chip').click();
    const slot = page.getByTestId('slot-1');
    await slot.getByRole('button', { name: 'Save here' }).click(); // no medal
    const silver = await exported(page, (d) => void (d.medals = { bronze: 1, silver: 1, gold: null }));
    const draft = page.getByTestId('draft-card');
    const buses = page.getByTestId('draft-model');
    // The game with silver, which puts the Goliath on sale, and the Goliath picked on the new-line card.
    const pickGoliath = async () => {
      await imported(page, silver);
      await build(page, 'Draw a line');
      await buses.click();
      await page.getByRole('option', { name: /^Goliath/ }).click();
      await expect(buses).toContainText('Goliath');
      await draft.getByRole('button', { name: 'Cancel' }).click();
    };
    const offered = async () => {
      await build(page, 'Draw a line');
      const text = await buses.textContent();
      await draft.getByRole('button', { name: 'Cancel' }).click();
      return text;
    };
    await pickGoliath();
    await slot.getByRole('button', { name: 'Load' }).click();
    await slot.getByRole('button', { name: 'Replace this game' }).click();
    await expect(page.getByTestId('notice')).toContainText('Slot loaded');
    expect.soft(await offered()).toMatch(/^Sparrow · \d+ seats · \$\S+$/);
    await pickGoliath();
    await newGame(page);
    await foundCompany(page, 'Second Co');
    expect.soft(await offered()).toMatch(/^Sparrow · \d+ seats · \$\S+$/);
  });

  test('keeps a dragged panel’s place across Back to Home and Continue', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await start(page);
    const finance = page.getByTestId('finance');
    const dockFinance = page.getByRole('button', { name: 'Finance', exact: true });
    await dockFinance.click();
    const from = (await finance.boundingBox())!;
    const h = (await finance.getByRole('heading', { name: 'Finance' }).boundingBox())!;
    await page.mouse.move(h.x + 10, h.y + h.height / 2);
    await page.mouse.down();
    await page.mouse.move(h.x + 10 - 300, h.y + h.height / 2 + 200, { steps: 8 });
    await page.mouse.up();
    const to = (await finance.boundingBox())!;
    expect([Math.round(to.x - from.x), Math.round(to.y - from.y)]).toEqual([-300, 200]);
    await dockFinance.click();
    await expect(finance).toHaveCount(0);
    await page.getByTestId('saves-chip').click();
    await page.getByRole('button', { name: 'Back to Home' }).click();
    await leaveHome(page, 'continue');
    await dockFinance.click();
    const again = (await finance.boundingBox())!;
    expect([again.x, again.y]).toEqual([to.x, to.y]);
  });

  test('closes Lines when an undo takes back the only line, so the dock shows it neither open nor pressed', async ({ page }) => {
    await page.setViewportSize({ width: 1152, height: 720 });
    await start(page);
    await zoomOutOnce(page);
    await build(page, 'Place a depot');
    const [dx, dy] = await toScreen(page, onDepotLand());
    await page.mouse.click(dx, dy);
    await expect(page.getByTestId('sim-panel')).toHaveAttribute('data-cash', String(STARTING_CENTS - 15_000_000));
    await build(page, 'Draw a line');
    for (const stop of DEBUG_STOPS.slice(0, 2)) {
      const [x, y] = await toScreen(page, stop.at);
      await page.mouse.click(x, y);
    }
    const draft = page.getByTestId('draft-card');
    await expect(draft).toContainText('2 stops');
    await draft.getByRole('button', { name: 'Create' }).click();
    const inspector = page.getByTestId('inspector');
    const lines = page.locator('.dock').getByRole('button', { name: 'Lines', exact: true });
    await expect(inspector).toBeVisible();
    await expect(lines).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('undo')).toHaveText('Undo: Create Line 1');
    await page.getByTestId('undo').click();
    await expect(inspector).toHaveCount(0);
    await expect(lines).toHaveAttribute('aria-pressed', 'false');
    await expect(lines).toBeDisabled();
    await expect(page.locator('[data-movable="lines"]')).toHaveCount(0);
  });

  test('closes a stop’s card and the line inspector when a slot or a file brings a game with that stop and line', async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1366, height: 768 });
    await start(page);
    await zoomOutOnce(page);
    await withDebugLine(page);
    const stopCard = page.getByTestId('stop-card');
    const inspector = page.getByTestId('inspector');
    const openBoth = async () => {
      const [x, y] = await toScreen(page, DEBUG_STOPS[2]!.at);
      await page.mouse.click(x, y);
      await expect(stopCard).toHaveAttribute('aria-label', 'Stop 3');
      if (!(await inspector.isVisible())) await page.locator('.dock').getByRole('button', { name: 'Lines', exact: true }).click();
      await expect(inspector).toBeVisible();
    };
    // Slot 1 holds this game; Stop 3's card and Line 1's inspector are opened, then the slot loads.
    await page.getByTestId('saves-chip').click();
    const saves = page.getByTestId('saves');
    const slot = page.getByTestId('slot-1');
    await slot.getByRole('button', { name: 'Save here' }).click();
    await saves.getByRole('button', { name: 'Close' }).click();
    await openBoth();
    await page.getByTestId('saves-chip').click();
    await slot.getByRole('button', { name: 'Load' }).click();
    await slot.getByRole('button', { name: 'Replace this game' }).click();
    await expect(page.getByTestId('notice')).toContainText('Slot loaded');
    await expect.soft(stopCard).toHaveCount(0);
    await expect.soft(inspector).toHaveCount(0);
    await expect(saves).toBeVisible();
    // The same with a save file.
    await saves.getByRole('button', { name: 'Close' }).click();
    await openBoth();
    await withDebugLine(page);
    await expect(stopCard).toHaveCount(0);
    await expect(inspector).toHaveCount(0);
  });
});
