// One press, one command (D26, the systems audit's second round): a double-click on any button does what
// the button says once, its second click going nowhere, wherever it lands once the first press has
// changed what is under the pointer (onePress.ts); Create waits for its own answer; and a stop's card
// closes with its stop, so it never opens again for a stop that takes its id later.
// Shown failing (TS-04) on 2a00661, each check reached by cutting the double-clicks before it: Create's
// second click reached the line's card that took its place (2 clicks heard, not 1), and held back, the
// second click and a press of its own bought Lines 3 and 4 ("Undo: Create Line 4"); Found the company
// refused as already_founded; a $4k stop where the Build menu stood; the Undo chip took back both stops;
// the card open again on Longwood's stop; Place a depot refused as not_depot_land where the menu stood;
// Draw a line's card opened holding a stop; Export this game downloaded two files; Take it refused as
// already_held; the step up refused as same_tier; the step down's second click took the stop down;
// Close's tried to place a stop (no_street_near); Remove from Line 1's took the stop off Line 2 too
// ("Undo: Remove Stop 2 from Line 2"), or with the sim slower to answer was refused as not_on_line; and
// the quick double-click's second remove was refused as no_such_stop.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { DEBUG_STOPS } from '../src/sim/commands/debugLine';
import { foundCompany, leaveHome, STARTING_CENTS } from './found';
import { build, city, onDepotLand, toScreen, withDebugLine, zoomOutOnce } from './shell';

/** On Huntington Avenue between Symphony and the MFA, more than 250 m from each. */
const ON_HUNTINGTON: [number, number] = [-71.0903, 42.33995];
const KENMORE: [number, number] = [-71.09721, 42.34883];
const [COPLEY, SYMPHONY, MFA, LONGWOOD] = DEBUG_STOPS.map((s) => s.at) as [[number, number], [number, number], [number, number], [number, number]];

async function clickAt(page: Page, at: [number, number]) {
  const [x, y] = await toScreen(page, at);
  await page.mouse.click(x, y);
}

