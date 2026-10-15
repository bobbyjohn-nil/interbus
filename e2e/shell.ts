import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';
import { loadCity } from '../src/sim/city/simfile';
import { DEBUG_STOPS } from '../src/sim/commands/debugLine';
import { EVENT_CHANCE_PER_DAY, EVENT_DAYS, EVENT_KINDS } from '../src/sim/config/events';
import { pointInRing, toLngLat, type XY } from '../src/sim/core/geo';
import { createRng } from '../src/sim/core/rng';

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

/**
 * An init script for page.addInitScript: `live` under the live key, then localStorage filled to its
 * quota with other data under the preview's origin and about 100k characters freed, fewer than a
 * backup of a larger `live` needs. Once a tab, so a reload finds what the game left.
 */
export function fillStorage(live: string): void {
  if (sessionStorage.getItem('seeded')) return;
  sessionStorage.setItem('seeded', 'yes');
  localStorage.setItem('interbus.save.boston', live);
  const chunk = 'f'.repeat(100_000);
  let n = 0;
  try {
    for (; n < 1_000; n++) localStorage.setItem(`another.app.${n}`, chunk);
  } catch {
    localStorage.removeItem(`another.app.${n - 1}`);
  }
}

/** A point inside the sim file's largest parcel of depot land, as the sim tests place a depot; or inside the next largest, with `parcel` 1 and up. */
export function onDepotLand(parcel = 0): [number, number] {
  const loaded = loadCity(readFileSync(`public/cities/${city.sim!.file}`, 'utf8'));
  if (!loaded.ok) throw new Error(loaded.problem);
  const ring = [...loaded.city.depotLand].sort((a, b) => b.length - a.length)[parcel]!;
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
 * Picks a speed from the top bar's speed menu (D25: 1x is real time, then 60x, 600x, 2,700x and
 * 5,400x; 2,700x was 1,800x until the tuning freeze), which also starts time running. The old
 * ladder's 1 and 3 are 600x and 5,400x; its 2, 1,800x, is now 2,700x.
 */
export async function setSpeed(page: Page, label: '1×' | '60×' | '600×' | '2,700×' | '5,400×'): Promise<void> {
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

/** Picks a tool from the dock's Build menu (D25), opening the menu first. */
export async function build(page: Page, tool: 'Place a stop' | 'Draw a line' | 'Place a depot'): Promise<void> {
  const menu = page.getByTestId('build-menu');
  if (!(await menu.isVisible())) await page.getByTestId('build').click();
  await menu.getByRole('button', { name: tool }).click();
}

/** Moves the pointer onto `at` with two moves on the map's canvas, so a tool's card describes where it rests; returns where that is on screen. */
export async function pointAt(page: Page, at: [number, number]): Promise<readonly [number, number]> {
  const [x, y] = await toScreen(page, at);
  await page.evaluate(
    ([moves]) => {
      const canvas = document.querySelector('.maplibregl-canvas')!;
      for (const [mx, my] of moves!) canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: mx, clientY: my, bubbles: true }));
    },
    [[[x - 40, y], [x, y]]] as const,
  );
  return [x, y] as const;
}

/**
 * This game exported, edited to day 2 at 09:00 with a depot, the debug line's four stops every 20
 * minutes and day 1 in profit (so the checklist's last step, Take a contract, opens Contracts), and
 * imported back: a line on the map without drawing it.
 */
