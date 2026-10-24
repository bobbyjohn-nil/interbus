import { expect, test, type Locator, type Page, type Route } from './base';
import { copyProblems } from '../src/ui/copyRules';
import { foundCompany, leaveHome, STARTING_CENTS } from './found';
import { build, city, onDepotLand, pointAt, setSpeed, withDebugLine, zoomOutOnce } from './shell';

// The error bus is installed at boot (V3 never registered a sink, so its reports reached only the
// console, S07): an uncaught error anywhere on the page lands on the bus as ui/uncaught.
test('an uncaught error on the page reaches the error bus', async ({ page }) => {
  const warnings: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'warning') warnings.push(m.text());
  });
  await page.goto('./');
  await expect(page.getByTestId('build-chip')).toBeVisible();
  await page.evaluate(() => {
    setTimeout(() => {
      throw new Error('probe from e2e/errors.spec.ts');
    });
  });
  await expect.poll(() => warnings.some((w) => w.startsWith('[ui/uncaught]'))).toBe(true);
});

// A sim file unread for a reason other than a newer build (a server error, a dropped connection) says
// so in one card with Reload, never a blank map with no Home (D12, amended 2026-10-15: the failure card
// beside the replaced-build card, which stays for files that are gone; swap.spec.ts). Shown failing
// (TS-04) on main before the fix (af5e75d), where the screen held only the map and its credits.
for (const [what, fail] of [
  ['a server error', (r: Route) => r.fulfill({ status: 500, body: 'Internal Server Error' })],
  ['a dropped connection', (r: Route) => r.abort('internetdisconnected')],
] as const) {
  test(`a sim file unread for ${what} shows one card with Reload, which brings the game back`, async ({ page }) => {
    test.skip(!city.sim, 'no sim file in this build yet');
    const sim = `**/cities/${city.sim!.file}`;
    await page.route(sim, fail);
    await page.goto('./');
    const card = page.getByTestId('failed-card');
    await expect(card).toBeVisible({ timeout: 30_000 });
    await expect(card).toHaveText('Boston couldn’t be loadedReload');
    await expect(page.getByTestId('replaced-card')).toHaveCount(0);
    await expect(page.getByTestId('home')).toHaveCount(0);
    await page.unroute(sim);
    await card.getByRole('button', { name: 'Reload' }).click();
    await expect(page.getByTestId('home')).toBeVisible({ timeout: 30_000 });
    await expect(card).toHaveCount(0);
  });
}

// A dropped connection fails both of the city's files: the game's own card says so, alone, with its one Reload; the map adds no
// card of its own beside it (D12). Shown failing (TS-04) on the lane's first fix, where the map's card stood under the game's
// with a second Reload.
test('a connection dropped for both city files shows the game’s card alone', async ({ page }) => {
  test.skip(!city.sim, 'no sim file in this build yet');
  test.setTimeout(90_000);
  await page.route('**/cities/*', (r) => r.abort('internetdisconnected'));
  await page.goto('./');
  await expect(page.getByTestId('failed-card')).toHaveText('Boston couldn’t be loadedReload', { timeout: 30_000 });
  await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'failed', { timeout: 30_000 });
  await expect(page.locator('.map-notice')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reload' })).toHaveCount(1);
});

/** Whether nothing covers `card` at its two ends and its middle: elementFromPoint finds it there. */
const inFront = (card: Locator) =>
  card.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return [r.left + 4, r.left + r.width / 2, r.right - 4].every((x) => el.contains(document.elementFromPoint(x, r.top + r.height / 2)));
  });

