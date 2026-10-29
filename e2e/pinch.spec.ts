// A trackpad's pinch zooms the map alone (src/ui/pinch.ts). Chrome sends a pinch as wheel events with ctrlKey, and uncancelled
// over a panel or Home's card they zoomed the whole page, 1.6 times at a pinch, the chips, the dock and the map's credit out of
// view, and Chrome kept the page zoomed through a reload (the systems audit's seventeenth round). CDP's synthesizePinchGesture with
// the mouse as its source is Chrome's own touchpad pinch, as a Mac's trackpad sends it, at a Mac's scale factor. Shown failing
// (TS-04) with no cancel: the page's scale read 1.6 after a pinch over Home's card and over Finance. And a page zoomed before the
// game's code ran, by a pinch over the splash, pinches back out (the eighteenth round): shown failing with every pinch off the
// map cancelled, the page's scale stayed 1.6. Only out, and only while zoomed (the round's review): with every Ctrl and wheel
// let through while zoomed, a pinch in took it from 1.6 to 1.92; with every zoom-out let through, Ctrl and a mouse's wheel
// turned down at scale 1 went uncancelled.
import { expect, test, type Page } from './base';
import { foundCompany } from './found';

test.use({ viewport: { width: 1440, height: 790 }, deviceScaleFactor: 2 });

/** A trackpad's pinch at (x, y), spreading the fingers `scale` times apart. */
async function pinchAt(page: Page, x: number, y: number, scale: number): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.synthesizePinchGesture', { x, y, scaleFactor: scale, relativeSpeed: 800, gestureSourceType: 'mouse' });
  await cdp.detach();
}

/** Ctrl and a mouse's wheel turned once at (x, y), towards the player (out), as CDP sends it: whether the page cancelled it. */
async function ctrlWheelOut(page: Page, x: number, y: number): Promise<boolean> {
  await page.evaluate(() => {
    const w = window as unknown as { wheelOut: Promise<boolean> };
    // Heard as it starts down the page (capture), before any listener can stop it, as pinch.ts stops a zoom out while zoomed.
    w.wheelOut = new Promise((done) => window.addEventListener('wheel', (e) => void setTimeout(() => done(e.defaultPrevented)), { once: true, capture: true }));
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: 0, deltaY: 100, modifiers: 2 });
  await cdp.detach();
  return page.evaluate(() => (window as unknown as { wheelOut: Promise<boolean> }).wheelOut);
}

/** How far the page itself is zoomed by a pinch (the visual viewport), 1 when it is not. */
const pageScale = (page: Page) => page.evaluate(() => window.visualViewport!.scale);
/** The map's zoom, as its view reads once it has moved. */
const mapZoom = async (page: Page) => Number((await page.getByTestId('map').getAttribute('data-view'))!.split(',')[2]);
/** The map's zoom once a pinch's steps have all landed: the same two reads 300 ms apart. */
async function settledZoom(page: Page): Promise<number> {
  for (let last = await mapZoom(page); ; ) {
    await page.waitForTimeout(300);
    const now = await mapZoom(page);
    if (now === last) return now;
    last = now;
  }
}

