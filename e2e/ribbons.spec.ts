// Buses ride their line's ribbon (render/map/sides.ts): a bus with its line's side on a street stands on the ribbon's middle as
// the route's line-offset draws it, flat and tilted, at the I12 cameras (PLAN §6), measured from the pixels drawn (TS-07). The
// bus was moved on the screen after its projection, the ribbon on the ground: flat the two agreed, but tilted the bus missed its
// ribbon by 3.7 px at pitch 50 and zoom 16, the ribbon 3 px wide on the screen there, and by up to 8.4 px at pitch 60 and zoom
// 17 (the change's review). Shown failing (TS-04) with the bus moved on the screen.
import { resolve } from 'node:path';
import { createServer, type ViteDevServer } from 'vite';
import { expect, test, type Page } from './base';
import type { RibbonCase } from './ribbons/main';

let server: ViteDevServer;
test.beforeAll(async () => {
  // The game's own fonts (npm run fonts), for the line's name.
  server = await createServer({ root: 'e2e/ribbons', publicDir: resolve('public'), configFile: false, logLevel: 'error', server: { host: '127.0.0.1', port: 0 }, worker: { format: 'es' } });
  await server.listen();
});
test.afterAll(async () => server?.close());

/** The drawn ink's mean offset across the street, in CSS px to the right of its way on the screen, within `reach` px of `anchor` along it. */
async function across(page: Page, anchor: readonly [number, number], dir: readonly [number, number], reach = 30): Promise<number> {
  const png = (await page.locator('#map').screenshot()).toString('base64');
  return page.evaluate(
    async ([data, anchor, dir, reach]) => {
      const img = new Image();
      img.src = `data:image/png;base64,${data}`;
      await img.decode();
      const canvas = Object.assign(document.createElement('canvas'), { width: img.width, height: img.height });
      const g = canvas.getContext('2d')!;
      g.drawImage(img, 0, 0);
      const { data: px, width, height } = g.getImageData(0, 0, img.width, img.height);
      const land = [0xeb, 0xe7, 0xdf];
      const length = Math.hypot(dir[0], dir[1]);
      const [ux, uy] = [dir[0] / length, dir[1] / length];
      let [weights, sum] = [0, 0];
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = 4 * (y * width + x);
          const ink = Math.max(Math.abs(px[i]! - land[0]!), Math.abs(px[i + 1]! - land[1]!), Math.abs(px[i + 2]! - land[2]!)) / 255;
          if (ink < 0.1) continue;
          const [dx, dy] = [x + 0.5 - anchor[0], y + 0.5 - anchor[1]];
          const [along, right] = [dx * ux + dy * uy, -dx * uy + dy * ux];
          if (Math.abs(along) > reach || Math.abs(right) > 80) continue;
          weights += ink;
          sum += ink * right;
        }
      }
      return weights > 0 ? sum / weights : Number.NaN;
    },
    [png, anchor, dir, reach] as const,
  );
}

// The I12 cameras, with a street across the map's middle, near its top and near its foot, at several headings.
const CASES: readonly (Omit<RibbonCase, 'show'> & { readonly name: string })[] = [
  { name: '2D zoom 14, heading 0', zoom: 14, pitch: 0, heading: 0, side: 1.5, at: [0.5, 0.5] },
  { name: '2D zoom 14, heading 135, the other side', zoom: 14, pitch: 0, heading: 135, side: -1, at: [0.5, 0.5] },
  { name: 'the T default, heading 45, the middle', zoom: 14, pitch: 50, heading: 45, side: 1.5, at: [0.5, 0.5] },
  { name: 'the T default, heading 90, near the top', zoom: 14, pitch: 50, heading: 90, side: 1.5, at: [0.5, 0.2] },
  { name: 'the T default, heading 0, near the foot', zoom: 14, pitch: 50, heading: 0, side: 1.5, at: [0.5, 0.85] },
  { name: 'the mesh switch, heading 90, the middle', zoom: 17, pitch: 60, heading: 90, side: 1.5, at: [0.5, 0.5] },
  { name: 'the mesh switch, heading 45, near the top', zoom: 17, pitch: 60, heading: 45, side: 1.5, at: [0.5, 0.2] },
];

