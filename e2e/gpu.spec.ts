// The GPU ladder (the M5 spec, item 5; PLAN §6 "No GPU"): this browser draws in software (the e2e
// tests' Chromium runs WebGL on SwiftShader), so the map comes up in Low graphics, flat, its buses at
// most 30 frames a second; with no WebGL2 a calm card asks for hardware acceleration while Home, Saves
// and Export still work; a context lost mid-game says so with Reload, and one given back draws the buses
// again. `?gpu=` forces each rung.
import { expect, test, type Locator, type Page } from './base';
import { foundCompany, STARTING_CENTS } from './found';
import { build, city, onDepotLand, setSpeed, toScreen, withDebugLine, zoomOutOnce } from './shell';
import { DEBUG_STOPS } from '../src/sim/commands/debugLine';

/** Takes the map's graphics away, as a GPU reset or a sleep may, keeping the extension that gives them back (a lost context hands out none). */
async function takeGraphics(page: Page): Promise<void> {
  await page.evaluate(() => {
    const lose = document.querySelector<HTMLCanvasElement>('.maplibregl-canvas')!.getContext('webgl2')!.getExtension('WEBGL_lose_context')!;
    (window as unknown as { lostContext: WEBGL_lose_context }).lostContext = lose;
    lose.loseContext();
  });
}

/** Site data blocked, for page.addInitScript: the localStorage and sessionStorage getters throw a SecurityError, as a browser
 * blocking the site's data throws from both (the review of #161), and as e2e/saves.spec.ts has it. */
function blockStorage(): void {
  for (const name of ['localStorage', 'sessionStorage'])
    Object.defineProperty(window, name, {
      configurable: true,
      get() {
        throw new DOMException('The operation is insecure.', 'SecurityError');
      },
    });
}

/** Whether `target` is what is drawn at its middle and near both ends of its middle row, so its words can be read and it pressed. */
function onTop(target: Locator): Promise<boolean[]> {
  return target.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return [0.05, 0.5, 0.95].map((f) => el.contains(document.elementFromPoint(r.x + r.width * f, r.y + r.height / 2)));
  });
}

