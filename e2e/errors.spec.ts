import { expect, test, type Route } from '@playwright/test';
import { foundCompany } from './found';
import { city } from './shell';

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
// af5e75d; with the card shown but the worker not stopped, Space still ran the clock under it.
test('a sim worker that stops mid-game says so in one card with Reload', async ({ page }) => {
  test.skip(!city.sim, 'no sim file in this build yet');
  // The worker beats every 50 ms, and the page counts the beats it hears, so a worker left running under the card shows.
  await page.addInitScript(() => {
    const seen = window as unknown as { beats: number };
    seen.beats = 0;
    const Base = window.Worker;
    window.Worker = class extends Base {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        this.addEventListener('message', (e) => void ((e as MessageEvent<{ type?: string }>).data?.type === 'beat' && seen.beats++));
      }
    };
  });
  await page.route('**/assets/sim.worker-*.js', async (route) => {
    const response = await route.fetch();
    const stop = "setInterval(() => self.postMessage({ type: 'beat' }), 50); self.addEventListener('message', (e) => { if (e.data?.type === 'undo') throw new Error('e2e: the worker stops'); });";
    await route.fulfill({ response, body: `${stop}\n${await response.text()}` });
  });
  const beats = () => page.evaluate(() => (window as unknown as { beats: number }).beats);
  await page.goto('./');
  await foundCompany(page);
  await expect(page.getByTestId('saves-chip')).toBeVisible();
  await expect.poll(beats).toBeGreaterThan(0);
  await page.keyboard.press('Control+z');
  const card = page.getByTestId('failed-card');
  await expect(card).toHaveText('The game stopped workingReload');
  await expect(page.getByTestId('saves-chip')).toHaveCount(0);
  // Stopped: no beat after the card.
  const heard = await beats();
  await page.waitForTimeout(500);
  expect(await beats()).toBe(heard);
});
