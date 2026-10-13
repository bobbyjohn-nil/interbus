import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';
import { loadCity } from '../src/sim/city/simfile';
import { pointInRing, toLngLat, type XY } from '../src/sim/core/geo';

const registry = JSON.parse(readFileSync('cities/index.json', 'utf8')) as { cities: { id: string; sim: { file: string } | null; fixture?: { file: string } | null }[] };
const entry = registry.cities[0]!;
/** The city as the e2e tests play it: the fixture build (npm run build:fixture) loads mini-Boston, so `sim` is the fixture. */
export const city = { ...entry, sim: entry.fixture ?? entry.sim };

/** Where [lon, lat] lands on screen with the camera at rest (the map's data-view; Web Mercator, 512 px tiles). */
export async function toScreen(page: Page, [lon, lat]: readonly [number, number]): Promise<[number, number]> {
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
export function onDepotLand(): [number, number] {
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

/** One step out from the opening view, so the depot land and Longwood both fit on screen. */
export async function zoomOutOnce(page: Page): Promise<void> {
  const map = page.getByTestId('map');
  const [, , opening] = (await map.getAttribute('data-view'))!.split(',').map(Number);
  const box = (await map.boundingBox())!;
  await page.mouse.click(box.width / 2, box.height * 0.3);
  await page.keyboard.press('-');
  await expect.poll(async () => Number((await map.getAttribute('data-view'))!.split(',')[2]), { timeout: 10_000 }).toBeCloseTo(opening! - 1, 2);
}

/** The share of the screen the calm shell covers: every element marked data-chrome, clipped to the window. */
export function chromeShare(page: Page): Promise<number> {
  return page.evaluate(() => {
    const [vw, vh] = [window.innerWidth, window.innerHeight];
    let area = 0;
    for (const el of document.querySelectorAll('[data-chrome]')) {
      const r = el.getBoundingClientRect();
      area += Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0)) * Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
    }
    return area / (vw * vh);
  });
}