// The city's map file unread for a reason other than a newer build (a server error, a dropped connection; a mount error and
// the load's timeout end the same way) says so in one card high on the board, in front of Home and then of the founding card,
// with Reload, in words true of every such cause. Shown failing (TS-04) on abb5f2f, where its words sat centred under Home's
// card and then the founding card, with no Reload, and said the map "could not start on this computer".
for (const [what, fail] of [
  ['a server error', (r: Route) => r.fulfill({ status: 500, body: 'Internal Server Error' })],
  ['a dropped connection', (r: Route) => r.abort('internetdisconnected')],
] as const) {
  test(`a map file unread for ${what} says so in front of Home and the founding card, with Reload, which brings the map back`, async ({ page }) => {
    test.skip(!city.sim, 'no sim file in this build yet');
    test.setTimeout(90_000);
    const tiles = '**/cities/*.pmtiles';
    await page.route(tiles, fail);
    await page.goto('./');
    const map = page.getByTestId('map');
    await expect(map).toHaveAttribute('data-status', 'failed', { timeout: 30_000 });
    const home = page.getByTestId('home');
    await expect(home).toBeVisible({ timeout: 30_000 });
    const card = map.locator('.map-notice');
    await expect(card).toBeVisible();
    expect(await inFront(card), 'the card in front of Home').toBe(true);
    await expect(card.getByRole('button', { name: 'Reload' })).toHaveCount(1);
    await expect(card).toHaveText('Boston’s map couldn’t be loaded.Reload');
    expect(copyProblems(await card.locator('p, button').allInnerTexts())).toEqual([]);
    await leaveHome(page);
    await expect(page.getByTestId('founding-card')).toBeVisible();
    expect(await inFront(card), 'the card in front of the founding card').toBe(true);
    await page.unroute(tiles);
    await card.getByRole('button', { name: 'Reload' }).click();
    await expect(map).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await expect(home).toBeVisible({ timeout: 30_000 });
    await expect(card).toHaveCount(0);
  });
}

/** Site data blocked, for page.addInitScript: the localStorage and sessionStorage getters throw a SecurityError, as a browser
 * blocking the site's data throws from both (the review of #161), and as e2e/gpu.spec.ts has it. */
function blockStorage(): void {
  for (const name of ['localStorage', 'sessionStorage'])
    Object.defineProperty(window, name, {
      configurable: true,
      get() {
        throw new DOMException('The operation is insecure.', 'SecurityError');
      },
    });
}

// The systems audit's seventh round: while the game isn't saving itself (here blocked site data, so a reload loses the whole
// company), the map's card that cannot start and the replaced build's card offered Reload alone, as the lost card did before
// the fifth round. They say so now, and offer Export this game before Reload, which hands the game over as a file. Shown failing
// (TS-04) on a5c0ccd, where each said only that the map couldn't be loaded, or that the build was replaced, beside Reload.
test('with blocked site data, the map card that cannot start and the replaced build’s card say the game isn’t saving itself, with Export this game before Reload', async ({ page }) => {
  test.skip(!city.sim, 'no sim file in this build yet');
  test.setTimeout(90_000);
  await page.addInitScript(blockStorage);
  await page.route('**/cities/*.pmtiles', (r) => r.fulfill({ status: 500, body: 'Internal Server Error' }));
  await page.goto('./');
  const map = page.getByTestId('map');
  await expect(map).toHaveAttribute('data-status', 'failed', { timeout: 30_000 });
  await foundCompany(page);
  await expect(page.getByTestId('saves-chip')).toHaveText('Autosave off');
  const card = page.getByTestId('map-card');
  await expect(card).toHaveText('Boston’s map couldn’t be loaded. This game isn’t saving itself: export it before you reload.Export this gameReload');
  expect(copyProblems(await card.locator('p, button').allInnerTexts())).toEqual([]);
  const download = page.waitForEvent('download');
  await card.getByRole('button', { name: 'Export this game' }).click();
  expect((await download).suggestedFilename()).toBe('interbus-boston-year-1-q1-day-1.json');
  // Day 1 closes, its card waiting for an answer at the board's top; then a lazy chunk of this build is gone (Vite's
  // preloadError). The replaced build's card, the map's own card gone, says the same, its words over its buttons, at the
  // board's foot while the day card is up, so neither hides the other. Shown failing (TS-04) with the card at the top, where
  // it hid the day card's heading (the review of the seventh round's fixes).
  await setSpeed(page, '5,400×');
  const dayCard = page.getByTestId('day-card');
  await expect(dayCard).toBeVisible({ timeout: 30_000 });
  await page.evaluate(() => window.dispatchEvent(new Event('vite:preloadError', { cancelable: true })));
  const replaced = page.getByTestId('replaced-card');
  await expect(replaced).toHaveText('This build was replaced. This game isn’t saving itself: export it before you reload.Export this gameReload');
  await expect(replaced).toHaveAccessibleName('This build was replaced. This game isn’t saving itself: export it before you reload.');
  await expect(card).toHaveCount(0);
  expect({ card: await inFront(replaced), heading: await inFront(dayCard.locator('h2')), continue: await inFront(dayCard.getByRole('button', { name: 'Continue' })) }).toEqual({ card: true, heading: true, continue: true });
  const again = page.waitForEvent('download');
  await replaced.getByRole('button', { name: 'Export this game' }).click();
  expect((await again).suggestedFilename()).toMatch(/^interbus-boston-year-\d+-q[1-4]-day-\d+\.json$/);
});

