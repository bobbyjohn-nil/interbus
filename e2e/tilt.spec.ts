import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { foundCompany } from './found';

const registry = JSON.parse(readFileSync('cities/index.json', 'utf8')) as { cities: { tiles: unknown }[] };

// PLAN §14 week 2's exit check, "T tilts and returns", on the real map in a real browser.
test('T tilts the board to 50° with 3D buildings, and T again flattens it', async ({ page }) => {
  test.skip(!registry.cities[0]?.tiles, 'no city file in this build');
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  await page.goto('./?gpu=full'); // 3D needs the full rung; CI's browser draws in software (gpu.ts)
  const map = page.getByTestId('map');
  await expect(map).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
  await expect(map).toHaveAttribute('data-mode', '2d');
  // Founded first: until then the founding card's name field holds the keyboard.
  await foundCompany(page);
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

// The 2D/3D chip, the right-drag and the snap flat below 12° (the M5 spec, item 6; exit check 3).
test('the 2D/3D chip and a right-drag tilt the board, and a drag released below 12° snaps it flat', async ({ page }) => {
  test.skip(!registry.cities[0]?.tiles, 'no city file in this build');
  await page.goto('./?gpu=full');
  const map = page.getByTestId('map');
  await expect(map).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
  await foundCompany(page);
  const chip = page.getByTestId('mode-chip');
  await chip.getByRole('button', { name: '3D' }).click();
  await expect(map).toHaveAttribute('data-mode', '3d');
  await expect(map).toHaveAttribute('data-pitch', '50', { timeout: 30_000 });
  await expect(chip.getByRole('button', { name: '3D' })).toHaveAttribute('aria-pressed', 'true');
  await chip.getByRole('button', { name: '2D' }).click();
  await expect(map).toHaveAttribute('data-pitch', '0', { timeout: 30_000 });

  // A right-drag up 160 px pitches 40° (0.25° a pixel), and released it settles in 3D there.
  const box = (await map.boundingBox())!;
  const [x, y] = [box.width / 2, box.height / 2];
  await page.mouse.move(x, y);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(x, y - 80, { steps: 4 });
  await page.mouse.move(x, y - 160, { steps: 4 });
  await page.mouse.up({ button: 'right' });
  await expect(map).toHaveAttribute('data-mode', '3d');
  await expect(chip.getByRole('button', { name: '3D' })).toHaveAttribute('aria-pressed', 'true');
  await expect(map).toHaveAttribute('data-pitch', '40', { timeout: 30_000 });

  // Down 128 px leaves 8°, under the snap: the board flattens.
  await page.mouse.move(x, y);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(x, y + 128, { steps: 6 });
  await page.mouse.up({ button: 'right' });
  await expect(map).toHaveAttribute('data-mode', '2d');
  await expect(map).toHaveAttribute('data-pitch', '0', { timeout: 30_000 });
});

test('in Low graphics the chip stays at 2D and says why', async ({ page }) => {
  test.skip(!registry.cities[0]?.tiles, 'no city file in this build');
  await page.goto('./?gpu=low');
  const map = page.getByTestId('map');
  await expect(map).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
  const chip = page.getByTestId('mode-chip');
  await expect(chip).toHaveAttribute('title', 'Low graphics: the map stays flat on this computer');
  await expect(chip.getByRole('button', { name: '3D' })).toBeDisabled();
  await expect(chip.getByRole('button', { name: '2D' })).toHaveAttribute('aria-pressed', 'true');
});

// PLAN §5's height row: at zoom 15, where the map file draws every footprint, most buildings stand at
// a height of their own, OSM's or else Overture's, rather than the style's three storeys. Zoom 14's
// tiles keep mostly big buildings, which OSM tags, so the opening camera would not tell the files apart.
// Measured 2026-10-13 over Back Bay: 5,637 of 5,825 with Overture's heights joined, 2,536 of 5,819 before.
const MEASURED_SHARE = 0.9;

test('tilted at zoom 15, most buildings stand at their own height', async ({ page }) => {
  test.skip(!registry.cities[0]?.tiles, 'no city file in this build');
  await page.goto('./?gpu=full'); // 3D needs the full rung; CI's browser draws in software (gpu.ts)
  const map = page.getByTestId('map');
  await expect(map).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
  await foundCompany(page);
  const [, , opening] = (await map.getAttribute('data-view'))!.split(',').map(Number);
  const box = (await map.boundingBox())!;
  await page.mouse.click(box.width / 2, box.height * 0.3);
  await page.keyboard.press('=');
  await expect.poll(async () => Number((await map.getAttribute('data-view'))!.split(',')[2]), { timeout: 10_000 }).toBeCloseTo(opening! + 1, 2);

  await page.keyboard.press('t');
  await expect(map).toHaveAttribute('data-pitch', '50', { timeout: 30_000 });
  const drawn = Number(await map.getAttribute('data-buildings'));
  const measured = Number(await map.getAttribute('data-measured'));
  test.info().annotations.push({ type: 'buildings with a height', description: `${measured} of ${drawn}` });
  expect(drawn, '3D buildings drawn').toBeGreaterThan(0);
  expect(measured / drawn, `${measured} of ${drawn} buildings in view with a height`).toBeGreaterThanOrEqual(MEASURED_SHARE);
});
