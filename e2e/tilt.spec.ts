import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const registry = JSON.parse(readFileSync('cities/index.json', 'utf8')) as { cities: { tiles: unknown }[] };

// PLAN §14 week 2's exit check, "T tilts and returns", on the real map in a real browser.
test('T tilts the board to 50° with 3D buildings, and T again flattens it', async ({ page }) => {
  test.skip(!registry.cities[0]?.tiles, 'no city file in this build');
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  await page.goto('./');
  const map = page.getByTestId('map');
  await expect(map).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
  await expect(map).toHaveAttribute('data-mode', '2d');
  const shot = () => page.screenshot({ mask: [page.locator('.corner')] });
  const flat = await shot();

  await page.keyboard.press('t');
  await expect(map).toHaveAttribute('data-mode', '3d');
  await expect(map).toHaveAttribute('data-pitch', '50', { timeout: 30_000 });
  // Drawn, not merely switched on (TS-07): extrusions in view once the tilted camera settles.
  expect(Number(await map.getAttribute('data-buildings')), '3D buildings drawn').toBeGreaterThan(0);
  const tilted = await shot();
  expect(tilted.equals(flat), 'the tilted board looks different').toBe(false);

  await page.keyboard.press('Shift+T');
  await expect(map).toHaveAttribute('data-mode', '2d');
  await expect(map).toHaveAttribute('data-pitch', '0', { timeout: 30_000 });
  expect(Number(await map.getAttribute('data-buildings')), 'flat buildings drawn').toBeGreaterThan(0);

  expect(errors).toEqual([]);
});
