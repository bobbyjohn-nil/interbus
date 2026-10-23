import { readFileSync } from 'node:fs';
import { expect, test, type Page } from './base';
import { foundCompany } from './found';
import { bootGone, build } from './shell';

const registry = JSON.parse(readFileSync('cities/index.json', 'utf8')) as { cities: { tiles: unknown }[] };

// PLAN §14 week 2's exit check, "T tilts and returns", on the real map in a real browser.
test('T tilts the board to 50° with 3D buildings, and T again flattens it', async ({ page }) => {
  test.skip(!registry.cities[0]?.tiles, 'no city file in this build');
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  // 3D needs the full rung; CI's browser draws in software (gpu.ts). The map counts the buildings it draws only when asked.
  await page.goto('./?gpu=full&counts');
  const map = page.getByTestId('map');
  await expect(map).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
  await expect(map).toHaveAttribute('data-mode', '2d');
  // Founded first: until then the founding card's name field holds the keyboard.
  await foundCompany(page);
  const shot = () => page.screenshot({ mask: [page.locator('.corner')] });
  await bootGone(page);
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

// The systems audit's twelfth round: the buildings in view were counted as each tilt settled, for the tests above alone, and
// the count took 130–217 ms of the tilt on Inner Boston, over the 200 ms of a long task.
test('a player’s page counts no buildings as a tilt settles', async ({ page }) => {
  await page.goto('./?gpu=full');
  const map = page.getByTestId('map');
  await expect(map).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
  await foundCompany(page);
  await page.keyboard.press('t');
  await expect(map).toHaveAttribute('data-pitch', '50', { timeout: 30_000 });
  await page.keyboard.press('Shift+T');
  await expect(map).toHaveAttribute('data-pitch', '0', { timeout: 30_000 });
  expect([await map.getAttribute('data-buildings'), await map.getAttribute('data-measured')]).toEqual(['', '']);
});

// The compass, the right-drag and the snap flat below 12° (the M5 spec, item 6; exit check 3). The
// compass replaced the 2D/3D chip (D25).
test('the compass and a right-drag tilt the board, and a drag released below 12° snaps it flat', async ({ page }) => {
  test.skip(!registry.cities[0]?.tiles, 'no city file in this build');
  await page.goto('./?gpu=full');
  const map = page.getByTestId('map');
  await expect(map).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
  await foundCompany(page);
  const compass = page.getByTestId('compass');
  await expect(compass).toHaveAccessibleName('Tilt to 3D (T, or double-click and hold)');
  await compass.click();
  await expect(map).toHaveAttribute('data-mode', '3d');
  await expect(map).toHaveAttribute('data-pitch', '50', { timeout: 30_000 });
  await expect(compass).toHaveAttribute('data-mode', '3d');
  await expect(compass).toHaveAccessibleName('Flatten to 2D (T)');
  await compass.click();
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
  await expect(compass).toHaveAttribute('data-mode', '3d');
  await expect(map).toHaveAttribute('data-pitch', '40', { timeout: 30_000 });

  // Down 128 px leaves 8°, under the snap: the board flattens.
  await page.mouse.move(x, y);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(x, y + 128, { steps: 6 });
  await page.mouse.up({ button: 'right' });
  await expect(map).toHaveAttribute('data-mode', '2d');
  await expect(map).toHaveAttribute('data-pitch', '0', { timeout: 30_000 });
});

/** A double-click whose second press stays down: the first click, then the second press at the same spot. */
async function doubleDown(page: Page, x: number, y: number) {
  await page.mouse.move(x, y);
  await page.mouse.down({ clickCount: 1 });
  await page.mouse.up({ clickCount: 1 });
  await page.mouse.down({ clickCount: 2 });
}

// The owner's initial playtest (D25): "it would be nice to just hold double click down and be able to
// switch". Shown failing (TS-04) on the old map, where the held press panned the board, its release
// zoomed a step and the mode stayed 2D; and with the dblclick left to MapLibre, where the zoom moved.
test('a double-click held and dragged tilts the board without zooming or panning; held still it flips; a quick one still zooms', async ({ page }) => {
  test.skip(!registry.cities[0]?.tiles, 'no city file in this build');
  await page.goto('./?gpu=full');
  const map = page.getByTestId('map');
  await expect(map).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
  await foundCompany(page);
  const box = (await map.boundingBox())!;
  const [x, y] = [box.width / 2, box.height / 2];
  const view = async () => (await map.getAttribute('data-view'))!;
  const before = await view();

  // Held and dragged up 160 px: 40°, the centre and zoom where they were.
  await doubleDown(page, x, y);
  await page.mouse.move(x, y - 80, { steps: 4 });
  await page.mouse.move(x, y - 160, { steps: 4 });
  await page.mouse.up({ clickCount: 2 });
  await expect(map).toHaveAttribute('data-mode', '3d');
  await expect(map).toHaveAttribute('data-pitch', '40', { timeout: 30_000 });
  await page.waitForTimeout(500); // a zoom the dblclick started would have ended by now
  const [lon0, lat0, zoom0] = before.split(',').map(Number);
  const [lon1, lat1, zoom1] = (await view()).split(',').map(Number);
  expect(zoom1).toBeCloseTo(Math.max(zoom0!, 14), 2);
  expect(lon1).toBeCloseTo(lon0!, 4);
  expect(lat1).toBeCloseTo(lat0!, 4);

  // Held still for 0.6 s: it flips to 2D, and the zoom stays.
  await doubleDown(page, x, y);
  await page.waitForTimeout(600);
  await page.mouse.up({ clickCount: 2 });
  await expect(map).toHaveAttribute('data-mode', '2d');
  await expect(map).toHaveAttribute('data-pitch', '0', { timeout: 30_000 });
  await page.waitForTimeout(500);
  expect(Number((await view()).split(',')[2])).toBeCloseTo(zoom1!, 2);

  // A quick double-click zooms in one step, as it always did.
  await page.mouse.dblclick(x, y);
  await expect.poll(async () => Number((await view()).split(',')[2]), { timeout: 10_000 }).toBeCloseTo(zoom1! + 1, 2);
  await expect(map).toHaveAttribute('data-mode', '2d');
});

test('with a tool out, a held double-click is clicks, not a tilt', async ({ page }) => {
  test.skip(!registry.cities[0]?.tiles, 'no city file in this build');
  await page.goto('./?gpu=full');
  const map = page.getByTestId('map');
  await expect(map).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
  await foundCompany(page);
  await build(page, 'Draw a line');
  const box = (await map.boundingBox())!;
  const [x, y] = [box.width / 2, box.height / 2];
  await doubleDown(page, x, y);
  await page.mouse.move(x, y - 160, { steps: 6 });
  await page.mouse.up({ clickCount: 2 });
  await page.waitForTimeout(800);
  await expect(map).toHaveAttribute('data-mode', '2d');
});

// D25: "you also can't rotate when in 3d mode, you can only look from the south to north". Shown
// failing (TS-04) on the old map, where a sideways right-drag left the bearing at 0.
test('in 3D a sideways drag and Q and E turn the board; the compass and N face north; flattening faces north', async ({ page }) => {
  test.skip(!registry.cities[0]?.tiles, 'no city file in this build');
  await page.goto('./?gpu=full');
  const map = page.getByTestId('map');
  await expect(map).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
  await foundCompany(page);
  const compass = page.getByTestId('compass');
  const box = (await map.boundingBox())!;
  const [x, y] = [box.width / 2, box.height / 2];

  // In 2D a sideways drag leaves the board facing north.
  await page.mouse.move(x, y);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(x + 150, y, { steps: 6 });
  await page.mouse.up({ button: 'right' });
  await expect(map).toHaveAttribute('data-bearing', '0');
  await expect(map).toHaveAttribute('data-mode', '2d');

  await page.keyboard.press('t');
  await expect(map).toHaveAttribute('data-pitch', '50', { timeout: 30_000 });
  await page.mouse.move(x, y);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(x + 75, y, { steps: 4 });
  await page.mouse.move(x + 150, y, { steps: 4 });
  await page.mouse.up({ button: 'right' });
  await expect(map).toHaveAttribute('data-bearing', '120', { timeout: 10_000 }); // 0.8° a pixel
  await expect(map).toHaveAttribute('data-mode', '3d');
  await expect(compass).toHaveAccessibleName('Face north (N)');
  await compass.click();
  await expect(map).toHaveAttribute('data-bearing', '0', { timeout: 10_000 });
  await expect(map).toHaveAttribute('data-mode', '3d');

  await page.keyboard.press('e');
  await expect(map).toHaveAttribute('data-bearing', '15', { timeout: 10_000 });
  await page.keyboard.press('q');
  await page.keyboard.press('q');
  await expect(map).toHaveAttribute('data-bearing', '-15', { timeout: 10_000 });
  await page.keyboard.press('n');
  await expect(map).toHaveAttribute('data-bearing', '0', { timeout: 10_000 });

  await page.keyboard.press('e');
  await expect(map).toHaveAttribute('data-bearing', '15', { timeout: 10_000 });
  await page.keyboard.press('t');
  await expect(map).toHaveAttribute('data-mode', '2d');
  await expect(map).toHaveAttribute('data-pitch', '0', { timeout: 30_000 });
  await expect(map).toHaveAttribute('data-bearing', '0');
  // Flat, Q and E do nothing.
  await page.keyboard.press('e');
  await page.waitForTimeout(400);
  await expect(map).toHaveAttribute('data-bearing', '0');
});

// The systems audit (D26): a key or a drag inside the 600 ms tilt stopped the ease where it was, leaving
// 3D flat (T then E or N) or 2D tilted and turned (T then a pan), which N, Q and E could not fix since
// they act only in 3D. Shown failing (TS-04) on the old map: data-pitch read 0 in 3D, and 50 in 2D.
test('a mode change cut short by a turn or a pan still ends tilted in 3D, and flat and facing north in 2D', async ({ page }) => {
  test.skip(!registry.cities[0]?.tiles, 'no city file in this build');
  await page.goto('./?gpu=full');
  const map = page.getByTestId('map');
  await expect(map).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
  await foundCompany(page);
  const box = (await map.boundingBox())!;
  const [x, y] = [box.width / 2, box.height / 2];
  await page.mouse.move(x, y);

  // T, then E at once, while the board has hardly begun to tilt: 3D at 50°, turned 15°. (E pressed after
  // the tilt passes 25° would leave a 3D board resettle has no reason to move.)
  await page.keyboard.press('t');
  await page.keyboard.press('e');
  await expect(map).toHaveAttribute('data-mode', '3d');
  await expect(map).toHaveAttribute('data-pitch', '50', { timeout: 30_000 });
  await expect(map).toHaveAttribute('data-bearing', '15');

  // T, then a pan while it flattens: flat and facing north.
  await page.keyboard.press('t');
  await page.waitForTimeout(100);
  await page.mouse.down();
  await page.mouse.move(x - 60, y, { steps: 3 });
  await page.mouse.up();
  await expect(map).toHaveAttribute('data-mode', '2d');
  await expect(map).toHaveAttribute('data-pitch', '0', { timeout: 30_000 });
  await expect(map).toHaveAttribute('data-bearing', '0');
});

test('in Low graphics the compass is off and says why', async ({ page }) => {
  test.skip(!registry.cities[0]?.tiles, 'no city file in this build');
  await page.goto('./?gpu=low');
  const map = page.getByTestId('map');
  await expect(map).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
  const compass = page.getByTestId('compass');
  await expect(compass).toHaveAttribute('title', 'Low graphics: the map stays flat on this computer');
  await expect(compass).toBeDisabled();
  await expect(compass).toHaveAttribute('data-mode', '2d');
});

// PLAN §5's height row: at zoom 15, where the map file draws every footprint, most buildings stand at
// a height of their own, OSM's or else Overture's, rather than the style's three storeys. Zoom 14's
// tiles keep mostly big buildings, which OSM tags, so the opening camera would not tell the files apart.
// Measured 2026-10-13 over Back Bay: 5,637 of 5,825 with Overture's heights joined, 2,536 of 5,819 before.
const MEASURED_SHARE = 0.9;

test('tilted at zoom 15, most buildings stand at their own height', async ({ page }) => {
  test.skip(!registry.cities[0]?.tiles, 'no city file in this build');
  // 3D needs the full rung; CI's browser draws in software (gpu.ts). The map counts the buildings it draws only when asked.
  await page.goto('./?gpu=full&counts');
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
