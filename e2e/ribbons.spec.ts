// Buses ride their line's ribbon (render/map/sides.ts): a bus with its line's side on a street stands on the ribbon's middle as
// the route's line-offset draws it, flat and tilted, at the I12 cameras (PLAN §6), measured from the pixels drawn (TS-07). The
// bus was moved on the screen after its projection, the ribbon on the ground: flat the two agreed, but tilted the bus missed its
// ribbon by 3.7 px at pitch 50 and zoom 16, the ribbon 3 px wide on the screen there, and by up to 8.4 px at pitch 60 and zoom
// 17 (the change's review). Shown failing (TS-04) with the bus moved on the screen.
import { resolve } from 'node:path';
import { createServer, type ViteDevServer } from 'vite';
import { expect, test, type Page } from './base';
import { NAME_REACH_PX, nameOnGround } from '../src/render/map/overlays';
import { ribbonPx } from '../src/render/map/sides';
import type { RibbonCase } from './ribbons/main';

let server: ViteDevServer;
test.beforeAll(async () => {
  // The game's own fonts (npm run fonts), for the line's name.
  server = await createServer({ root: 'e2e/ribbons', publicDir: resolve('public'), configFile: false, logLevel: 'error', server: { host: '127.0.0.1', port: 0 }, worker: { format: 'es' } });
  await server.listen();
});
test.afterAll(async () => server?.close());

/**
 * The drawn ink across the street, within `reach` px of `anchor` along it, in 1 px bins by its offset to the right of the street's way
 * on the screen, in CSS px: each bin's ink of a tenth or more, that ink times its offset, and its most ink at any one pixel, each
 * pixel's ink 0 to 1 from the land's colour.
 */
async function inkAcross(page: Page, anchor: readonly [number, number], dir: readonly [number, number], reach: number): Promise<[number, { ink: number; moment: number; most: number }][]> {
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
      const bins = new Map<number, { ink: number; moment: number; most: number }>();
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = 4 * (y * width + x);
          const ink = Math.max(Math.abs(px[i]! - land[0]!), Math.abs(px[i + 1]! - land[1]!), Math.abs(px[i + 2]! - land[2]!)) / 255;
          const [dx, dy] = [x + 0.5 - anchor[0], y + 0.5 - anchor[1]];
          const [along, right] = [dx * ux + dy * uy, -dx * uy + dy * ux];
          if (ink === 0 || Math.abs(along) > reach || Math.abs(right) > 80) continue;
          // Its ink and moment of a tenth or more only, as the faint edge of a mark's antialiasing would pull a mean.
          const [bin, strong] = [bins.get(Math.round(right)) ?? { ink: 0, moment: 0, most: 0 }, ink >= 0.1];
          bins.set(Math.round(right), { ink: bin.ink + (strong ? ink : 0), moment: bin.moment + (strong ? ink * right : 0), most: Math.max(bin.most, ink) });
        }
      }
      return [...bins].sort((x, y) => x[0] - y[0]);
    },
    [png, anchor, dir, reach] as const,
  );
}

/**
 * Where on the map, in CSS px, each pixel of drawn ink lies, a twentieth of ink or more, within `reach` px of `anchor` along the
 * street and 80 across: read from a picture of that box alone, which at twice the pixels a whole map's picture takes long to read.
 */
async function inkedPixels(page: Page, anchor: readonly [number, number], dir: readonly [number, number], reach: number): Promise<[number, number][]> {
  const length = Math.hypot(dir[0], dir[1]);
  const [ux, uy] = [dir[0] / length, dir[1] / length];
  const corners = [-1, 1].flatMap((a) => [-1, 1].map((c) => [anchor[0] + a * reach * ux - c * 80 * uy, anchor[1] + a * reach * uy + c * 80 * ux] as const));
  const { width, height } = page.viewportSize()!;
  const [x0, x1] = [Math.max(0, Math.floor(Math.min(...corners.map((p) => p[0])))), Math.min(width, Math.ceil(Math.max(...corners.map((p) => p[0]))))];
  const [y0, y1] = [Math.max(0, Math.floor(Math.min(...corners.map((p) => p[1])))), Math.min(height, Math.ceil(Math.max(...corners.map((p) => p[1]))))];
  const clip = { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
  // The map fills the page from its corner, so the page's pixels are the map's.
  const png = (await page.screenshot({ clip })).toString('base64');
  return page.evaluate(
    async ([data, anchor, dir, reach, clip]) => {
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
      const inked: [number, number][] = [];
      const dpr = width / clip.width;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = 4 * (y * width + x);
          const ink = Math.max(Math.abs(px[i]! - land[0]!), Math.abs(px[i + 1]! - land[1]!), Math.abs(px[i + 2]! - land[2]!)) / 255;
          const [cx, cy] = [clip.x + (x + 0.5) / dpr, clip.y + (y + 0.5) / dpr];
          const [dx, dy] = [cx - anchor[0], cy - anchor[1]];
          if (ink >= 0.05 && Math.abs(dx * ux + dy * uy) <= reach && Math.abs(-dx * uy + dy * ux) <= 80) inked.push([cx, cy]);
        }
      }
      return inked;
    },
    [png, anchor, dir, reach, clip] as const,
  );
}

