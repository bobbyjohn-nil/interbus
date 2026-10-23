// The day and night tint (PLAN §4's charm moments, §8 rule 8; D13; src/render/map/daylight.ts): the map dims from 19:00 a
// step each half hour to night at 20:30, and lightens from 05:00, its paints set once a step and never per frame (RN-04), each
// step carried by MapLibre's transition, at once with less motion asked for. A line with overnight off rests, faded, from its
// last bus's return after 00:00 until 05:00, so the time of day never rests on the tint alone.
import { expect, test, type Page } from './base';
import { foundCompany, leaveHome } from './found';
import { DEBUG_STOPS } from '../src/sim/commands/debugLine';
import { RESTING_OPACITY } from '../src/render/map/overlays';
import { dim, NIGHT_STEP } from '../src/render/map/daylight';
import { GAME_LIGHT, LIGHT } from '../src/render/map/tokens';
import { city, frames, toScreen, withDebugLine, type SaveData } from './shell';

/** The debug line's game past Home, paused at `second` of day 2's clock (a second past 24:00 is the night after it). */
async function at(page: Page, second: number, edit?: (d: SaveData) => void) {
  await page.goto('./');
  await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
  // Home over a new game at 05:00 stands in daylight: dawn ended at 06:30 at first, and Home, the founding card and the first
  // line all stood on a map three quarters of the way to night (the review of the day and night tint).
  await expect(page.getByTestId('map')).toHaveAttribute('data-daylight', '0');
  await leaveHome(page);
  await foundCompany(page);
  await withDebugLine(page, (d) => {
    d.clock.elapsed = 86_400 + second - 5 * 3_600;
    edit?.(d);
  });
}

const hour = (h: number, m = 0) => h * 3_600 + m * 60;

/** How many of the screen's pixels in a 40 px box around `at` are within 10 of each colour. */
async function pixels(page: Page, at: readonly [number, number], colours: Record<string, readonly number[]>): Promise<Record<string, number>> {
  const [x, y] = await toScreen(page, at);
  const png = await page.screenshot({ clip: { x: x - 20, y: y - 20, width: 40, height: 40 } });
  return page.evaluate(
    async ([b64, colours]) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const canvas = Object.assign(document.createElement('canvas'), { width: img.width, height: img.height });
      const g = canvas.getContext('2d')!;
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, canvas.width, canvas.height).data;
      return Object.fromEntries(
        Object.entries(colours).map(([name, [r, gr, b]]) => {
          let n = 0;
          for (let k = 0; k < d.length; k += 4) if (Math.hypot(d[k]! - r!, d[k + 1]! - gr!, d[k + 2]! - b!) < 10) n++;
          return [name, n];
        }),
      );
    },
    [png.toString('base64'), colours] as const,
  );
}

