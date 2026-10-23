// Export session replayed (the M3 spec, item 12; I15; AR-06): a game played on the page, exported as
// a session, replays in Node, on the same sim file, to the same game fingerprint.
import { readFileSync } from 'node:fs';
import { expect, test } from './base';
import { DEBUG_STOPS } from '../src/sim/commands/debugLine';
import { replaySession } from '../src/worker/replay';
import { foundCompany } from './found';
import { build, city, onDepotLand, setFare, setSpeed, toScreen, zoomOutOnce } from './shell';

test.describe('Export session', () => {
  test.skip(!city.sim, 'no sim file in this build yet');

  test('replays a played session in Node to the same game', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('./');
    const panel = page.getByTestId('sim-panel');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(page);
    await zoomOutOnce(page);
    await build(page, 'Place a depot');
    const [dx, dy] = await toScreen(page, onDepotLand());
    await page.mouse.click(dx, dy);
    await expect(page.getByTestId('checklist')).toHaveText('2/5 Draw a line');
    await build(page, 'Draw a line');
    for (const stop of DEBUG_STOPS) {
      const [x, y] = await toScreen(page, stop.at);
      await page.mouse.click(x, y);
    }
    await expect(page.getByTestId('draft-card')).toHaveAttribute('data-price', '20600000', { timeout: 10_000 });
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByTestId('line-card')).toBeVisible();
    // Time runs for a few game hours, and a fare changes while it does.
    await setSpeed(page, '5,400×');
    await expect.poll(async () => Number(await panel.getAttribute('data-elapsed')), { timeout: 30_000 }).toBeGreaterThan(4 * 3_600);
    await setFare(page, 'Line 1', '$2.00');
    await expect.poll(async () => Number(await panel.getAttribute('data-elapsed')), { timeout: 30_000 }).toBeGreaterThan(8 * 3_600);
    await page.getByRole('button', { name: 'Pause' }).click();
    await expect(panel).toHaveAttribute('data-speed', '0');

    await page.getByRole('button', { name: 'Saves' }).click();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export session' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^interbus-boston-session-day-\d+\.json$/);
    const text = Buffer.concat((await (await file.createReadStream()).toArray()) as Buffer[]).toString();
    const session = JSON.parse(text) as { commands: { message: { type: string } }[]; end: { elapsed: number; hash: string } };
    expect(session.commands.map((c) => c.message.type)).toEqual(['place-depot', 'create-line', 'speed', 'set-fare', 'speed']);
    expect(session.end.elapsed).toBe(Number(await panel.getAttribute('data-elapsed')));
    const simText = readFileSync(`public/cities/${city.sim!.file}`, 'utf8');
    expect(replaySession(simText, text)).toEqual({ ok: true, hash: session.end.hash, matches: true });
  });
});
