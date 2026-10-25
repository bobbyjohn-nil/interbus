// A trackpad's pinch zooms the map alone (src/ui/pinch.ts). Chrome sends a pinch as wheel events with ctrlKey, and uncancelled
// over a panel or Home's card they zoomed the whole page, 1.6 times at a pinch, the chips, the dock and the map's credit out of
// view, and Chrome kept the page zoomed through a reload (the systems audit's seventeenth round). CDP's synthesizePinchGesture with
// the mouse as its source is Chrome's own touchpad pinch, as a Mac's trackpad sends it, at a Mac's scale factor. Shown failing
// (TS-04) with no cancel: the page's scale read 1.6 after a pinch over Home's card and over Finance. And a page zoomed before the
// game's code ran, by a pinch over the splash, pinches back out (the eighteenth round): shown failing with every pinch off the
// map cancelled, the page's scale stayed 1.6.
import { expect, test, type Page } from './base';
import { foundCompany } from './found';

test.use({ viewport: { width: 1440, height: 790 }, deviceScaleFactor: 2 });

/** A trackpad's pinch at (x, y), spreading the fingers `scale` times apart. */
async function pinchAt(page: Page, x: number, y: number, scale: number): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.synthesizePinchGesture', { x, y, scaleFactor: scale, relativeSpeed: 800, gestureSourceType: 'mouse' });
  await cdp.detach();
}

/** How far the page itself is zoomed by a pinch (the visual viewport), 1 when it is not. */
const pageScale = (page: Page) => page.evaluate(() => window.visualViewport!.scale);
/** The map's zoom, as its view reads once it has moved. */
const mapZoom = async (page: Page) => Number((await page.getByTestId('map').getAttribute('data-view'))!.split(',')[2]);

test('a pinch over Home’s card or a panel leaves the page as it is, and over the map zooms the map', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('./');
  await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
  const home = (await page.getByTestId('home').boundingBox())!;
  await pinchAt(page, home.x + home.width / 2, home.y + 40, 1.6);
  expect(await pageScale(page)).toBe(1);
  await foundCompany(page);
  await page.getByRole('button', { name: 'Finance', exact: true }).click();
  const finance = (await page.getByTestId('finance').boundingBox())!;
  await pinchAt(page, finance.x + finance.width / 2, finance.y + finance.height / 2, 1.6);
  expect(await pageScale(page)).toBe(1);
  await expect(page.locator('.corner')).toBeInViewport({ ratio: 1 });
  // Over the map the pinch is the map's, as before: it zooms in, the page as it was.
  const before = await mapZoom(page);
  await pinchAt(page, 300, 400, 1.6);
  await expect.poll(() => mapZoom(page)).toBeGreaterThan(before);
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
  // Out again over Home's card: Playwright's box is in the zoomed view's place, as the pinch's place is.
  const home = (await page.getByTestId('home').boundingBox())!;
  await pinchAt(page, home.x + home.width / 2, home.y + 40, 1 / 1.6);
  await expect.poll(() => pageScale(page)).toBeLessThan(1.01);
});
