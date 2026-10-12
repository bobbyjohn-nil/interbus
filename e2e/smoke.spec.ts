import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

/** Distinct colours in a PNG, counted inside the page so no image library is needed. */
async function distinctColours(page: Page, png: Buffer): Promise<number> {
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 0;
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, img.width, img.height);
    const seen = new Set<number>();
    for (let i = 0; i < data.length; i += 16) seen.add((data[i]! << 16) | (data[i + 1]! << 8) | data[i + 2]!);
    return seen.size;
  }, png.toString('base64'));
}

const built = JSON.parse(readFileSync('dist/version.json', 'utf8')) as { sha: string };
const registry = JSON.parse(readFileSync('cities/index.json', 'utf8')) as { cities: { tiles: unknown }[] };
const boston = registry.cities[0];

test('the preview boots, names its build and draws Boston', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    // Failed responses are reported below with their URL instead.
    if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push(m.text());
  });
  page.on('response', (r) => {
    if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`);
  });

  await page.goto('./');

  // The build chip names this exact build (CLAUDE.md "The build chip").
  const chip = page.getByTestId('build-chip');
  await expect(chip).toHaveAttribute('data-sha', built.sha);
  await expect(chip).toHaveText(`build ${built.sha.slice(0, 7)}`);
  await expect(page.getByText('© OpenStreetMap contributors')).toBeVisible();

  // The interface is set in self-hosted Afacad Flux (D13).
  const faces = await page.evaluate(async () => {
    const loaded = await Promise.all(['400', '600'].map((w) => document.fonts.load(`${w} 14px "Afacad Flux"`)));
    return loaded.map((list) => list.filter((f) => f.family.replaceAll('"', '') === 'Afacad Flux').length);
  });
  expect(faces).toEqual([1, 1]);
  expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toContain('Afacad Flux');

  const map = page.getByTestId('map');
  if (boston?.tiles) {
    await expect(map).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    // The map must fill the window and actually draw the city, not merely exist (TS-07: a test
    // that passed while the thing drawn was invisible).
    const viewport = page.viewportSize()!;
    for (const box of [await map.boundingBox(), await page.locator('canvas.maplibregl-canvas').boundingBox()]) {
      expect(box?.width).toBeGreaterThanOrEqual(viewport.width * 0.99);
      expect(box?.height).toBeGreaterThanOrEqual(viewport.height * 0.99);
    }
    const colours = await distinctColours(page, await page.screenshot());
    expect(colours, 'distinct colours in the drawn map').toBeGreaterThan(50);
  } else {
    await expect(map).toHaveAttribute('data-status', 'no-city-file');
  }

  await expect(page.getByTestId('replaced-card')).toHaveCount(0);
  expect(errors).toEqual([]);
});