test('a pinch over Home’s card or a panel leaves the page as it is, and over the map zooms the map', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('./');
  await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
  const home = (await page.getByTestId('home').boundingBox())!;
  await pinchAt(page, home.x + home.width / 2, home.y + 40, 1.6);
  expect(await pageScale(page)).toBe(1);
  // A zoom out at the page's own scale is cancelled too, so Ctrl and a mouse's wheel leave the browser's zoom as it is.
  expect(await ctrlWheelOut(page, home.x + home.width / 2, home.y + 40)).toBe(true);
  await foundCompany(page);
  await page.getByRole('button', { name: 'Finance', exact: true }).click();
  const finance = (await page.getByTestId('finance').boundingBox())!;
  await pinchAt(page, finance.x + finance.width / 2, finance.y + finance.height / 2, 1.6);
  expect(await pageScale(page)).toBe(1);
  await expect(page.locator('.corner')).toBeInViewport({ ratio: 1 });
  // Over the map the pinch is the map's, as before: it zooms in, the page as it was, and out again, at the page's own scale (the
  // review of the nineteenth round: with every zoom out over the map kept from the map, this test passed).
  const before = await mapZoom(page);
  await pinchAt(page, 300, 400, 1.6);
  await expect.poll(() => mapZoom(page)).toBeGreaterThan(before);
  expect(await pageScale(page)).toBe(1);
  const zoomedIn = await settledZoom(page);
  await pinchAt(page, 300, 400, 1 / 1.6);
  await expect.poll(() => mapZoom(page)).toBeLessThan(zoomedIn);
  expect(await pageScale(page)).toBe(1);
});

test('a page zoomed by a pinch before the game’s code ran pinches back out over Home’s card', async ({ page }) => {
  test.setTimeout(90_000);
  // The game's code held back as a slow line holds it, so the splash stands with nothing listening yet.
  await page.route(/\/assets\/index-[^/]*\.js$/, async (route) => {
    await new Promise((done) => setTimeout(done, 3_000));
    await route.continue();
  });
  await page.goto('./', { waitUntil: 'commit' });
  await expect(page.locator('#boot')).toBeVisible({ timeout: 10_000 });
  await pinchAt(page, 720, 395, 1.6);
  await expect.poll(() => pageScale(page)).toBeGreaterThan(1.5);
  await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
  // Further in over Home's card it stays as it is; out again it comes back to 1. Playwright's box is in the zoomed view's
  // place, as the pinch's place is.
  const home = (await page.getByTestId('home').boundingBox())!;
  const zoomed = await pageScale(page);
  await pinchAt(page, home.x + home.width / 2, home.y + 40, 1.2);
  expect(await pageScale(page)).toBeCloseTo(zoomed, 3);
  await pinchAt(page, home.x + home.width / 2, home.y + 40, 1 / 1.6);
  await expect.poll(() => pageScale(page)).toBe(1);
});

// And over the map, as founding leaves the zoomed view all map: MapLibre's handler cancels every wheel it takes, so each pinch
// back zoomed the map, 14 to about 13.5 in five, and the page stayed at 1.6, its chips, dock and credit out of view (the
// systems audit's nineteenth round, on Inner Boston). Shown failing (TS-04) with a zoom out over the map left to the map.
test('a page zoomed by a pinch before the game’s code ran pinches back out over the map', async ({ page }) => {
  test.setTimeout(90_000);
  await page.route(/\/assets\/index-[^/]*\.js$/, async (route) => {
    await new Promise((done) => setTimeout(done, 3_000));
    await route.continue();
  });
  await page.goto('./', { waitUntil: 'commit' });
  await expect(page.locator('#boot')).toBeVisible({ timeout: 10_000 });
  await pinchAt(page, 720, 395, 1.6);
  await expect.poll(() => pageScale(page)).toBeGreaterThan(1.5);
  await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
  // A spot of the zoomed view on the map's canvas, in the zoomed view's own points, as the pinch's place is.
  const spot = await page.evaluate(() => {
    const v = window.visualViewport!;
    for (const [fx, fy] of [[0.5, 0.75], [0.8, 0.5], [0.2, 0.5], [0.5, 0.3], [0.8, 0.8], [0.2, 0.8]] as const) {
      const [x, y] = [Math.round(v.width * fx), Math.round(v.height * fy)];
      if (document.elementFromPoint(v.offsetLeft + x, v.offsetTop + y)?.closest('.maplibregl-canvas-container')) return { x, y };
    }
    return null;
  });
  expect(spot, 'a spot of the zoomed view on the map').not.toBeNull();
  await pinchAt(page, spot!.x, spot!.y, 1 / 1.6);
  await expect.poll(() => pageScale(page)).toBe(1);
});