/** The chips a card lies over the middle of: the top bar's, and the Saves chip. */
const chipsCovered = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('[data-testid="sim-panel"] > *, [data-testid="saves-chip"]')].flatMap((chip) => {
      const r = chip.getBoundingClientRect();
      if (!r.width) return [];
      return chip.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)) ? [] : [chip.textContent ?? ''];
    }),
  );

// The replaced build's card stood at the board's top over the chips' middle: the floor's countdown at 1366×768 and 1440×900,
// Costs/day too at 1152×720, and the checklist with no countdown; saying the game isn't saving itself, Riders/day and the
// Contracts chip as well (the systems audit's fourteenth round). It stands under them now, where the map's own cards do. Shown
// failing (TS-04) with the card at the top: at 1152×720 it lay over Costs/day and the countdown, and saying the game isn't
// saving itself, over Riders/day and the checklist.
for (const blocked of [false, true]) {
  test(`the replaced build’s card leaves every chip in sight at I13’s three sizes${blocked ? ', saying the game isn’t saving itself' : ', the floor’s countdown among them'}`, async ({ page }) => {
    test.skip(!city.sim, 'no sim file in this build yet');
    test.setTimeout(90_000);
    if (blocked) await page.addInitScript(blockStorage);
    await page.goto('./');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(page);
    if (blocked) await expect(page.getByTestId('saves-chip')).toHaveText('Autosave off');
    else {
      // Owing $1m more on day 2, a close below the floor behind it.
      await withDebugLine(page, (d) => {
        d.ledger.push({ day: 2, kind: 'buses', amountCents: -100_000_000, lineId: null });
        d.closesBelowFloor = 1;
      });
      await expect(page.getByTestId('countdown')).toHaveText('4 days to get above -$150k');
    }
    await page.evaluate(() => window.dispatchEvent(new Event('vite:preloadError', { cancelable: true })));
    const replaced = page.getByTestId('replaced-card');
    await expect(replaced).toBeVisible();
    for (const [width, height] of [[1152, 720], [1366, 768], [1440, 900]] as const) {
      await page.setViewportSize({ width, height });
      expect(await chipsCovered(page), `at ${width}×${height}`).toEqual([]);
      expect(await inFront(replaced), `at ${width}×${height}`).toBe(true);
    }
  });
}

