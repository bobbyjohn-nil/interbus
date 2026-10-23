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
// The systems audit's fourth round: a held key presses once on every control, and a Create that brought no line
// opens no Lines for a game loaded later (each shown failing below).
import { expect, test, type Locator, type Page } from './base';
import { DEBUG_STOPS } from '../src/sim/commands/debugLine';
import { foundCompany, leaveHome, STARTING_CENTS } from './found';
import { build, city, frames, holdAnswers, onDepotLand, toScreen, withDebugLine, zoomOutOnce } from './shell';

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

  test('Found the company, a Build menu item, the Undo chip and Export work once on a double-click; a stop’s card closes with its stop; a double-click on a stop presses nothing on its card', async ({ page }) => {
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

    // A double-click on a stop whose card opens under the pointer (the systems audit's third round): its first click
    // opens the card, and its second, landing on the card's Take it down, presses nothing (onePress.ts).
    // Shown failing (TS-04) on 5f4bce3, where the stop came down for $2k back. The card is dragged by its
    // heading until Take it down sits over the stop, and opens there again, as a panel opens where it was
    // dragged to (at the top right, the map's bounds keep Longwood from coming under it).
    await page.keyboard.press('Escape');
    await openStop(page, 1);
    const [x, y] = await toScreen(page, (await map.getAttribute('data-stops'))!.split(':')[1]!.split(',').map(Number) as [number, number]);
    const takeDown = (await card.getByRole('button', { name: 'Take it down · $2k back' }).boundingBox())!;
    const heading = (await card.locator('h2').boundingBox())!;
    await page.mouse.move(heading.x + 10, heading.y + heading.height / 2);
    await page.mouse.down();
    await page.mouse.move(heading.x + 10 + x - takeDown.x - takeDown.width / 2, heading.y + heading.height / 2 + y - takeDown.y - takeDown.height / 2, { steps: 8 });
    await page.mouse.up();
    await card.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(card).toHaveCount(0);
    const before = await cash(page);
    await page.mouse.move(x, y);
    await page.mouse.down({ clickCount: 1 });
    await page.mouse.up({ clickCount: 1 });
    await expect(card).toBeVisible();
    expect(await page.evaluate(([px, py]) => document.elementFromPoint(px!, py!)?.closest('button')?.textContent, [x, y]), 'Take it down under the pointer').toBe('Take it down · $2k back');
    await page.waitForTimeout(150);
    await page.mouse.down({ clickCount: 2 });
    await page.mouse.up({ clickCount: 2 });
    await page.waitForTimeout(500);
    expect(await stopIds(page)).toEqual([1]);
    expect(await cash(page)).toBe(before);
    await expect(card.locator('h2')).toContainText('Stop 1 ·');
    await expect(undo).toHaveText('Undo: Place Stop 1');
    expect(refused).toEqual([]);
  });

  // The systems audit's second round: a double-click on a Home button that closes Home sent its second
  // press to the map behind it, which zoomed a step, and held still, flipped the board to 3D. The zoom
  // has stayed away since the one-press rule (#117); the held press was shown failing (TS-04) on
  // 7d5ca2b, where the board ended in 3D, its tilt gesture reading any second press as a double-click's.
  test('a double-click on a Home button acts once: the map behind it neither zooms a step nor, held, flips to 3D', async ({ page }) => {
    await page.goto('./?gpu=full'); // the held double-click tilts on the full rung only
    const map = page.getByTestId('map');
    const home = page.getByTestId('home');
    await expect(map).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(page);
    const backHome = async () => {
      await page.getByTestId('saves-chip').click();
      await page.getByRole('button', { name: 'Back to Home' }).click();
      await expect(home).toBeVisible();
    };
    await backHome();
    const view = (await map.getAttribute('data-view'))!;

    await doubleClick(page, page.getByTestId('home-continue'));
    await expect(home).toBeHidden();
    await page.waitForTimeout(1_000); // a zoom the double-click started would have ended by now
    await expect(map).toHaveAttribute('data-view', view);

    // The second press held still past the half second that flips the board.
    await backHome();
    const b = (await page.getByTestId('home-continue').boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down({ clickCount: 1 });
    await page.mouse.up({ clickCount: 1 });
    await page.mouse.down({ clickCount: 2 });
    await page.waitForTimeout(700);
    await page.mouse.up({ clickCount: 2 });
    await expect(home).toBeHidden();
    await page.waitForTimeout(500);
    await expect(map).toHaveAttribute('data-mode', '2d');
    await expect(map).toHaveAttribute('data-view', view);

    // Start a new game: the founding card, and the map where it was.
    await backHome();
    await home.getByRole('button', { name: 'New game' }).click();
    await doubleClick(page, home.getByRole('button', { name: 'Start a new game' }));
    await expect(page.getByTestId('founding-card')).toBeVisible();
    await page.waitForTimeout(1_000);
    await expect(map).toHaveAttribute('data-view', view);
  });

  // A held key acts once (DECISIONS 2026-10-15) on every control, not only Space on the page, the demand menu's Space and
  // the route editor's arrows: the browser pressed a focused button again at each repeat of Enter, and the demand menu's
  // Enter and a dropdown's list picked again at each repeat. One rule drops a repeat of Enter or Space on a control
  // (onePress.ts), which the demand menu's held Space now goes through too. A held key is sent as an OS sends it: a press,
  // then repeats 40 ms apart (Playwright sends a second down of a held key as a repeat). A repeat's command is sent as its
  // key goes down, so the commands sent are counted as the key comes up, with no wait. Shown failing (TS-04) on abb5f2f:
  // the step up sent 3 to 6 commands and the stop went on to a Station for $47k (data-tier 3); and with each check made soft,
  // Play sent 6 speed commands, Homes flipped 6 times on a held Enter, the speed list was open again after a held Space
  // and after a held Enter, which sent 3 speeds, and Export sent 6 exports. With the demand menu's own guard gone and the
  // rule taken off (onePress's keydown listener), its held Space flipped Homes 6 times.
  test('a held Enter or Space presses once: a stop’s step up, Play, an item of the demand menu, the speed list and Export this game', async ({ page }) => {
    test.setTimeout(90_000);
    // The commands the page sends the sim, by type.
    await page.addInitScript(() => {
      const w = window as unknown as { posted: Record<string, number> };
      w.posted = {};
      const post = Worker.prototype.postMessage;
      Worker.prototype.postMessage = function (this: Worker, message: unknown, options?: StructuredSerializeOptions) {
        const type = (message as { type?: unknown } | null)?.type;
        if (typeof type === 'string') w.posted[type] = (w.posted[type] ?? 0) + 1;
        post.call(this, message, options);
      } as typeof post;
    });
    const refused = refusals(page);
    await start(page, false);
    const panel = page.getByTestId('sim-panel');
    const posted = (type: string) => page.evaluate((t) => (window as unknown as { posted: Record<string, number> }).posted[t] ?? 0, type);
    /** Holds `key` down, then counts the `type` commands sent meanwhile. */
    const hold = async (key: 'Enter' | 'Space', type = 'speed') => {
      const before = await posted(type);
      await page.keyboard.down(key);
      for (let i = 0; i < 5; i++) {
        await page.waitForTimeout(40);
        await page.keyboard.down(key);
      }
      await page.keyboard.up(key);
      return (await posted(type)) - before;
    };

    // A stop's step up, focused: one Shelter for $12k, not a Station after it.
    await build(page, 'Place a stop');
    await clickAt(page, ON_HUNTINGTON);
    await expect.poll(() => stopIds(page)).toEqual([1]);
    await page.keyboard.press('Escape');
    await openStop(page, 1);
    const card = page.getByTestId('stop-card');
    const before = await cash(page);
    await card.getByRole('button', { name: 'Make it a Shelter · $12k' }).focus();
    expect(await hold('Enter', 'set-stop-tier'), 'step ups sent').toBe(1);
    await expect(card).toHaveAttribute('data-tier', '2');
    expect(await cash(page)).toBe(before - 1_200_000);
    await page.keyboard.press('Escape');

    // Play, focused: one speed command, and time plays.
    await page.getByTestId('play').focus();
    expect(await hold('Enter'), 'speeds sent').toBe(1);
    await expect(panel).toHaveAttribute('data-speed', '3');
    await page.getByRole('button', { name: 'Pause' }).click();
    await expect(panel).toHaveAttribute('data-speed', '0');

    // The demand menu, opened with the mouse: a held Enter turns Homes off once, and a held Space on once.
    await page.getByTestId('demand-chip').click();
    const homes = page.getByTestId('demand-menu').getByRole('menuitemcheckbox', { name: /Homes/ });
    await expect(homes).toBeFocused();
    await expect(homes).toHaveAttribute('aria-checked', 'true');
    await page.evaluate(() => {
      const w = window as unknown as { flips: number };
      w.flips = 0;
      new MutationObserver((records) => void (w.flips += records.length)).observe(document.querySelector('[data-testid="demand-menu"] [data-kind="home"]')!, { attributeFilter: ['aria-checked'] });
    });
    const flips = () => page.evaluate(() => (window as unknown as { flips: number }).flips);
    await hold('Enter');
    await expect(homes).toHaveAttribute('aria-checked', 'false');
    expect(await flips(), 'flips after a held Enter').toBe(1);
    await hold('Space');
    await expect(homes).toHaveAttribute('aria-checked', 'true');
    expect(await flips(), 'flips after a held Space').toBe(2);
    await expect(panel).toHaveAttribute('data-speed', '0');
    await page.keyboard.press('Escape');

    // The speed list, opened with the mouse: a held Space picks 60× once and leaves the list shut; a held Enter picks 600× once.
    const list = page.getByRole('listbox', { name: 'Speed' });
    for (const [move, key, speed] of [['ArrowUp', 'Space', '2'], ['ArrowDown', 'Enter', '3']] as const) {
      await page.getByTestId('speed-menu').click();
      await expect(list).toBeVisible();
      await page.keyboard.press(move);
      expect(await hold(key), `speeds sent, ${key} held`).toBe(1);
      await expect(list).toHaveCount(0);
      await expect(panel).toHaveAttribute('data-speed', speed);
      await page.getByRole('button', { name: 'Pause' }).click();
      await expect(panel).toHaveAttribute('data-speed', '0');
    }

    // Export this game, focused: one file.
    await page.getByTestId('saves-chip').click();
    await page.getByRole('button', { name: 'Export this game' }).focus();
    const download = page.waitForEvent('download');
    expect(await hold('Enter', 'export'), 'exports sent').toBe(1);
    await download;
    expect(refused).toEqual([]);
  });

  // App's flag for a Create on its way was let go only by a newer line, so a Create refused, or answered together with
  // its Undo, left it set, and a game imported later opened Lines on its newest line by itself, as if created. A load
  // lets it go too. Both cases in one test, each followed by an import of more lines than the game holds, so the shard
  // pays for one start and two imports. Shown failing (TS-04) on abb5f2f: Lines open after the undone Create's import,
  // and (with that check made soft) after the refused one's; and, the refused case run first, after its import.
  test('a Create refused, or answered together with its Undo, opens no Lines for a game imported after it', async ({ page }) => {
    test.setTimeout(90_000);
    await page.addInitScript(holdAnswers);
    await page.setViewportSize({ width: 1366, height: 768 });
    await start(page, true);
    const draft = page.getByTestId('draft-card');
    const create = draft.getByRole('button', { name: 'Create' });
    const inspector = page.getByTestId('inspector');
    /** Hands the worker's messages over `ms` apart from now on; returns how many it has handed over so far. */
    const apart = (ms: number) =>
      page.evaluate((m) => {
        const w = window as unknown as { apartMs: number; delivered: string[] };
        w.apartMs = m;
        return w.delivered.length;
      }, ms);
    // The undone Create on the new game, the refused one on the game imported after it: two lines, then three, so each
    // import holds more lines than the game before it, and buses the one depot has room for (six, with three lines).
    for (const [how, lines] of [['undone', 2], ['refused', 3]] as const) {
      await build(page, 'Draw a line');
      await clickAt(page, COPLEY);
      await clickAt(page, LONGWOOD);
      await expect(draft).toContainText('2 stops', { timeout: 10_000 });
      await expect(create).toBeEnabled();
      await page.evaluate(() => void ((window as unknown as { held: unknown[] }).held = []));
      if (how === 'refused') {
        // The card still shows two stops while the draft's answer is held: Create sends one, which the sim refuses.
        await draft.getByRole('button', { name: 'Remove last stop' }).click();
        await create.click();
      } else {
        await create.click();
        await page.keyboard.press('Control+z');
      }
      await expect.poll(() => page.evaluate((a) => (window as unknown as { held: [unknown, string][] }).held.some(([, type]) => type === a), how)).toBe(true);
      await page.evaluate(() => (window as unknown as { release: () => void }).release());
      await frames(page);
      await expect(inspector, `once the Create ${how} is answered`).toHaveCount(0);
      await page.keyboard.press('Escape');
      await expect(draft).toHaveCount(0);
      // A save of more lines than this game's, imported, its 'loaded' and its 'snapshot' rendered apart: it opens no panel.
      const from = await apart(30);
      await withDebugLine(page, (d) => {
        const [first] = d.lines as Record<string, unknown>[];
        d.lines = [first, ...Array.from({ length: lines - 1 }, (_, k) => ({ ...first, id: k + 2, name: `Line ${k + 2}`, stopIds: [k + 1, k + 2] }))];
        d.nextIds = { ...d.nextIds, line: lines + 1 };
      });
      await expect.poll(() => page.evaluate((k) => (window as unknown as { delivered: string[] }).delivered.slice(k).join(' '), from)).toMatch(/\bloaded\b.*\bsnapshot\b/);
      await frames(page);
      await expect(inspector, `after the import that follows a Create ${how}`).toHaveCount(0);
      await apart(0);
    }
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
    await doubleClick(page, card.getByRole('button', { name: 'Close', exact: true }));
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
    await expect(page.getByTestId('undo')).toHaveText('Undo: Take Stop 2 off Line 1');
    await page.waitForTimeout(500);
    await expect(page.getByTestId('undo')).toHaveText('Undo: Take Stop 2 off Line 1');
    expect(await cash(page)).toBe(before);
    expect(await stopIds(page)).toContain(2);
    await expect(card.getByRole('button', { name: 'Remove from Line 2 · $2k back' })).toBeVisible();
    expect(refused).toEqual([]);

    // Then off Line 2, its last line, with a double-click as quick as Playwright's: the stop comes down
    // once, for $2k back, and its card with it; no second remove refused as "That stop is gone".
    before = await cash(page);
    await card.getByRole('button', { name: 'Remove from Line 2 · $2k back' }).dblclick();
    await expect(page.getByTestId('undo')).toHaveText('Undo: Take Stop 2 off Line 2');
    await expect(card).toHaveCount(0);
    await page.waitForTimeout(500);
    expect(await cash(page)).toBe(before + 200_000);
    expect(refused).toEqual([]);
  });
});