/** The GPU card says the game isn't saving itself, never that it is saved, and its Export this game hands the game over as a file. */
async function saysUnsaved(page: Page): Promise<string> {
  const card = page.getByTestId('gpu-card');
  await expect(card).toContainText('This game isn’t saving itself: export it before you reload.');
  await expect(card).not.toContainText('is saved');
  const download = page.waitForEvent('download');
  await card.getByRole('button', { name: 'Export this game' }).click();
  return (await download).suggestedFilename();
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
    await page.getByRole('button', { name: 'Close', exact: true }).click();
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
    await expect(card).toContainText('Your game is saved, and Saves and Export still work.');
    await expect(card.getByRole('button')).toHaveCount(0);
    await home.getByRole('button', { name: 'Saves' }).click();
    const download = page.waitForEvent('download');
    await page.getByTestId('saves').getByRole('button', { name: 'Export this game' }).click();
    expect((await download).suggestedFilename()).toBe('interbus-boston-day-1.json');
  });

  // The systems audit's fifth round: the GPU ladder's cards said "your game is saved" while the Saves chip beside them said
  // "Autosave off", and the lost card's one button, Reload, then lost all play since the last save kept: the whole company
  // with blocked site data, everything since the store first refused with a full one (31,620 game seconds and a fare change on
  // the audit's run). While the game isn't saving itself they say so, and offer Export this game, before the lost card's
  // Reload. Shown failing (TS-04) on 050dbdd, where each card said the game was saved and had no Export.
  test('with blocked site data, the lost card says the game isn’t saving itself and offers Export this game before Reload', async ({ page }) => {
    await page.addInitScript(blockStorage);
    await page.goto('./?gpu=full');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(page);
    await expect(page.getByTestId('saves-chip')).toHaveText('Autosave off');
    await takeGraphics(page);
    expect(await saysUnsaved(page)).toBe('interbus-boston-day-1.json');
    await expect(page.getByTestId('gpu-card').getByRole('button')).toHaveText(['Export this game', 'Reload']);
  });

  test('with a full store, the lost card says the game isn’t saving itself and offers Export this game before Reload', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('./?gpu=full');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(page);
    await withDebugLine(page);
    // Other data of the origin takes the rest of its room, as on the audit's run.
    await page.evaluate(() => {
      for (const size of [100_000, 10_000, 1_000, 100, 10, 1]) {
        try {
          for (let k = 0; k < 1_000; k++) localStorage.setItem(`another.app.${size}.${k}`, 'f'.repeat(size));
        } catch {
          // full at this size: on to the next
        }
      }
    });
    await setSpeed(page, '5,400×');
    await expect(page.getByTestId('saves-chip')).toHaveText('Autosave off', { timeout: 30_000 });
    await page.getByTestId('play').click();
    await takeGraphics(page);
    expect(await saysUnsaved(page)).toMatch(/^interbus-boston-day-\d+\.json$/);
    await expect(page.getByTestId('gpu-card').getByRole('button')).toHaveText(['Export this game', 'Reload']);
  });

  test('with no WebGL2 and blocked site data, the card says the game isn’t saving itself and offers Export this game', async ({ page }) => {
    await page.addInitScript(blockStorage);
    await page.goto('./?gpu=none');
    await foundCompany(page);
    await expect(page.getByTestId('saves-chip')).toHaveText('Autosave off');
    await expect(page.getByTestId('gpu-card')).toContainText('Turn on hardware acceleration to see the map.');
    expect(await saysUnsaved(page)).toBe('interbus-boston-day-1.json');
    await expect(page.getByTestId('gpu-card').getByRole('button')).toHaveText(['Export this game']);
  });

  // The systems audit's fifth round: the lost card sat high on the board where the cards that wait for an answer sit, under
  // them, so the lender's card, which has no close, hid its words and its Reload (but 20 px of it) and a day card hid its
  // words. While such a card is up the GPU ladder's cards drop to the board's foot now, still under the cards and panels
  // (DECISIONS 2026-10-16), so neither hides the other: lifted over them, the lost card hid a short day card's Continue. Shown
  // failing (TS-04) on 050dbdd, where elementFromPoint found the day card over the words and the lender's card over words and
  // Reload.
  test('the lost card is read and its Reload pressed beside a day card and the lender’s card, whose buttons stay pressable', async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1152, height: 720 });
    await page.goto('./?gpu=full');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(page);
    // Ten minutes before day 2's close owing $200k, with four closes below the floor: the close ends the run.
    await withDebugLine(page, (d) => {
      d.clock.elapsed = 86_400 + 18 * 3_600 + 50 * 60;
      d.closesBelowFloor = 4;
      d.ledger.push({ day: 2, kind: 'buses', amountCents: -(STARTING_CENTS + 20_000_000), lineId: null });
    });
    await setSpeed(page, '5,400×');
    const dayCard = page.getByTestId('day-card');
    await expect(dayCard).toBeVisible({ timeout: 30_000 });
    await takeGraphics(page);
    const card = page.getByTestId('gpu-card');
    await expect(card).toContainText('The browser took the map’s graphics away.');
    const [words, reload] = [card.locator('p'), card.getByRole('button', { name: 'Reload' })];
    expect.soft({ words: await onTop(words), reload: await onTop(reload) }).toEqual({ words: [true, true, true], reload: [true, true, true] });
    expect(await onTop(dayCard.getByRole('button', { name: 'Continue' }))).toEqual([true, true, true]);
    await dayCard.getByRole('button', { name: 'Continue' }).click();
    const failure = page.getByTestId('failure-card');
    await expect(failure).toBeVisible();
    expect({ words: await onTop(words), reload: await onTop(reload) }).toEqual({ words: [true, true, true], reload: [true, true, true] });
    expect(await onTop(failure.getByRole('button', { name: 'Restart this quarter' }))).toEqual([true, true, true]);
    await reload.click({ trial: true });
  });

  // The systems audit's seventh round: MapLibre resizes its canvas only when the container's box changes, so a window moved from a
  // 2x screen to a 1x one kept its 2x canvas, and one moved the other way a 1x canvas, blurry on the sharper screen. The map
  // resizes at each change of density now, read each second. Shown failing (TS-04) without the watch, when the canvas stayed at 2.
  test('in full graphics the map follows the window to a screen of another density', async ({ browser }) => {
    test.setTimeout(90_000);
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    await page.goto('./?gpu=full');
    const map = page.getByTestId('map');
    await expect(map).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await expect(map).toHaveAttribute('data-graphics', 'full');
    const drawnAt = () => page.evaluate(() => {
      const c = document.querySelector<HTMLCanvasElement>('.maplibregl-canvas')!;
      return c.width / c.clientWidth;
    });
    expect(await drawnAt()).toBe(2);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false });
    await expect.poll(() => page.evaluate(() => devicePixelRatio)).toBe(1);
    await expect.poll(drawnAt).toBe(1);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 768, deviceScaleFactor: 2, mobile: false });
    await expect.poll(() => page.evaluate(() => devicePixelRatio)).toBe(2);
    await expect.poll(drawnAt).toBe(2);
    await context.close();
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
    await expect(card).toContainText(/your game is saved\./i); // as it is: the Saves chip says Saves
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
      await page.getByRole('button', { name: 'Replace this game' }).click();
      await (await chooser).setFiles({ name: 'restore.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(save)) });
      await expect(page.getByTestId('notice')).toContainText('Save file loaded');
      await page.getByTestId('saves').getByRole('button', { name: 'Close', exact: true }).click();
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