test('a bus with its line’s side stands on the ribbon’s middle, flat and tilted, at the I12 cameras', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(server.resolvedUrls!.local[0]!);
  await page.waitForFunction(() => window.ribbonsReady === true, null, { timeout: 60_000 });
  for (const { name, ...c } of CASES) {
    const ribbon = await page.evaluate((c) => window.ribbonCase!({ ...c, show: 'ribbon' }), c);
    const onRibbon = await across(page, ribbon.anchor, ribbon.dir);
    const bus = await page.evaluate((c) => window.ribbonCase!({ ...c, show: 'bus' }), c);
    const onBus = await across(page, bus.anchor, bus.dir);
    // The ribbon stands its side's ribbons over, so it was drawn at all, and the bus on its middle to a pixel and a half.
    expect.soft(Math.abs(onRibbon), `${name}: the ribbon off the street's middle`).toBeGreaterThan(2);
    expect.soft(Math.abs(onBus - onRibbon), `${name}: the bus ${onBus.toFixed(2)} px across, its ribbon ${onRibbon.toFixed(2)}`).toBeLessThan(1.5);
  }
});

// A line's name stands on its own ribbon, where the line's place on the street puts it (overlays.ts NAME_LAYOUT): in the street's
// middle, on Tremont Street every name of Lines 2, 5 and 9 side by side stood over Line 5's ribbon, Line 2's 9.8 px from its own
// (the systems audit's twenty-first round). Either way up: MapLibre turns a line's words to read upright, and keeps their offset on
// the same side of the line. Shown failing (TS-04) with the names in the street's middle.
const NAMES: readonly (Pick<RibbonCase, 'zoom' | 'heading' | 'side'> & { readonly name: string })[] = [
  { name: 'zoom 16, heading 90, to the right', zoom: 16, heading: 90, side: 1.5 },
  { name: 'zoom 16, heading 270, the words turned the other way up', zoom: 16, heading: 270, side: 1.5 },
  { name: 'zoom 16, heading 20, to the left', zoom: 16, heading: 20, side: -1 },
  { name: 'zoom 16, heading 200, to the left, the other way up', zoom: 16, heading: 200, side: -1 },
  { name: 'zoom 14.5, heading 135, two places over', zoom: 14.5, heading: 135, side: 2 },
];

test('a line’s name stands on its own ribbon, either way up', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(server.resolvedUrls!.local[0]!);
  await page.waitForFunction(() => window.ribbonsReady === true, null, { timeout: 60_000 });
  for (const { name, ...c } of NAMES) {
    const at = { ...c, pitch: 0, at: [0.5, 0.5] as const };
    const ribbon = await page.evaluate((c) => window.ribbonCase!({ ...c, show: 'ribbon' }), at);
    const onRibbon = await across(page, ribbon.anchor, ribbon.dir, 160);
    const words = await page.evaluate((c) => window.ribbonCase!({ ...c, show: 'name' }), at);
    const onName = await across(page, words.anchor, words.dir, 160);
    expect.soft(Math.abs(onRibbon), `${name}: the ribbon off the street's middle`).toBeGreaterThan(2);
    expect.soft(Math.abs(onName - onRibbon), `${name}: the name ${onName.toFixed(2)} px across, its ribbon ${onRibbon.toFixed(2)}`).toBeLessThan(1.5);
  }
});

// MapLibre joins the lines of line labels that share an end and their words before it places them (symbol_bucket's mergeLines),
// keeping the first one's properties, so a line's name along a run that met another of its runs end to end stood at the other's
// place: drawn after a 30 m run on the other side, a long run's name stood 14 px off its ribbon at zoom 16 (#201's review). Each
// name stops short of its run's ends now (overlays.ts shortOfEnds). Shown failing (TS-04) with the runs' own ends.
for (const zoom of [16, 14.5, 12.5]) {
  test(`a line’s name keeps its own run’s place where that run meets another of its runs, zoom ${zoom}`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(server.resolvedUrls!.local[0]!);
    await page.waitForFunction(() => window.ribbonsReady === true, null, { timeout: 60_000 });
    const at = { zoom, pitch: 0, heading: 90, side: 1.5, at: [0.5, 0.5] as const };
    const ribbon = await page.evaluate((c) => window.ribbonCase!({ ...c, show: 'ribbon' }), at);
    const onRibbon = await across(page, ribbon.anchor, ribbon.dir, 160);
    const words = await page.evaluate((c) => window.ribbonCase!({ ...c, show: 'joined' }), at);
    const onName = await across(page, words.anchor, words.dir, 160);
    expect(Math.abs(onName - onRibbon), `the name ${onName.toFixed(2)} px across, its run's ribbon ${onRibbon.toFixed(2)}`).toBeLessThan(1.5);
  });
}