test.describe('the day and night tint', () => {
  test.skip(!city.sim, 'no sim file in this build yet');

  test('dims from 19:00 a step each half hour to night at 20:30, its paints set once a step while the map draws on', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => void (m.type() === 'error' && errors.push(m.text())));
    await at(page, hour(18, 55));
    const map = page.getByTestId('map');
    await expect(map).toHaveAttribute('data-daylight', '0');
    const sets = Number((await map.getAttribute('data-daylight-sets')) ?? 0);
    const asked = Number((await map.getAttribute('data-asked')) ?? 0);
    await page.keyboard.press('3'); // 600×: 19:00 in half a second, night at 20:30 in about ten
    for (const step of ['1', '2', '3', '4']) await expect(map).toHaveAttribute('data-daylight', step, { timeout: 30_000 });
    // Four steps, four sets of the paints, while the map drew on: 39 frames here in software GL's Low graphics.
    expect(Number(await map.getAttribute('data-daylight-sets')) - sets).toBe(4);
    expect(Number(await map.getAttribute('data-asked')) - asked).toBeGreaterThan(8);
    await expect(map).toHaveAttribute('data-daylight-fade', '1500');
    // MapLibre takes every paint: a value it refused would be logged.
    expect(errors).toEqual([]);
  });

  // One night, as one test for the first quarter's room (three cost about a minute of CI): a line with overnight off rests once its
  // last bus is back, the clock names the night and then the peak (Off-peak is time.spec.ts's), and with less motion asked for
  // each step of the light comes at once.
  test('through one night: a line with overnight off rests once its last bus is back, its fade compiles nothing, the clock names the night and the peak, and with less motion asked for the light steps at once (D13)', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    // Every WebGL program linked: the first night's fade compiled MapLibre's programs for an opacity of each line's, and held the
    // page 518–1,249 ms in Low graphics on the busy scene (the systems audit's eleventh round).
    await page.addInitScript(() => {
      const w = window as unknown as { links: number };
      w.links = 0;
      for (const gl of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
        const link = gl.linkProgram;
        gl.linkProgram = function (this: WebGLRenderingContext, program: WebGLProgram) {
          w.links++;
          link.call(this, program);
        };
      }
    });
    const links = () => page.evaluate(() => (window as unknown as { links: number }).links);
    // Every 5 minutes by day and overnight off, at 00:00:30 on day 3, paused: the 23:45 to 23:55's trips are still under way, back at
    // the first stop at 00:03:49 to 00:13:49, and the 23:40's bus is driving home.
    await at(page, hour(24) + 30, (d) => {
      const line = (d.lines as { headways: { peak: number; offpeak: number; overnight: number | null }; buses: number }[])[0]!;
      line.headways = { peak: 300, offpeak: 300, overnight: null };
      line.buses = 6;
    });
    const map = page.getByTestId('map');
    const period = page.getByTestId('period');
    await expect(map).toHaveAttribute('data-daylight', '4');
    await expect(period).toHaveText('Overnight');
    // Not faded while it runs its last trips: it rested at 00:00 under 4 of its buses (D13: faded "while it is stopped").
    await frames(page);
    expect(Number(await map.getAttribute('data-buses'))).toBeGreaterThan(0);
    expect(await map.getAttribute('data-resting')).toBeNull();
    const before = await links();
    await page.keyboard.press('3'); // 600×: the 23:55's trip back at its first stop at about 00:13, a second and a half on
    await expect(map).toHaveAttribute('data-resting', '1', { timeout: 30_000 });
    await frames(page);
    expect(await links()).toBe(before);
    await page.keyboard.press('4'); // 2,700×: 05:00 in about seven seconds, then the peak from 06:30 for two
    await expect(map).toHaveAttribute('data-resting', '', { timeout: 30_000 });
    // Lighter than night, at once: at 2,700× each step's half hour passes in two thirds of a second.
    await expect(map).toHaveAttribute('data-daylight', /^[0-3]$/);
    await expect(map).toHaveAttribute('data-daylight-fade', '0');
    await expect(period).toHaveText('Peak', { timeout: 30_000 });
  });

  // The systems audit's eleventh round: a resting line drawn later on a street it shared with a running one tinted it: the running
  // blue showed (34, 120, 132), 0.35 of the resting green over 0.65 of the blue, neither line's colour. The resting lines draw
  // under the running ones now (overlays.ts, the faded copies).
  test('a resting line on a street it shares with a running one leaves the running line its own colour', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    // 02:00 on day 3, paused: Line 1 runs overnight, and Line 2 on the same four stops, drawn after it, rests.
    await at(page, hour(26), (d) => {
      const one = (d.lines as Record<string, unknown>[])[0]!;
      d.lines = [
        { ...one, id: 1, name: 'Line 1', colour: '#2471a3', headways: { peak: 1_200, offpeak: 1_200, overnight: 1_800 } },
        { ...one, id: 2, name: 'Line 2', colour: '#1e8449', headways: { peak: 1_200, offpeak: 1_200, overnight: null } },
      ];
      d.nextIds = { ...d.nextIds, line: 3 };
    });
    await expect(page.getByTestId('map')).toHaveAttribute('data-resting', '2');
    // Halfway along Huntington Avenue from Copley to Symphony, where both run.
    const [a, b] = [DEBUG_STOPS[0]!.at, DEBUG_STOPS[1]!.at];
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as const;
    const blue = [0x24, 0x71, 0xa3];
    const green = [0x1e, 0x84, 0x49];
    const colours = { running: blue, blend: green.map((g, k) => Math.round(0.35 * g + 0.65 * blue[k]!)), resting: green };
    // Once the lines' tiles are laid out again with Line 2 resting.
    await expect.poll(async () => (await pixels(page, mid, colours)).running, { timeout: 15_000 }).toBeGreaterThan(20);
    expect((await pixels(page, mid, colours)).blend).toBe(0);
  });

  // The systems audit's twelfth round: each resting line was laid at 0.35 over the streets, so two resting on a street they share
  // blended, the later over the earlier, into neither's colour: (96, 146, 133) on Huntington Avenue, 0.058 in OKLab from Line 2's
  // own faded colour. Every new line rests at night, overnight off. Opaque, the later hides the earlier, as by day.
  test('two lines resting on a street they share show the later one alone, faded, as by day it hides the earlier', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    // 02:00 on day 3, paused: Line 1 and Line 2, drawn after it, on the same four stops, both overnight off.
    await at(page, hour(26), (d) => {
      const one = (d.lines as Record<string, unknown>[])[0]!;
      d.lines = [
        { ...one, id: 1, name: 'Line 1', colour: '#2471a3' },
        { ...one, id: 2, name: 'Line 2', colour: '#1e8449' },
      ];
      d.nextIds = { ...d.nextIds, line: 3 };
    });
    await expect(page.getByTestId('map')).toHaveAttribute('data-resting', '1 2');
    const [a, b] = [DEBUG_STOPS[0]!.at, DEBUG_STOPS[1]!.at];
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as const;
    const rgb = (hex: string) => [16, 8, 0].map((shift) => (Number.parseInt(hex.slice(1), 16) >> shift) & 255);
    const over = (top: number[], under: number[]) => top.map((c, k) => Math.round(RESTING_OPACITY * c + (1 - RESTING_OPACITY) * under[k]!));
    const [blue, green, ground] = [rgb('#2471a3'), rgb('#1e8449'), rgb(GAME_LIGHT.restingGround)];
    // Line 2's own faded colour, and Line 2 laid over Line 1 as they were, on Huntington Avenue at night (the arterials' colour).
    const street = rgb(dim(LIGHT.arterial, NIGHT_STEP));
    const colours = { own: over(green, ground), blend: over(green, over(blue, street)) };
    await expect.poll(async () => (await pixels(page, mid, colours)).own, { timeout: 15_000 }).toBeGreaterThan(20);
    expect((await pixels(page, mid, colours)).blend).toBe(0);
  });
});
