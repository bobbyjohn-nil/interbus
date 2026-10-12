import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

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
    await expect(page.locator('canvas.maplibregl-canvas')).toBeVisible();
  } else {
    await expect(map).toHaveAttribute('data-status', 'no-city-file');
  }

  await expect(page.getByTestId('replaced-card')).toHaveCount(0);
  expect(errors).toEqual([]);
});