// The systems audit's seventh round: the map's card that cannot start stays up while the game plays on without a map, high on
// the board where the cards that wait for an answer sit, under them, so a day card and the lender's card hid its words and its
// Reload. While such a card is up it drops to the board's foot now, as the GPU ladder's cards have since the fifth round
// (DECISIONS 2026-10-16), and neither hides the other. Shown failing (TS-04) on a5c0ccd, where elementFromPoint found the day
// card and then the lender's card over its words and Reload.
test('the map card that cannot start is read and its Reload pressed beside a day card and the lender’s card', async ({ page }) => {
  test.skip(!city.sim, 'no sim file in this build yet');
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1152, height: 720 });
  await page.route('**/cities/*.pmtiles', (r) => r.fulfill({ status: 500, body: 'Internal Server Error' }));
  await page.goto('./');
  await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'failed', { timeout: 30_000 });
  await foundCompany(page);
  // Ten minutes before day 2's close owing $200k, with four closes below the floor: the close ends the run.
  await withDebugLine(page, (d) => {
    d.clock.elapsed = 86_400 + 18 * 3_600 + 50 * 60;
    d.closesBelowFloor = 4;
    d.ledger.push({ day: 2, kind: 'buses', amountCents: -(STARTING_CENTS + 20_000_000), lineId: null });
  });
  const card = page.getByTestId('map-card');
  const [words, reload] = [card.locator('p'), card.getByRole('button', { name: 'Reload' })];
  await setSpeed(page, '5,400×');
  const dayCard = page.getByTestId('day-card');
  await expect(dayCard).toBeVisible({ timeout: 30_000 });
  expect.soft({ words: await inFront(words), reload: await inFront(reload) }, 'beside the day card').toEqual({ words: true, reload: true });
  expect(await inFront(dayCard.getByRole('button', { name: 'Continue' }))).toBe(true);
  await dayCard.getByRole('button', { name: 'Continue' }).click();
  const failure = page.getByTestId('failure-card');
  await expect(failure).toBeVisible();
  expect({ words: await inFront(words), reload: await inFront(reload) }, 'beside the lender’s card').toEqual({ words: true, reload: true });
  expect(await inFront(failure.getByRole('button', { name: 'Restart this quarter' }))).toBe(true);
  await reload.click({ trial: true });
});

// The sim's worker failing mid-game (here made to throw on an undo) takes the dock and Saves with it:
// the worker is stopped, and the card says so, with Reload, instead of nothing. Shown failing on
// af5e75d; with the card shown but the worker not stopped, Space still ran the clock under it. The
// panels open, the tool's card and its tint on the map and a day card go too, and so does Saves opened
// from Home (where the worker is made to throw on Export this game), leaving the card with Reload
// alone: their buttons would send to the worker that is gone, or close a card over a game that has
// stopped. Shown failing (TS-04) on 5f4bce3, where Saves and Finance, the depot card, the day card and
// Saves opened from Home all stayed under the card, Saves' buttons (Export this game, Save here) doing
// nothing; with only the panels and the tool's card taken, the day card stayed; and with the panels and
// every card taken but not the map's tint, the depot land stayed tinted under the card.
test('a sim worker that stops mid-game says so in one card with Reload, and takes its panels and cards with it', async ({ page }) => {
  test.skip(!city.sim, 'no sim file in this build yet');
  // The worker beats every 50 ms, and the page counts the beats it hears, so a worker left running under the card shows.
  // The page keeps the sim's worker, so the test can hand it a day's close as the worker would (a day takes too long).
  await page.addInitScript(() => {
    const seen = window as unknown as { beats: number; sim: Worker };
    seen.beats = 0;
    const Base = window.Worker;
    window.Worker = class extends Base {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        if (String(url).includes('sim.worker')) seen.sim = this;
        this.addEventListener('message', (e) => void ((e as MessageEvent<{ type?: string }>).data?.type === 'beat' && seen.beats++));
      }
    };
  });
  await page.route('**/assets/sim.worker-*.js', async (route) => {
    const response = await route.fetch();
    const stop = "setInterval(() => self.postMessage({ type: 'beat' }), 50); self.addEventListener('message', (e) => { if (e.data?.type === 'undo' || e.data?.type === 'export') throw new Error('e2e: the worker stops'); });";
    await route.fulfill({ response, body: `${stop}\n${await response.text()}` });
  });
  const beats = () => page.evaluate(() => (window as unknown as { beats: number }).beats);
  await page.goto('./');
  await foundCompany(page);
  await expect(page.getByTestId('saves-chip')).toBeVisible();
  await expect.poll(beats).toBeGreaterThan(0);
  // Saves and Finance open, and the depot tool's card beside the pointer, as the worker fails.
  await zoomOutOnce(page);
  await page.getByTestId('saves-chip').click();
  await page.getByRole('button', { name: 'Finance', exact: true }).click();
  await build(page, 'Place a depot');
  await pointAt(page, onDepotLand());
  await expect(page.getByTestId('depot-card')).toHaveAttribute('data-ok', 'yes', { timeout: 10_000 });
  const map = page.getByTestId('map');
  await expect(map).toHaveAttribute('data-tint', 'on');
  const panels = page.locator('[data-movable]');
  await expect(panels).toHaveCount(2);
  // And a day card, with its Continue.
  await page.evaluate(() => {
    const card = { day: 1, rows: [], cashBeforeCents: 0, cashAfterCents: 0, report: null, contracts: [], events: [], medals: [] };
    (window as unknown as { sim: Worker }).sim.dispatchEvent(new MessageEvent('message', { data: { type: 'day-card', card } }));
  });
  const dayCard = page.getByTestId('day-card');
  await expect(dayCard.getByRole('button', { name: 'Continue' })).toBeVisible();
  await page.keyboard.press('Control+z');
  const card = page.getByTestId('failed-card');
  await expect(card).toHaveText('The game stopped workingReload');
  await expect(page.getByTestId('saves-chip')).toHaveCount(0);
  await expect(panels).toHaveCount(0);
  await expect(page.getByTestId('depot-card')).toHaveCount(0);
  await expect(map).toHaveAttribute('data-tint', 'off');
  await expect(dayCard).toHaveCount(0);
  // Stopped: no beat after the card.
  const heard = await beats();
  await page.waitForTimeout(500);
  expect(await beats()).toBe(heard);
  // Reloaded, the game is back on Home, where Saves goes with a worker that fails under it.
  await card.getByRole('button', { name: 'Reload' }).click();
  const home = page.getByTestId('home');
  await expect(home).toBeVisible({ timeout: 30_000 });
  await home.getByRole('button', { name: 'Saves' }).click();
  const saves = page.getByTestId('saves');
  await saves.getByRole('button', { name: 'Export this game' }).click();
  await expect(card).toHaveText('The game stopped workingReload');
  await expect(home).toHaveCount(0);
  await expect(saves).toHaveCount(0);
});

