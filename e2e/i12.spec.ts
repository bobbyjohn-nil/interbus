// I12 (PLAN §6, docs/specs/current.md item 6): 50 buses of each family heading away from the camera
// are each at least the family's minimum length at three cameras, at 1366×768 in the light theme,
// measured from the pixels drawn (TS-07); and the same check fails a 4 px glyph, so it can bite.
import { expect, test, type Page } from '@playwright/test';
import { createServer, type ViteDevServer } from 'vite';

const CAMERAS = [
  ['2D zoom 14', 14, 0],
  ['the T default (zoom 14, pitch 50°)', 14, 50],
  ['the mesh switch (zoom 17, pitch 60°)', 17, 60],
] as const;
const FAMILIES = [
  ['sparrow', 'Sparrow', 20],
  ['metro40', 'Metro 40', 24],
  ['goliath', 'Goliath', 32],
] as const;
const SPARROW_MIN_PX = 20;

let server: ViteDevServer;
test.beforeAll(async () => {
  server = await createServer({ root: 'e2e/i12', configFile: false, logLevel: 'error', server: { host: '127.0.0.1', port: 0 }, worker: { format: 'es' } });
  await server.listen();
});
test.afterAll(async () => server?.close());

/**
 * Every bus drawn: each patch of pixels that is not the land colour, measured along its own long
 * axis (perspective tilts buses away from the screen's centre, so a box's height would understate
 * them) and across it.
 */
async function measure(page: Page): Promise<{ boxes: { w: number; h: number }[]; changed: number }> {
  const png = (await page.locator('#map').screenshot()).toString('base64');
  return page.evaluate(async (data) => {
    const img = new Image();
    img.src = `data:image/png;base64,${data}`;
    await img.decode();
    const canvas = Object.assign(document.createElement('canvas'), { width: img.width, height: img.height });
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const { data: px, width, height } = ctx.getImageData(0, 0, img.width, img.height);
    const land = [0xeb, 0xe7, 0xdf];
    const on = new Uint8Array(width * height);
    let changed = 0;
    for (let i = 0; i < width * height; i++) {
      const d = Math.max(Math.abs(px[4 * i]! - land[0]!), Math.abs(px[4 * i + 1]! - land[1]!), Math.abs(px[4 * i + 2]! - land[2]!));
      if (d > 24) {
        on[i] = 1;
        changed++;
      }
    }
    const boxes: { w: number; h: number }[] = [];
    const seen = new Uint8Array(width * height);
    for (let start = 0; start < on.length; start++) {
      if (!on[start] || seen[start]) continue;
      const pts: [number, number][] = [];
      const stack = [start];
      seen[start] = 1;
      while (stack.length) {
        const i = stack.pop()!;
        const [x, y] = [i % width, Math.floor(i / width)];
        pts.push([x, y]);
        for (const j of [i - 1, i + 1, i - width, i + width]) {
          if (j >= 0 && j < on.length && on[j] && !seen[j] && Math.abs((j % width) - x) <= 1) {
            seen[j] = 1;
            stack.push(j);
          }
        }
      }
      // The long axis: the main direction of the pixels' spread; the length is their extent along it.
      const [mx, my] = pts.reduce(([a, b], [x, y]) => [a + x / pts.length, b + y / pts.length], [0, 0]);
      let [sxx, syy, sxy] = [0, 0, 0];
      for (const [x, y] of pts) [sxx, syy, sxy] = [sxx + (x - mx) ** 2, syy + (y - my) ** 2, sxy + (x - mx) * (y - my)];
      const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy);
      const [ux, uy] = [Math.cos(angle), Math.sin(angle)];
      const along = pts.map(([x, y]) => (x - mx) * ux + (y - my) * uy);
      const across = pts.map(([x, y]) => -(x - mx) * uy + (y - my) * ux);
      // Extents count whole pixels: the span between the outermost pixel centres, plus one.
      boxes.push({ h: Math.max(...along) - Math.min(...along) + 1, w: Math.max(...across) - Math.min(...across) + 1 });
    }
    return { boxes, changed };
  }, png);
}

/** I12's verdict: 50 buses, each at least the minimum long, and the layer changed ≥200 px. */
function i12(m: { boxes: { w: number; h: number }[]; changed: number }, minPx: number) {
  const short = m.boxes.filter((b) => b.h < minPx);
  return { ok: m.boxes.length === 50 && short.length === 0 && m.changed >= 200, buses: m.boxes.length, shortest: Math.round(Math.min(...m.boxes.map((b) => b.h)) * 10) / 10, changed: m.changed };
}

async function open(page: Page, query = '') {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(`${server.resolvedUrls!.local[0]}${query}`);
  await page.waitForFunction(() => window.i12Ready === true, null, { timeout: 30_000 });
}

for (const [family, label, minPx] of FAMILIES) {
  test(`every ${label} is at least ${minPx} px long at the three cameras (I12)`, async ({ page }) => {
    await open(page);
    for (const [name, zoom, pitch] of CAMERAS) {
      await page.evaluate(([z, p, f]) => window.i12Camera!(z, p, f), [zoom, pitch, family] as const);
      const verdict = i12(await measure(page), minPx);
      // The whole verdict, so a failure names the camera, the shortest bus and the pixels changed.
      test.info().annotations.push({ type: `${label}, ${name}`, description: `shortest ${verdict.shortest} px` });
      expect({ camera: name, ...verdict }).toEqual({ camera: name, ok: true, buses: 50, shortest: verdict.shortest, changed: verdict.changed });
      expect(verdict.shortest, name).toBeGreaterThanOrEqual(minPx);
    }
  });
}

test('the check fails a 4 px glyph (the meta-test)', async ({ page }) => {
  await open(page, '?length=4&width=2');
  await page.evaluate(() => window.i12Camera!(14, 0));
  const verdict = i12(await measure(page), SPARROW_MIN_PX);
  expect(verdict.ok).toBe(false);
  expect(verdict.shortest).toBeLessThan(SPARROW_MIN_PX);
});
