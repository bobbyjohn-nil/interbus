import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';
import { loadCity } from '../src/sim/city/simfile';
import { pointInRing, toLngLat, type XY } from '../src/sim/core/geo';

const registry = JSON.parse(readFileSync('cities/index.json', 'utf8')) as { cities: { id: string; sim: { file: string } | null; fixture?: { file: string } | null }[] };
const entry = registry.cities[0]!;
/** The city as the e2e tests play it: the fixture build (npm run build:fixture) loads mini-Boston, so `sim` is the fixture. */
export const city = { ...entry, sim: entry.fixture ?? entry.sim };

/** Where [lon, lat] lands on screen with the camera at rest (the map's data-view; Web Mercator, 512 px tiles). */
export async function toScreen(page: Page, at: readonly [number, number]): Promise<[number, number]> {
  return (await projector(page)).project(at);
}

/** The camera at rest, read once: where any [lon, lat] lands on screen, the map's box and its zoom (flat and facing north). */
export async function projector(page: Page): Promise<{ project: (at: readonly [number, number]) => [number, number]; box: { x: number; y: number; width: number; height: number }; zoom: number }> {
  const map = page.getByTestId('map');
  const box = (await map.boundingBox())!;
  const [clon, clat, zoom] = (await map.getAttribute('data-view'))!.split(',').map(Number) as [number, number, number];
  const world = 512 * 2 ** zoom;
  const merc = ([x, y]: readonly [number, number]) => [((x + 180) / 360) * world, ((1 - Math.log(Math.tan(Math.PI / 4 + (y * Math.PI) / 360)) / Math.PI) / 2) * world];
  const [cx, cy] = merc([clon, clat]);
  return {
    project: (at) => {
      const [px, py] = merc(at);
      return [box.x + box.width / 2 + px! - cx!, box.y + box.height / 2 + py! - cy!];
    },
    box,
    zoom,
  };
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

/**
 * Picks a speed from the top bar's speed menu (D25: 1x is real time, then 60x, 600x, 1,800x and
 * 5,400x), which also starts time running. The old ladder's 1, 2 and 3 are 600x, 1,800x and 5,400x.
 */
export async function setSpeed(page: Page, label: '1×' | '60×' | '600×' | '1,800×' | '5,400×'): Promise<void> {
  await page.getByTestId('speed-menu').click();
  // An option's name is its speed then what it means ("600× 10 minutes a second"): match the speed whole.
  await page.getByRole('option').filter({ has: page.locator('.dropdown-label', { hasText: new RegExp(`^${label}$`) }) }).click();
}

/** Sets a line's fare where the game keeps it, in Finance's Lines (D25), and closes Finance again. */
export async function setFare(page: Page, line: string, fare: string): Promise<void> {
  await page.getByRole('button', { name: 'Finance', exact: true }).click();
  await page.getByTestId('finance-lines').click();
  await page.getByRole('button', { name: `Fare for ${line}` }).click();
  await page.getByRole('option', { name: fare, exact: true }).click();
  await expect(page.getByRole('button', { name: `Fare for ${line}` })).toContainText(fare);
  await page.getByTestId('finance').getByRole('button', { name: 'Close' }).click();
}