/** A double-click as a person makes one: the second press 150 ms after the first on the same spot, where the first press's command has landed and changed what is there. */
async function doubleClick(page: Page, target: Locator) {
  await target.click({ trial: true }); // where it has come to rest, as a panel places itself
  const box = (await target.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down({ clickCount: 1 });
  await page.mouse.up({ clickCount: 1 });
  await page.waitForTimeout(150);
  await page.mouse.down({ clickCount: 2 });
  await page.mouse.up({ clickCount: 2 });
}

/** Every command the sim refuses, as the error bus logs it to the console. */
function refusals(page: Page): string[] {
  const seen: string[] = [];
  page.on('console', (m) => void (m.text().includes('[sim/refused-') && seen.push(m.text())));
  return seen;
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

/** Clicks stop `id` once the map has drawn it, and its card opens. */
async function openStop(page: Page, id: number) {
  const placed = (await page.getByTestId('map').getAttribute('data-stops'))!.split(' ').map((s) => s.split(/[:,]/).map(Number) as [number, number, number]);
  const stop = placed.find((s) => s[0] === id)!;
  const [x, y] = await toScreen(page, [stop[1], stop[2]]);
  await expect(async () => {
    await page.mouse.click(x, y);
    await expect(page.getByTestId('stop-card')).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 10_000 });
  await expect(page.getByTestId('stop-card').locator('h2')).toContainText(`Stop ${id} ·`);
}

const cash = async (page: Page) => Number(await page.getByTestId('sim-panel').getAttribute('data-cash'));
const stopIds = async (page: Page) => (await page.getByTestId('map').getAttribute('data-stops'))!.split(' ').filter(Boolean).map((s) => Number(s.split(':')[0]));

test.describe('one press, one command', () => {
  test.skip(!city.sim, 'no sim file in this build yet');

  test('Create buys one line a press: a double-click, a press of its own before the line lands and a refresh of the lines meanwhile send one create-line', async ({ page }) => {
    // The sim's answer to Create held back when a check says, as slowly as a large city's recompute can
    // give it (up to I14's 150 ms budget, and beyond on a slow machine); and the worker kept, so a check
    // can refresh the lines before the answer, as the day's close or roadworks retime them.
    await page.addInitScript(() => {
      const w = window as unknown as { createHeldMs: number; simWorker: Worker | null; linesVersion: number };
      w.createHeldMs = 0;
      w.linesVersion = 0;
      const post = Worker.prototype.postMessage;
      Worker.prototype.postMessage = function (this: Worker, message: unknown, options?: StructuredSerializeOptions) {
        // The sim's worker, pinned by its first message (MapLibre's tile workers post through the same prototype).
        if ((message as { type?: string } | null)?.type === 'init' && w.simWorker !== this) {
          w.simWorker = this;
          this.addEventListener('message', (e: MessageEvent<{ type?: string; snapshot?: { linesVersion: number } }>) => void (e.data.type === 'snapshot' && (w.linesVersion = e.data.snapshot!.linesVersion)));
        }
        if ((message as { type?: string } | null)?.type === 'create-line' && w.createHeldMs > 0) window.setTimeout(() => post.call(this, message, options), w.createHeldMs);
        else post.call(this, message, options);
      } as typeof post;
    });
    const refused = refusals(page);
    await start(page, true);
    const draft = page.getByTestId('draft-card');
    const create = draft.getByRole('button', { name: 'Create' });
    // The clicks that reach the page: a dropped one never does.
    await page.evaluate(() => {
      const w = window as unknown as { heard: number };
      w.heard = 0;
      document.addEventListener('click', () => void w.heard++);
    });
    const heard = () => page.evaluate(() => (window as unknown as { heard: number }).heard);

    // As fast as the fixture answers: the card closes before the second click, which lands on the line's
    // card that took its place and clicks nothing.
    await build(page, 'Draw a line');
    await clickAt(page, COPLEY);
    await clickAt(page, SYMPHONY);
    await expect(draft).toHaveAttribute('data-price', '10300000', { timeout: 10_000 });
    let before = await heard();
    await doubleClick(page, create);
    await expect(page.getByTestId('line-card')).toHaveAttribute('data-line', '1', { timeout: 10_000 });
    await page.waitForTimeout(500);
    await expect(page.getByTestId('undo')).toHaveText('Undo: Create Line 1');
    expect(await cash(page)).toBe(STARTING_CENTS - 15_000_000 - 10_300_000);
    expect((await heard()) - before).toBe(1);

    // Held back: the double-click's second click, then a refresh of the lines (a fare set, the lines
    // retimed) and a press of its own, all before the line lands.
    await build(page, 'Draw a line');
    await clickAt(page, MFA);
    await clickAt(page, LONGWOOD);
    await expect(draft).toContainText('2 stops', { timeout: 10_000 });
    await expect(draft).toHaveAttribute('data-refusal', '');
    const price = Number(await draft.getAttribute('data-price'));
    before = await cash(page);
    await page.evaluate(() => void ((window as unknown as { createHeldMs: number }).createHeldMs = 1_000));
    await doubleClick(page, create);
    const version = await page.evaluate(() => (window as unknown as { linesVersion: number }).linesVersion);
    await page.evaluate(() => (window as unknown as { simWorker: Worker }).simWorker.postMessage({ type: 'set-fare', lineId: 1, fareCents: 250 }));
    await expect.poll(() => page.evaluate(() => (window as unknown as { linesVersion: number }).linesVersion)).toBeGreaterThan(version);
    await page.mouse.down({ clickCount: 1 });
    await page.mouse.up({ clickCount: 1 });
    await expect(page.getByTestId('line-card')).toHaveAttribute('data-line', '2', { timeout: 10_000 });
    await page.waitForTimeout(1_500);
    await expect(page.getByTestId('undo')).toHaveText('Undo: Create Line 2');
    expect(await cash(page)).toBe(before - price);
    expect(refused).toEqual([]);
  });

  test('Found the company, a Build menu item, the Undo chip and Export work once on a double-click; a stop’s card closes with its stop', async ({ page }) => {
    const refused = refusals(page);
    const panel = page.getByTestId('sim-panel');
    const map = page.getByTestId('map');
    const menu = page.getByTestId('build-menu');
    await page.goto('./');
    await expect(map).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await leaveHome(page);
    const founding = page.getByTestId('founding-card');
    await founding.getByLabel('Name').fill('Back Bay Transit');
    await founding.getByRole('button', { name: 'Found the company', exact: true }).dblclick();
    await expect(founding).toBeHidden();
    await page.waitForTimeout(500);
    expect(refused).toEqual([]);
    await zoomOutOnce(page);

    // Place a stop: no stop where the menu stood, and no zoom; the next click on the map places one.
    const zoom = (await map.getAttribute('data-view'))!.split(',')[2];
    await page.getByTestId('build').click();
    await doubleClick(page, menu.getByRole('button', { name: 'Place a stop' }));
    await expect(menu).toHaveCount(0);
    await page.waitForTimeout(500);
    await expect(panel).toHaveAttribute('data-cash', String(STARTING_CENTS));
    await expect(map).toHaveAttribute('data-stops', '');
    expect((await map.getAttribute('data-view'))!.split(',')[2]).toBe(zoom);
    await clickAt(page, ON_HUNTINGTON);
    await expect(panel).toHaveAttribute('data-cash', String(STARTING_CENTS - 400_000));
    await clickAt(page, LONGWOOD);
    await expect(panel).toHaveAttribute('data-cash', String(STARTING_CENTS - 800_000));
    await page.keyboard.press('Escape');

    // The Undo chip, paused, after two purchases: one taken back, not two.
    const undo = page.getByTestId('undo');
    await expect(undo).toHaveText('Undo: Place Stop 2');
    await doubleClick(page, undo);
    await expect(undo).toHaveText('Undo: Place Stop 1');
    await page.waitForTimeout(500);
    await expect(panel).toHaveAttribute('data-cash', String(STARTING_CENTS - 400_000));
    expect(await stopIds(page)).toEqual([1]);

    // Stop 1's card closes with it, undone; Longwood's stop then takes id 1 again and opens no card.
    await openStop(page, 1);
    const card = page.getByTestId('stop-card');
    await undo.click();
    await expect(panel).toHaveAttribute('data-cash', String(STARTING_CENTS));
    await expect(card).toHaveCount(0);
    await build(page, 'Place a stop');
    await clickAt(page, LONGWOOD);
    await expect(panel).toHaveAttribute('data-cash', String(STARTING_CENTS - 400_000));
    await expect(map).toHaveAttribute('data-stops', /^1:/);
    await expect(card).toHaveCount(0);
    await expect(page.locator('[data-movable="stop"]')).toHaveCount(0);

    // Place a depot: none bought or refused where the menu stood.
    await page.getByTestId('build').click();
    await doubleClick(page, menu.getByRole('button', { name: 'Place a depot' }));
    await expect(menu).toHaveCount(0);
    await page.waitForTimeout(500);
    await expect(panel).toHaveAttribute('data-cash', String(STARTING_CENTS - 400_000));
    expect(refused).toEqual([]);

    // Draw a line: its card opens with no stop in it, and the next click is its first.
    await page.getByTestId('build').click();
    await doubleClick(page, menu.getByRole('button', { name: 'Draw a line' }));
    const draft = page.getByTestId('draft-card');
    await expect(draft).toBeVisible();
    await page.waitForTimeout(500);
    await expect(draft).toContainText('Click the map to place stops');
    await clickAt(page, COPLEY);
    await expect(draft).toContainText('1 stop', { timeout: 10_000 });
    await page.keyboard.press('Escape');

    // Export this game in Saves: one file, though its download is a click the page makes itself.
    const downloads: string[] = [];
    page.on('download', (d) => void downloads.push(d.suggestedFilename()));
    await page.getByTestId('saves-chip').click();
    await doubleClick(page, page.getByRole('button', { name: 'Export this game' }));
    await page.waitForTimeout(1_000);
    expect(downloads).toHaveLength(1);
  });

  test('Take it and a stop card’s buttons work once on a double-click: one step up, one step down, Close places nothing, off Line 1 and still on Line 2', async ({ page }) => {
    test.setTimeout(90_000);
    const refused = refusals(page);
    await page.goto('./');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(page);
    await zoomOutOnce(page);
    await withDebugLine(page);

    await page.getByTestId('checklist').click();
    const offer = page.getByTestId('contract').first();
    await offer.getByRole('button', { name: 'Take it' }).dblclick();
    await expect(offer).toHaveAttribute('data-held', 'yes');
    await page.waitForTimeout(500);
    await expect(page.locator('[data-testid="contract"][data-held="yes"]')).toHaveCount(1);
    expect(refused).toEqual([]);
    await page.keyboard.press('Escape');

    // A stop of its own, Stop 5: up to a Shelter, not refused as one already; then down from a Station
    // to a Shelter, and not taken down by the second click, under which Take it down has slid up.
    const card = page.getByTestId('stop-card');
    await build(page, 'Place a stop');
    let before = await cash(page);
    await clickAt(page, ON_HUNTINGTON);
    await expect.poll(() => cash(page)).toBe(before - 400_000);
    await page.keyboard.press('Escape');
    await openStop(page, 5);
    before = await cash(page);
    await card.getByRole('button', { name: 'Make it a Shelter · $12k' }).dblclick();
    await expect(card).toHaveAttribute('data-tier', '2');
    await card.getByRole('button', { name: 'Make it a Station · $35k' }).click();
    await expect(card).toHaveAttribute('data-tier', '3');
    expect(refused).toEqual([]);
    await doubleClick(page, card.getByRole('button', { name: 'Make it a Shelter · $17.5k back' }));
    await expect(card).toHaveAttribute('data-tier', '2');
    await page.waitForTimeout(500);
    await expect(card).toHaveAttribute('data-tier', '2');
    expect(await cash(page)).toBe(before - 1_200_000 - 3_500_000 + 1_750_000);

    // Close, with Place a stop out: the card closes, and no stop goes where it stood.
    await build(page, 'Place a stop');
    before = await cash(page);
    const stops = await stopIds(page);
    await doubleClick(page, card.getByRole('button', { name: 'Close' }));
    await expect(card).toHaveCount(0);
    await page.waitForTimeout(500);
    expect(await cash(page)).toBe(before);
    expect(await stopIds(page)).toEqual(stops);
    expect(refused).toEqual([]);
    await page.keyboard.press('Escape');

    // Symphony on two lines: Line 2 from Kenmore through Symphony to Stop 5. Off Line 1 once, and still
    // on Line 2, with no money moved, though Line 2's row slides up under the second click.
    await build(page, 'Draw a line');
    const draft = page.getByTestId('draft-card');
    for (const at of [KENMORE, SYMPHONY, ON_HUNTINGTON]) await clickAt(page, at);
    await expect(draft).toContainText('3 stops', { timeout: 10_000 });
    await expect(draft).toHaveAttribute('data-refusal', '');
    await draft.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByTestId('line-card')).toHaveAttribute('data-line', '2', { timeout: 10_000 });
    await page.keyboard.press('Escape');
    await openStop(page, 2);
    before = await cash(page);
    await doubleClick(page, card.getByRole('button', { name: 'Remove from Line 1', exact: true }));
    await expect(page.getByTestId('undo')).toHaveText('Undo: Remove Stop 2 from Line 1');
    await page.waitForTimeout(500);
    await expect(page.getByTestId('undo')).toHaveText('Undo: Remove Stop 2 from Line 1');
    expect(await cash(page)).toBe(before);
    expect(await stopIds(page)).toContain(2);
    await expect(card.getByRole('button', { name: 'Remove from Line 2 · $2k back' })).toBeVisible();
    expect(refused).toEqual([]);

    // Then off Line 2, its last line, with a double-click as quick as Playwright's: the stop comes down
    // once, for $2k back, and its card with it; no second remove refused as "That stop is gone".
    before = await cash(page);
    await card.getByRole('button', { name: 'Remove from Line 2 · $2k back' }).dblclick();
    await expect(page.getByTestId('undo')).toHaveText('Undo: Remove Stop 2 from Line 2');
    await expect(card).toHaveCount(0);
    await page.waitForTimeout(500);
    expect(await cash(page)).toBe(before + 200_000);
    expect(refused).toEqual([]);
  });
});
