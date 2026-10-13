import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { foundCompany } from './found';
import { loadCity } from '../src/sim/city/simfile';
import { DEBUG_STOPS } from '../src/sim/commands/debugLine';
import { pointInRing, toLngLat, type XY } from '../src/sim/core/geo';

const registry = JSON.parse(readFileSync('cities/index.json', 'utf8')) as { cities: { sim: { file: string } | null }[] };
const city = registry.cities[0]!;

/** Where [lon, lat] lands on screen with the camera at rest (the map's data-view; Web Mercator, 512 px tiles). */
async function toScreen(page: Page, [lon, lat]: readonly [number, number]): Promise<[number, number]> {
  const map = page.getByTestId('map');
  const box = (await map.boundingBox())!;
  const [clon, clat, zoom] = (await map.getAttribute('data-view'))!.split(',').map(Number) as [number, number, number];
  const world = 512 * 2 ** zoom;
  const merc = ([x, y]: readonly [number, number]) => [((x + 180) / 360) * world, ((1 - Math.log(Math.tan(Math.PI / 4 + (y * Math.PI) / 360)) / Math.PI) / 2) * world];
  const [px, py] = merc([lon, lat]);
  const [cx, cy] = merc([clon, clat]);
  return [box.x + box.width / 2 + px! - cx!, box.y + box.height / 2 + py! - cy!];
}

/** A point inside the sim file's largest parcel of depot land, as the sim tests place a depot. */
function onDepotLand(): [number, number] {
  const loaded = loadCity(readFileSync(`public/cities/${city.sim!.file}`, 'utf8'));
  if (!loaded.ok) throw new Error(loaded.problem);
  const ring = [...loaded.city.depotLand].sort((a, b) => b.length - a.length)[0]!;
  const [cx, cy] = ring.reduce(([x, y], p) => [x + p[0] / ring.length, y + p[1] / ring.length], [0, 0]);
  for (let t = 0; t <= 1; t += 0.05) {
    const p: XY = [cx + (ring[0]![0] - cx) * t, cy + (ring[0]![1] - cy) * t];
    if (pointInRing(ring, p)) return [...toLngLat(loaded.city.frame, p)] as [number, number];
  }
  throw new Error('no point inside the parcel');
}

