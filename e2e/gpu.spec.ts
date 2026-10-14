// The GPU ladder (the M5 spec, item 5; PLAN §6 "No GPU"): this browser draws in software (the e2e
// tests' Chromium runs WebGL on SwiftShader), so the map comes up in Low graphics, flat, its buses at
// most 30 frames a second; with no WebGL2 a calm card asks for hardware acceleration while Home, Saves
// and Export still work; a context lost mid-game says so with Reload, and one given back draws the buses
// again. `?gpu=` forces each rung.
import { expect, test, type Page } from '@playwright/test';
import { foundCompany } from './found';
import { build, city, onDepotLand, setSpeed, toScreen, zoomOutOnce } from './shell';
import { DEBUG_STOPS } from '../src/sim/commands/debugLine';

/** Takes the map's graphics away, as a GPU reset or a sleep may, keeping the extension that gives them back (a lost context hands out none). */
async function takeGraphics(page: Page): Promise<void> {
  await page.evaluate(() => {
    const lose = document.querySelector<HTMLCanvasElement>('.maplibregl-canvas')!.getContext('webgl2')!.getExtension('WEBGL_lose_context')!;
    (window as unknown as { lostContext: WEBGL_lose_context }).lostContext = lose;
    lose.loseContext();
  });
}

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
    await build(page, 'Place a depot');
    const [dx, dy] = await toScreen(page, onDepotLand());
    await page.mouse.click(dx, dy);
    await build(page, 'Draw a line');
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
    await expect(card).toContainText('It is off in this browser: switch it on in the browser’s settings, then reload.'); // not "has none for it" (D25's copy pass)
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'no-gpu');
    const home = page.getByTestId('home');
    await expect(home).toBeVisible({ timeout: 30_000 });
    await home.getByRole('button', { name: 'Saves' }).click();
    const download = page.waitForEvent('download');
    await page.getByTestId('saves').getByRole('button', { name: 'Export this game' }).click();
    expect((await download).suggestedFilename()).toBe('interbus-boston-day-1.json');
  });

  // The systems audit (D26): with the graphics gone MapLibre has no style, and T, a demand toggle or
  // Place a depot reached it, threw, and took the whole game off screen, the card with it. Given back
  // and taken away again before the style MapLibre rebuilds had loaded, it came back with no style, a
  // blank board, yet the card went. Shown failing (TS-04) on the old map, where T blanked the page.
  test('a map whose graphics are taken away mid-game says so, with Reload, and the game plays on', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('./?gpu=full');
    const map = page.getByTestId('map');
    await expect(map).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await expect(map).toHaveAttribute('data-graphics', 'full');
    await foundCompany(page);
    await takeGraphics(page);
    const card = page.getByTestId('gpu-card');
    await expect(card).toContainText('The browser took the map’s graphics away.');
    await expect(map).toHaveAttribute('data-status', 'lost');

    // T, a kind of dot hidden, and Place a depot, with the graphics gone.
    await page.keyboard.press('t');
    await page.getByTestId('demand-chip').click();
    await page.getByTestId('demand-menu').getByRole('menuitemcheckbox', { name: /Homes/ }).click();
    await build(page, 'Place a depot');
    await expect(card.getByRole('button', { name: 'Reload' })).toBeVisible();
    await expect(page.getByTestId('build')).toBeVisible();
    expect(errors).toEqual([]);

    // Given back, and taken away again before the next frame, by which the style MapLibre rebuilds
    // would load (frames are held meanwhile, as on a slow machine): MapLibre keeps no style that has not
    // loaded, so the second time they come back with none, and the card with Reload stays.
    await page.evaluate(
      () =>
        new Promise<void>((done) => {
          const lose = (window as unknown as { lostContext: WEBGL_lose_context }).lostContext;
          const canvas = document.querySelector<HTMLCanvasElement>('.maplibregl-canvas')!;
          const { requestAnimationFrame: frame, cancelAnimationFrame: cancel } = window;
          const held = new Map<number, FrameRequestCallback>();
          let id = 1e9;
          window.requestAnimationFrame = (callback) => (held.set(++id, callback), id);
          window.cancelAnimationFrame = (handle) => void (held.delete(handle) || cancel(handle));
          const again = () => {
            Object.assign(window, { requestAnimationFrame: frame, cancelAnimationFrame: cancel });
            for (const callback of held.values()) frame(callback);
            // The browser allows a restore only once the lost event has been handled.
            setTimeout(() => {
              canvas.addEventListener('webglcontextrestored', () => frame(() => frame(() => done())), { once: true });
              lose.restoreContext();
            });
          };
          const loseAgain = () => {
            canvas.addEventListener('webglcontextlost', again, { once: true });
            lose.loseContext();
          };
          canvas.addEventListener('webglcontextrestored', loseAgain, { once: true });
          lose.restoreContext();
        }),
    );
    await expect(map).toHaveAttribute('data-status', 'lost');
    await expect(card.getByRole('button', { name: 'Reload' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  // The systems audit (D26): MapLibre rebuilds the style when the context comes back but drops custom
  // layers, so the board said ready with no bus drawn until a reload. Shown failing (TS-04) on the old
  // map, where the vehicle layer asked for no frame after the restore. And a loaded game's depot 1 was
  // drawn where the last game's depot 1 stood, the depots' layer being keyed by id alone: shown failing
  // with that key restored, where data-depots (where the layer was last set) kept the first place.
  test('when the browser gives the map its graphics back, the buses are drawn again, and T pressed meanwhile tilts it', async ({ page }) => {
    test.setTimeout(90_000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await page.goto('./?gpu=full');
    const map = page.getByTestId('map');
    await expect(map).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(page);
    // A depot and the debug line every 10 minutes, imported as a save file (as e2e/insert.spec.ts does).
    await page.getByRole('button', { name: 'Saves' }).click();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export this game' }).click();
    const save = JSON.parse(Buffer.concat((await (await (await download).createReadStream()).toArray()) as Buffer[]).toString()) as { data: Record<string, unknown> & { clock: { elapsed: number }; nextIds: Record<string, number> } };
    /** Puts depot 1 on the sim file's `parcel`th largest parcel of depot land, and says how data-depots names it. */
    const depotOn = (parcel: number) => {
      const [lon, lat] = onDepotLand(parcel);
      save.data.depots = [{ id: 1, lon, lat }];
      return `1@${lon.toFixed(6)},${lat.toFixed(6)}`;
    };
    const first = depotOn(0);
    save.data.stops = DEBUG_STOPS.map((s, k) => ({ id: k + 1, lon: s.at[0], lat: s.at[1], tier: 1 }));
    save.data.lines = [{ id: 1, name: 'Line 1', colour: '#2471a3', stopIds: [1, 2, 3, 4], fareCents: 225, headways: { peak: 600, offpeak: 600, overnight: null }, boardedMilli: 0, buses: 3, model: 'sparrow', earlier: [] }];
    save.data.nextIds = { ...save.data.nextIds, depot: 2, stop: 5, line: 2 };
    save.data.clock.elapsed = 86_400 + 3 * 3_600; // 08:00 on day 2, buses out
    const load = async () => {
      if (!(await page.getByTestId('saves').isVisible())) await page.getByRole('button', { name: 'Saves' }).click();
      const chooser = page.waitForEvent('filechooser');
      await page.getByRole('button', { name: 'Import a save file' }).click();
      await (await chooser).setFiles({ name: 'restore.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(save)) });
      await expect(page.getByTestId('notice')).toContainText('Save file loaded');
      await page.getByTestId('saves').getByRole('button', { name: 'Close' }).click();
    };
    await load();
    await expect(map).toHaveAttribute('data-depots', first);
    await setSpeed(page, '60×');
    await expect.poll(async () => Number(await map.getAttribute('data-buses')), { timeout: 10_000 }).toBeGreaterThan(0);
    await expect.poll(async () => Number(await map.getAttribute('data-asked')), { timeout: 10_000 }).toBeGreaterThan(0);

    // Taken away, and T pressed meanwhile: given back, the buses are drawn again, and the board is
    // tilted with its buildings standing.
    await takeGraphics(page);
    await expect(map).toHaveAttribute('data-status', 'lost');
    await page.keyboard.press('t');
    await expect(map).toHaveAttribute('data-mode', '3d');
    await page.evaluate(() => (window as unknown as { lostContext: WEBGL_lose_context }).lostContext.restoreContext());
    await expect(map).toHaveAttribute('data-status', 'ready', { timeout: 10_000 });
    await expect(page.getByTestId('gpu-card')).toHaveCount(0);
    // Time runs, so the vehicle layer asks for frame after frame once it is back.
    const asked = await map.getAttribute('data-asked');
    await expect.poll(async () => map.getAttribute('data-asked'), { timeout: 10_000 }).not.toBe(asked);
    await expect(map).toHaveAttribute('data-pitch', '50', { timeout: 30_000 });
    expect(Number(await map.getAttribute('data-buildings')), '3D buildings drawn').toBeGreaterThan(0);

    // The same game loaded again with its depot 1 on another parcel: drawn where it stands now.
    const moved = depotOn(1);
    await load();
    await expect(map).toHaveAttribute('data-depots', moved);
    expect(errors).toEqual([]);
  });
});
