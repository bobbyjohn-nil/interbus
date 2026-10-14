// The GPU ladder (the M5 spec, item 5; PLAN §6 "No GPU"): this browser draws in software (the e2e
// tests' Chromium runs WebGL on SwiftShader), so the map comes up in Low graphics, flat, its buses at
// most 30 frames a second; with no WebGL2 a calm card asks for hardware acceleration while Home, Saves
// and Export still work; a context lost mid-game says so with Reload. `?gpu=` forces each rung.
import { expect, test } from '@playwright/test';
import { foundCompany } from './found';
import { city, onDepotLand, setSpeed, toScreen, zoomOutOnce } from './shell';
import { DEBUG_STOPS } from '../src/sim/commands/debugLine';

test.describe('the GPU ladder', () => {
  test.skip(!city.sim, 'no sim file in this build yet');

  test('software rendering is Low graphics: flat, with its frames counted by ?fps', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('./?fps');
    const map = page.getByTestId('map');
    await expect(map).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await expect(map).toHaveAttribute('data-graphics', 'low');
    await foundCompany(page);
    await page.keyboard.press('t');
    await expect(page.getByTestId('flat-notice')).toHaveText('Low graphics: the map stays flat on this computer.');
    await expect(map).toHaveAttribute('data-mode', '2d');

    // A line running at speed: the readout counts the frames drawn, never more than 30 a second (its
    // cap is gpu.test.ts's; this browser's software rendering is slower than the cap).
    await zoomOutOnce(page);
    await page.getByRole('button', { name: 'Place a depot' }).click();
    const [dx, dy] = await toScreen(page, onDepotLand());
    await page.mouse.click(dx, dy);
    await page.getByRole('button', { name: 'Draw a line' }).click();
    for (const stop of DEBUG_STOPS) {
      const [x, y] = await toScreen(page, stop.at);
      await page.mouse.click(x, y);
    }
    await expect(page.getByTestId('draft-card')).toHaveAttribute('data-refusal', '', { timeout: 10_000 });
    await page.getByRole('button', { name: 'Create' }).click();
    await page.getByRole('button', { name: 'Close' }).click();
    await setSpeed(page, '600×');
    // The readout names where it was read: the camera's zoom and pitch, and the rung.
    await expect(page.getByTestId('fps')).toContainText(/ fps · p95 \d+ ms · zoom 1\d\.\d · 0° · Low graphics$/, { timeout: 10_000 });
    await expect.poll(async () => Number(await map.getAttribute('data-fps')), { timeout: 10_000 }).toBeGreaterThan(0);
    await page.waitForTimeout(2_500); // a full window of frames at speed
    expect(Number(await map.getAttribute('data-fps'))).toBeLessThanOrEqual(31);
  });

  test('with no WebGL2, a calm card asks for hardware acceleration, and Saves and Export still work', async ({ page }) => {
    await page.goto('./?gpu=none');
    const card = page.getByTestId('gpu-card');
    await expect(card).toContainText('Turn on hardware acceleration to see the map.');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'no-gpu');
    const home = page.getByTestId('home');
    await expect(home).toBeVisible({ timeout: 30_000 });
    await home.getByRole('button', { name: 'Saves' }).click();
    const download = page.waitForEvent('download');
    await page.getByTestId('saves').getByRole('button', { name: 'Export this game' }).click();
    expect((await download).suggestedFilename()).toBe('interbus-boston-day-1.json');
  });

  test('a map whose graphics are taken away mid-game says so, with Reload', async ({ page }) => {
    await page.goto('./?gpu=full');
    const map = page.getByTestId('map');
    await expect(map).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await expect(map).toHaveAttribute('data-graphics', 'full');
    await foundCompany(page);
    await page.evaluate(() => document.querySelector<HTMLCanvasElement>('.maplibregl-canvas')!.getContext('webgl2')!.getExtension('WEBGL_lose_context')!.loseContext());
    await expect(page.getByTestId('gpu-card')).toContainText('The browser took the map’s graphics away.');
    await expect(map).toHaveAttribute('data-status', 'lost');
    await expect(page.getByTestId('gpu-card').getByRole('button', { name: 'Reload' })).toBeVisible();
  });
});