// The M2 spec's exit check, steps 1–5: found, a depot on the green tint, four stops from Copley to
// Longwood, Create, its buses running, and a day whose cost rows land on the card (I1).
test.describe('the line tool on the fixture', () => {
  test.skip(!city.sim, 'no sim file in this build yet');

  test('places a depot, draws Copley to Longwood, creates it, and a day of costs adds up', async ({ page }) => {
    test.setTimeout(120_000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('./');
    const map = page.getByTestId('map');
    const panel = page.getByTestId('sim-panel');
    await expect(map).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await expect(panel).toBeVisible({ timeout: 30_000 });
    // Step 1: name and colour the company; cash reads the founding capital.
    await expect(panel).toHaveAttribute('data-cash', '42720000');
    await foundCompany(page);
    await expect(page.getByTestId('checklist')).toHaveText('1/5 Place a depot');
    // One step out from the opening view, so the depot land and Longwood both fit on screen.
    const [, , opening] = (await map.getAttribute('data-view'))!.split(',').map(Number);
    await page.mouse.click((await map.boundingBox())!.width / 2, 200);
    await page.keyboard.press('-');
    await expect.poll(async () => Number((await map.getAttribute('data-view'))!.split(',')[2]), { timeout: 10_000 }).toBeCloseTo(opening! - 1, 2);

    // A depot: the tint shows, the card reads the rule, a click buys it for $150k.
    await page.getByRole('button', { name: 'Place a depot' }).click();
    await expect(map).toHaveAttribute('data-tint', 'on');
    const spot = onDepotLand();
    const [dx, dy] = await toScreen(page, spot);
    // Two moves in the same moment, from 40 px away onto the spot: the card must describe where the
    // pointer rests, not where it passed (CI's runner once moved fast enough to drop the last move).
    await page.evaluate(
      ([moves]) => {
        const canvas = document.querySelector('.maplibregl-canvas')!;
        for (const [x, y] of moves!) canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: x, clientY: y, bubbles: true }));
      },
      [[[dx - 40, dy], [dx, dy]]] as const,
    );
    const depotCard = page.getByTestId('depot-card');
    await expect(depotCard).toHaveAttribute('data-ok', 'yes', { timeout: 10_000 });
    const [lon, lat] = (await depotCard.getAttribute('data-at'))!.split(',').map(Number) as [number, number];
    expect(Math.abs(lon - spot[0]) * 82_000 + Math.abs(lat - spot[1]) * 111_000).toBeLessThan(15); // metres, about 2 px
    await expect(depotCard).toContainText('Industrial ✓');
    await expect(depotCard).toContainText('$150k');
    await page.mouse.click(dx, dy);
    await expect(panel).toHaveAttribute('data-cash', '27720000');
    await expect(map).toHaveAttribute('data-tint', 'off');
    await expect(page.getByTestId('checklist')).toHaveText('2/5 Draw a line');

    // The line: four clicks, the card's price, Create.
    await page.getByRole('button', { name: 'Draw a line' }).click();
    const draft = page.getByTestId('draft-card');
    for (const stop of DEBUG_STOPS) {
      const [x, y] = await toScreen(page, stop.at);
      await page.mouse.click(x, y);
    }
    await expect(draft).toHaveAttribute('data-price', '20600000', { timeout: 10_000 });
    await expect(draft).toHaveAttribute('data-refusal', '');
    await expect(draft).toContainText('4 stops');
    await expect(draft).toContainText('every 20 min needs 2 Sparrows · $190k');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByTestId('line-card')).toBeVisible();
    await expect(panel).toHaveAttribute('data-cash', '7120000');
    await expect(page.getByTestId('checklist')).toHaveText('3/5 Press play');
    const running = Number(await page.getByTestId('line-card').getAttribute('data-running'));

    // Its buses: drawn while time runs (TS-07), and the layer asks for no frame while paused (I14).
    await page.getByRole('button', { name: '1×' }).click();
    await expect.poll(async () => Number(await map.getAttribute('data-buses')), { timeout: 10_000 }).toBeGreaterThan(0);
    await expect.poll(async () => Number(await map.getAttribute('data-asked')), { timeout: 10_000 }).toBeGreaterThan(0);
    await expect(page.getByTestId('checklist')).toHaveText('4/5 Close a day in profit');
    await page.getByRole('button', { name: 'Pause' }).click();
    await page.waitForTimeout(500);
    const asked = await map.getAttribute('data-asked');
    await page.waitForTimeout(1_000);
    expect(await map.getAttribute('data-asked')).toBe(asked);

    // A day: every cost is a row, and the rows add up to the change in cash.
    await page.getByRole('button', { name: '3×' }).click();
    const card = page.getByTestId('day-card');
    await expect(card).toBeVisible({ timeout: 90_000 });
    for (const name of ['Fares', 'Running (per km)', 'Driver wages', 'Deadhead', 'Depot upkeep']) await expect(card).toContainText(name);
    expect(await card.getAttribute('data-total')).toBe(await card.getAttribute('data-change'));
    const cents = async (kind: string) => Number(await card.locator(`tr[data-kind="${kind}"]`).getAttribute('data-cents'));
    // Day 1 opens at 05:00: every run of the line is on it, so its running cost is the forecast to the
    // cent; the depot's upkeep is 19 hours of 24. (A whole day's wages and deadhead meet the forecast in
    // the host and sim tests: day 1 starts after the first bus left the depot.)
    expect(await cents('running')).toBe(-running);
    expect(await cents('upkeep')).toBe(-19 * 1_250);
    // About $1,400 ahead on its running rows: the checklist moves on to contracts (M3).
    await expect(page.getByTestId('checklist')).toHaveText('5/5 Take a contract');
    expect(errors).toEqual([]);
  });
});