/** The drawn ink's mean offset across the street, in CSS px to the right of its way on the screen, within `reach` px of `anchor` along it and, given `from`, from that offset on. */
async function across(page: Page, anchor: readonly [number, number], dir: readonly [number, number], reach = 30, from = -80): Promise<number> {
  let [weights, sum] = [0, 0];
  for (const [bin, { ink, moment }] of await inkAcross(page, anchor, dir, reach)) {
    if (bin < from) continue;
    weights += ink;
    sum += moment;
  }
  return weights > 0 ? sum / weights : Number.NaN;
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

// MapLibre joins the lines of line labels that share their words and an end before it places them (merge_lines.ts, keyed by the
// words and the point), keeping the first one's properties, so a line's name along a run that met another of its runs end to end
// stood at the other's place: drawn after a 30 m run on the other side, a long run's name stood 14 px off its ribbon at zoom 16
// (#201's review). Stopped 5 m short of their ends, a run that turned back along the street it came in on still met the next at
// one point, and a tile's edge across a street a line drives both ways is an end its two runs there share, which no shortening
// reaches (the systems audit's twenty-second round). Each run's name has words of its own now (overlays.ts nameFeatures). Shown
// failing (TS-04) with the line's name alone: with the runs' own ends, `joined` and `turned`, and stopped short of them, `turned`
// and `both`.
const MEETS = [
  ...[16, 14.5, 12.5].flatMap((zoom) => (['joined', 'turned'] as const).map((show) => ({ show, zoom, side: 1.5, from: -80 }))),
  // Both ways along the street, which crosses the edges of the tile under the screen's middle: the run on, 3 ribbons right of the
  // way, measured on its side of the street's middle, where the run back's names stand 1.5 left of it.
  { show: 'both' as const, zoom: 16, side: 3, from: 0 },
];
for (const { show, zoom, side, from } of MEETS) {
  test(`a line’s name keeps its own run’s place where that run meets another of its runs, ${show}, zoom ${zoom}`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(server.resolvedUrls!.local[0]!);
    await page.waitForFunction(() => window.ribbonsReady === true, null, { timeout: 60_000 });
    const at = { zoom, pitch: 0, heading: 90, side, at: [0.5, 0.5] as const };
    const ribbon = await page.evaluate((c) => window.ribbonCase!({ ...c, show: 'ribbon' }), at);
    const onRibbon = await across(page, ribbon.anchor, ribbon.dir, 160, from);
    const words = await page.evaluate(([c, show]) => window.ribbonCase!({ ...c, show }), [at, show] as const);
    const onName = await across(page, words.anchor, words.dir, 160, from);
    expect(Math.abs(onName - onRibbon), `the name ${onName.toFixed(2)} px across, its run's ribbon ${onRibbon.toFixed(2)}`).toBeLessThan(1.5);
  });
}

// A click on a line's name counts within NAME_REACH_PX of its ribbon's middle (loadMap.ts), as far as its words and their halo
// reach: MapLibre finds a name anywhere in its padded box, 8 px either way, and a click there on a neighbour's ribbon listed the
// name's line first (the systems audit's twenty-second round). The words and their 2 px halo reach 5 to 6 px either way.
test('a line’s name reaches NAME_REACH_PX either side of its ribbon’s middle, and no further', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(server.resolvedUrls!.local[0]!);
  await page.waitForFunction(() => window.ribbonsReady === true, null, { timeout: 60_000 });
  for (const c of [
    { zoom: 16, heading: 90, side: 1.5 },
    { zoom: 16, heading: 200, side: -1 },
    { zoom: 13, heading: 20, side: 2 },
    { zoom: 17, heading: 270, side: 0.5 },
  ]) {
    const at = { ...c, pitch: 0, at: [0.5, 0.5] as const };
    const ribbon = await page.evaluate((c) => window.ribbonCase!({ ...c, show: 'ribbon' }), at);
    const middle = await across(page, ribbon.anchor, ribbon.dir, 160);
    const words = await page.evaluate((c) => window.ribbonCase!({ ...c, show: 'name' }), at);
    // Drawn: a twentieth of ink or more at a pixel, the white halo's edge two fifths drawn over the land (wholly drawn, an eighth).
    const drawn = (await inkAcross(page, words.anchor, words.dir, 160)).filter(([, b]) => b.most >= 0.05).map(([bin]) => bin - middle);
    // Its reach either way, half its breadth, and its furthest: below zoom 16 a name strays from its ribbon by up to half a pixel a
    // place (overlays.ts nameOffset), 4 px one way and 6 the other at zoom 13 two places out.
    const [up, down] = [-Math.min(...drawn), Math.max(...drawn)];
    const message = `${JSON.stringify(c)}: the name ${up.toFixed(1)} px up and ${down.toFixed(1)} px down from its ribbon's middle`;
    expect.soft((up + down) / 2, message).toBeLessThanOrEqual(NAME_REACH_PX);
    expect.soft((up + down) / 2, message).toBeGreaterThanOrEqual(NAME_REACH_PX - 1.5);
    expect.soft(Math.max(up, down), message).toBeLessThanOrEqual(NAME_REACH_PX + (c.zoom < 16 ? 0.5 * Math.abs(c.side) : 0));
  }
});

