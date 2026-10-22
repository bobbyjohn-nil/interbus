// D2 (the M5 spec's tests; CLAUDE.md): the camera mode never changes a sim number. A session played
// in full graphics, tilted and flattened while time runs, replays in Node, where there is no camera at
// all, to the same game fingerprint, and its commands hold no tilt. session.spec.ts plays the same in
// Low graphics, which is where the e2e tests' software-rendering browser runs by default (gpu.ts).
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { DEBUG_STOPS } from '../src/sim/commands/debugLine';
import { replaySession } from '../src/worker/replay';
import { foundCompany } from './found';
import { build, city, onDepotLand, setFare, setSpeed, toScreen, zoomOutOnce } from './shell';

test.describe('the camera and the sim (D2)', () => {
  test.skip(!city.sim, 'no sim file in this build yet');

  test('a session tilted and flattened while time runs replays to the same game', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('./?gpu=full');
    const map = page.getByTestId('map');
    const panel = page.getByTestId('sim-panel');
    await expect(map).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await expect(map).toHaveAttribute('data-graphics', 'full');
    await foundCompany(page);
    await zoomOutOnce(page);
    await build(page, 'Place a depot');
    const [dx, dy] = await toScreen(page, onDepotLand());
    await page.mouse.click(dx, dy);
    await build(page, 'Draw a line');
    for (const stop of DEBUG_STOPS) {
      const [x, y] = await toScreen(page, stop.at);
      await page.mouse.click(x, y);
    }
    await expect(page.getByTestId('draft-card')).toHaveAttribute('data-price', '20600000', { timeout: 10_000 });
    await page.getByRole('button', { name: 'Create' }).click();
    await page.getByRole('button', { name: 'Close', exact: true }).click();

    // Tilted while time runs, flattened again, and a fare changed in between.
    await setSpeed(page, '5,400×');
    await page.getByTestId('compass').click();
    await expect(map).toHaveAttribute('data-mode', '3d');
    // Turned too (D25): the camera's bearing is no command either.
    await page.keyboard.press('e');
    await expect(map).not.toHaveAttribute('data-bearing', '0', { timeout: 10_000 });
    await expect.poll(async () => Number(await panel.getAttribute('data-elapsed')), { timeout: 30_000 }).toBeGreaterThan(4 * 3_600);
    await setFare(page, 'Line 1', '$2.00');
    await page.keyboard.press('t');
    await expect(map).toHaveAttribute('data-mode', '2d');
    await expect.poll(async () => Number(await panel.getAttribute('data-elapsed')), { timeout: 30_000 }).toBeGreaterThan(8 * 3_600);
    await page.getByRole('button', { name: 'Pause' }).click();
    await expect(panel).toHaveAttribute('data-speed', '0');

    await page.getByRole('button', { name: 'Saves' }).click();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export session' }).click();
    const text = Buffer.concat((await (await (await download).createReadStream()).toArray()) as Buffer[]).toString();
    const session = JSON.parse(text) as { commands: { message: { type: string } }[]; end: { elapsed: number; hash: string } };
    expect(session.commands.map((c) => c.message.type)).toEqual(['place-depot', 'create-line', 'speed', 'set-fare', 'speed']);
    const simText = readFileSync(`public/cities/${city.sim!.file}`, 'utf8');
    expect(replaySession(simText, text)).toEqual({ ok: true, hash: session.end.hash, matches: true });
  });
});
