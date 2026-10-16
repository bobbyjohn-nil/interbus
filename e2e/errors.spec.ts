import { expect, test, type Route } from '@playwright/test';
import { foundCompany } from './found';
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