export async function withDebugLine(page: Page): Promise<void> {
  type Data = Record<string, unknown> & { clock: { elapsed: number }; nextIds: Record<string, number>; ledger: unknown[] };
  await page.getByRole('button', { name: 'Saves' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export this game' }).click();
  const exported = (await (await (await download).createReadStream()).toArray()) as Buffer[];
  const save = JSON.parse(Buffer.concat(exported).toString()) as { data: Data };
  const d = save.data;
  const [lon, lat] = onDepotLand();
  d.depots = [{ id: 1, lon, lat }];
  d.stops = DEBUG_STOPS.map((s, k) => ({ id: k + 1, lon: s.at[0], lat: s.at[1], tier: 1 }));
  d.lines = [{ id: 1, name: 'Line 1', colour: '#2471a3', stopIds: [1, 2, 3, 4], fareCents: 225, headways: { peak: 1_200, offpeak: 1_200, overnight: null }, boardedMilli: 0, buses: 2, model: 'sparrow', earlier: [] }];
  d.nextIds = { ...d.nextIds, depot: 2, stop: 5, line: 2 };
  d.ledger.push({ day: 1, kind: 'fares', amountCents: 100_000, lineId: 1 });
  d.clock.elapsed = 86_400 + 4 * 3_600;
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import a save file' }).click();
  await page.getByRole('button', { name: 'Replace this game' }).click();
  await (await chooser).setFiles({ name: 'line.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(save)) });
  await expect(page.getByTestId('notice')).toContainText('Save file loaded');
  await page.getByTestId('saves').getByRole('button', { name: 'Close' }).click();
}

/** The events' first stream state whose next roll is one day of snow. */
function snowNext(): number {
  for (let s = 1; ; s++) {
    const rng = createRng(s);
    if (rng.next() < EVENT_CHANCE_PER_DAY && rng.pick(EVENT_KINDS) === 'snow' && rng.int(EVENT_DAYS.snow[0], EVENT_DAYS.snow[1]) === EVENT_DAYS.snow[0]) return s;
  }
}

/**
 * This game exported, edited to 23:50 on day 8, the quarter's last, and imported back: ten minutes
 * before a busy quarter's close. A depot, the debug line every 15 minutes, a RIDERSHIP contract at
 * Copley Square seven days met, the events' stream about to name snow, and a day of buying and
 * selling that leaves cash below zero, so the lender charges interest: the close's day card holds the
 * report card, a contract paid, a medal, snow named for tomorrow, interest and every kind of buying
 * and selling.
 */
export async function withBusyQuarterClose(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Saves' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export this game' }).click();
  const exported = (await (await (await download).createReadStream()).toArray()) as Buffer[];
  type Data = Record<string, unknown> & { clock: { elapsed: number }; nextIds: Record<string, number>; eventRng: { state: number }; contracts: Record<string, unknown>[]; ledger: { day: number; kind: string; amountCents: number; lineId: number | null }[] };
  const save = JSON.parse(Buffer.concat(exported).toString()) as { data: Data };
  const d = save.data;
  const [lon, lat] = onDepotLand();
  d.depots = [{ id: 1, lon, lat }];
  d.stops = DEBUG_STOPS.map((s, k) => ({ id: k + 1, lon: s.at[0], lat: s.at[1], tier: 1 }));
  d.lines = [{ id: 1, name: 'Line 1', colour: '#2471a3', stopIds: [1, 2, 3, 4], fareCents: 225, headways: { peak: 900, offpeak: 900, overnight: null }, boardedMilli: 0, buses: 2, model: 'sparrow', earlier: [] }];
  d.nextIds = { ...d.nextIds, depot: 2, stop: 5, line: 2 };
  Object.assign(d.contracts.find((c) => c.landmark === 'Copley Square')!, { kind: 'ridership', ask: 150, rewardCents: 6_000_000, acceptedDay: 1, daysMet: 7, hoursMissedToday: 0 });
  d.eventRng = { state: snowNext() };
  d.ledger.push({ day: 1, kind: 'fares', amountCents: 100_000, lineId: 1 }); // day 1 in profit, for the checklist
  d.ledger.sort((a, b) => a.day - b.day);
  for (const [kind, amountCents] of [['buses', -26_000_000], ['busSales', 4_750_000], ['stops', -1_600_000], ['stopUpgrades', -1_200_000], ['stopSales', 200_000], ['depots', -36_000_000]] as const) d.ledger.push({ day: 8, kind, amountCents, lineId: null });
  d.clock.elapsed = 7 * 86_400 + 18 * 3_600 + 50 * 60; // day 8, 23:50
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import a save file' }).click();
  await page.getByRole('button', { name: 'Replace this game' }).click();
  await (await chooser).setFiles({ name: 'busy.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(save)) });
  await expect(page.getByTestId('notice')).toContainText('Save file loaded');
  await page.getByTestId('saves').getByRole('button', { name: 'Close' }).click();
}
