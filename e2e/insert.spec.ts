// Route insert (the M4 spec, item 4; exit check 3): paused with the debug line's buses out, insert a
// stop between Symphony and the MFA from the line card. The draft card prices it, Insert adds it, no
// bus on the map moves more than a few metres at the click, and one undo takes it back with every
// bus where it was. The vehicle layer writes where it draws each bus while paused (TS-07).
import { expect, test, type Page } from '@playwright/test';
import { DEBUG_STOPS } from '../src/sim/commands/debugLine';
import { foundCompany } from './found';
import { city, onDepotLand, toScreen, zoomOutOnce } from './shell';

/** On Huntington Avenue between Symphony and the MFA: the debug line's second leg. */
const ON_HUNTINGTON: [number, number] = [-71.0903, 42.33995];

type Data = Record<string, unknown> & { clock: { elapsed: number }; nextIds: Record<string, number> };

/** Every bus as drawn in the last frame, and how many paused frames have been drawn. */
async function drawn(page: Page): Promise<{ at: [number, number][]; frames: number }> {
  const map = page.getByTestId('map');
  const text = (await map.getAttribute('data-buses-at')) ?? '';
  const at = text ? text.split(' ').map((p) => p.split(',').map(Number) as [number, number]) : [];
  return { at, frames: Number((await map.getAttribute('data-still-frames')) ?? 0) };
}

const M_PER_DEG = 111_320;
const metres = (a: [number, number], b: [number, number]) => Math.hypot((a[0] - b[0]) * M_PER_DEG * Math.cos((a[1] * Math.PI) / 180), (a[1] - b[1]) * M_PER_DEG);
/** The largest distance from a bus of `from` to the nearest of `to`. */
const largestMove = (from: [number, number][], to: [number, number][]) => Math.max(0, ...from.map((p) => Math.min(...to.map((q) => metres(p, q)))));

/** A frame drawn after `frames` with `stops` stops on the map. */
async function settled(page: Page, frames: number, stops: number) {
  const map = page.getByTestId('map');
  await expect.poll(async () => ((await map.getAttribute('data-stops')) ?? '').split(' ').filter(Boolean).length).toBe(stops);
  await expect.poll(async () => (await drawn(page)).frames).toBeGreaterThan(frames);
  return drawn(page);
}

test.describe('route insert', () => {
  test.skip(!city.sim, 'no sim file in this build yet');

  test('inserts a stop into a running line with no bus moving, and one undo takes it back', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('./');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await foundCompany(page);
    await zoomOutOnce(page); // the whole line in view, clear of the dock
    // 08:00 on day 2: a depot and the debug line every 10 minutes, three Sparrows out.
    await page.getByRole('button', { name: 'Saves' }).click();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export this game' }).click();
    const save = JSON.parse(Buffer.concat((await (await (await download).createReadStream()).toArray()) as Buffer[]).toString()) as { data: Data };
    const d = save.data;
    const [lon, lat] = onDepotLand();
    d.depots = [{ id: 1, lon, lat }];
    d.stops = DEBUG_STOPS.map((s, k) => ({ id: k + 1, lon: s.at[0], lat: s.at[1], tier: 1 }));
    d.lines = [{ id: 1, name: 'Line 1', colour: '#2471a3', stopIds: [1, 2, 3, 4], fareCents: 225, headways: { peak: 600, offpeak: 600, overnight: null }, boardedMilli: 0, buses: 3, model: 'sparrow', earlier: [] }];
    d.nextIds = { ...d.nextIds, depot: 2, stop: 5, line: 2 };
    d.clock.elapsed = 86_400 + 3 * 3_600;
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Import a save file' }).click();
    await (await chooser).setFiles({ name: 'insert.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(save)) });
    await expect(page.getByTestId('notice')).toContainText('Save file loaded');
    await page.getByRole('button', { name: 'Close' }).click();
    const before = await settled(page, 0, 4);
    expect(before.at.length).toBe(3);

    // Insert a stop on Huntington Avenue from the line card.
    await page.getByRole('button', { name: 'Lines' }).click();
    await page.getByRole('button', { name: 'Insert a stop' }).click();
    const draft = page.getByTestId('draft-card');
    await expect(draft).toContainText('Insert a stop on Line 1');
    const [x, y] = await toScreen(page, ON_HUNTINGTON);
    await page.mouse.click(x, y);
    await expect(draft).toContainText('5 stops', { timeout: 10_000 });
    await expect(draft).toHaveAttribute('data-refusal', '');
    await expect(draft).toHaveAttribute('data-price', '400000');
    await draft.getByRole('button', { name: 'Insert' }).click();
    const after = await settled(page, before.frames, 5);
    expect(after.at.length).toBe(3);
    expect(largestMove(before.at, after.at)).toBeLessThanOrEqual(5);
    expect(largestMove(after.at, before.at)).toBeLessThanOrEqual(5);

    // One undo takes it back, every bus where it was.
    const chip = page.getByTestId('undo');
    await expect(chip).toHaveText('Undo: Insert a stop on Line 1');
    await chip.click();
    const undone = await settled(page, after.frames, 4);
    expect(largestMove(before.at, undone.at)).toBeLessThanOrEqual(5);
    expect(largestMove(undone.at, before.at)).toBeLessThanOrEqual(5);
  });
});