// A worker that stops while time runs leaves a map that stands still: the vehicle layer asks for no frame under the card,
// as while paused (I14). Shown failing (TS-04) on abb5f2f, where the map still had the last snapshot's clock, running,
// and the layer asked for a frame after every frame until a reload: 6 more in the 2 s measured.
test('a sim worker that stops while time runs leaves the map standing still under its card', async ({ page }) => {
  test.skip(!city.sim, 'no sim file in this build yet');
  // The worker stops at an export once armed, so the debug line's own export goes through.
  await page.route('**/assets/sim.worker-*.js', async (route) => {
    const response = await route.fetch();
    const stop = "self.addEventListener('message', (e) => { if (e.data?.type === 'arm') self.armed = true; else if (e.data?.type === 'export' && self.armed) throw new Error('e2e: the worker stops'); });";
    await route.fulfill({ response, body: `${stop}\n${await response.text()}` });
  });
  await page.addInitScript(() => {
    const seen = window as unknown as { sim: Worker };
    const Base = window.Worker;
    window.Worker = class extends Base {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        if (String(url).includes('sim.worker')) seen.sim = this;
      }
    };
  });
  await page.goto('./');
  const map = page.getByTestId('map');
  await expect(map).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
  await foundCompany(page);
  await withDebugLine(page);
  await setSpeed(page, '60×');
  await expect.poll(async () => Number(await map.getAttribute('data-buses')), { timeout: 10_000 }).toBeGreaterThan(0);
  await expect.poll(async () => Number(await map.getAttribute('data-asked')), { timeout: 10_000 }).toBeGreaterThan(0);
  await page.evaluate(() => (window as unknown as { sim: Worker }).sim.postMessage({ type: 'arm' }));
  await page.getByTestId('saves-chip').click();
  await page.getByRole('button', { name: 'Export this game' }).click();
  await expect(page.getByTestId('failed-card')).toHaveText('The game stopped workingReload');
  await page.waitForTimeout(500);
  const asked = await map.getAttribute('data-asked');
  await page.waitForTimeout(2_000);
  expect(await map.getAttribute('data-asked')).toBe(asked);
});