// Tilted, MapLibre lays a name's words larger on the ground toward the view's top and smaller toward its foot, its middle further
// out or nearer in with them, and its halo as wide, while line-offset keeps the ribbons as wide (overlays.ts nameOnGround): at
// pitch 60, 47 of 260 pixels of names' letters near the view's top lay past NAME_REACH_PX of their ribbon's middle, nearer another
// line's, and a click on them listed that line first; at the foot up to 4 rows beside a name counted as the name (the systems
// audit's twenty-third round; #203's review). On the ground, a tilted name stands where nameOnGround puts its middle, and its words
// and halo reach no further than its reach, and not 3 px short of it. Each street runs across the screen, so the camera's distance
// holds along it, drawn at twice the pixels, as a name near a tilted view's top is 3 px tall, a pixel down the screen there 8 px
// on the ground, which is why it stops 3 px short at most and not less. A name three places out at the top stands where the glyphs'
// scale would put it 3.6 px off (the review: in the middle, or two places out, the tests told the two apart by too little). Shown
// failing (TS-04) with nameOnGround flat.
test.describe(() => {
  test.use({ deviceScaleFactor: 2 });
  test('a tilted line’s name stands and reaches on the ground where nameOnGround lays it, toward the view’s top and its foot', async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(server.resolvedUrls!.local[0]!);
    await page.waitForFunction(() => window.ribbonsReady === true, null, { timeout: 60_000 });
    for (const c of [
      { zoom: 16, pitch: 60, heading: 90, side: 0, at: [0.5, 0.06] as const },
      { zoom: 16, pitch: 60, heading: 90, side: 2, at: [0.5, 0.06] as const },
      { zoom: 16, pitch: 60, heading: 270, side: 1.5, at: [0.5, 0.15] as const },
      { zoom: 17, pitch: 50, heading: 90, side: -1.5, at: [0.5, 0.1] as const },
      { zoom: 16, pitch: 60, heading: 90, side: -1, at: [0.5, 0.92] as const },
      { zoom: 16, pitch: 60, heading: 90, side: 3, at: [0.5, 0.06] as const },
      { zoom: 16, pitch: 60, heading: 270, side: -2, at: [0.5, 0.1] as const },
    ]) {
      const words = await page.evaluate((c) => window.ribbonCase!({ ...c, show: 'name' }), c);
      const { k } = (await page.evaluate((p) => window.groundOf!(p), [words.anchor]))[0]!;
      const laid = nameOnGround(k);
      const across = (await page.evaluate((p) => window.groundOf!(p), await inkedPixels(page, words.anchor, words.dir, 2000))).map((g) => g.across);
      const middle = c.side * ribbonPx(c.zoom) * laid.offset;
      const [up, down] = [middle - Math.min(...across), Math.max(...across) - middle];
      const message = `${JSON.stringify(c)}, ${k.toFixed(2)} world px a screen px: the name from ${(-up).toFixed(1)} to ${down.toFixed(1)} px about ${middle.toFixed(1)} on the ground, its reach ${laid.reach.toFixed(1)}`;
      expect.soft(across.length, message).toBeGreaterThan(200);
      expect.soft(Math.abs((down - up) / 2), message).toBeLessThanOrEqual(1.5);
      expect.soft(Math.max(up, down), message).toBeLessThanOrEqual(laid.reach + 1);
      expect.soft((up + down) / 2, message).toBeGreaterThanOrEqual(laid.reach - 3);
    }
  });
});
