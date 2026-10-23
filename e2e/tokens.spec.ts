// The owner's Nov 8 light token pick (PLAN §8, D13): the starting warm-neutral tokens or pure V1 paper, side by side on Boston.
// `?light=paper` draws the preview in V1's paper (src/platform's lightSwitch; src/render/map/tokens.ts), so the two stand side by
// side in two windows. TOKEN_PICK=1 also writes the side-by-side's pictures: both candidates at the same views over a late game's
// lines, by day and at the tint's darkest step, into test-results/token-pick/ (DECISIONS, Measured, 2026-10-23).
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from './base';
import { CORRIDORS } from '../bench/inner';
import { LIGHT, V1_PAPER } from '../src/render/map/tokens';
import { loadCity } from '../src/sim/city/simfile';
import { encode } from '../src/sim/save/save';
import { FIXTURE_CORRIDORS, lateScene } from '../src/sim/scene';
import { foundCompany } from './found';

const rgb = (hex: string) => [16, 8, 0].map((shift) => (Number.parseInt(hex.slice(1), 16) >> shift) & 255);

/** How many pixels in the map's top left quarter are within 3 of each land colour: the ground between the streets. */
async function landPixels(page: Page): Promise<{ paper: number; warm: number }> {
  const png = await page.screenshot({ clip: { x: 0, y: 0, width: 400, height: 250 } });
  return page.evaluate(
    async ([b64, paper, warm]) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const canvas = Object.assign(document.createElement('canvas'), { width: img.width, height: img.height });
      const g = canvas.getContext('2d')!;
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, canvas.width, canvas.height).data;
      const near = ([r, gr, b]: number[]) => {
        let n = 0;
        for (let k = 0; k < d.length; k += 4) if (Math.hypot(d[k]! - r!, d[k + 1]! - gr!, d[k + 2]! - b!) <= 3) n++;
        return n;
      };
      return { paper: near(paper), warm: near(warm) };
    },
    [png.toString('base64'), rgb(V1_PAPER.land), rgb(LIGHT.land)] as const,
  );
}

test('`?light=paper` draws the board in V1’s paper, and the page without it in the warm-neutral set', async ({ page }) => {
  await page.setViewportSize({ width: 1152, height: 720 });
  for (const [search, mine, other] of [['?light=paper', 'paper', 'warm'], ['', 'warm', 'paper']] as const) {
    await page.goto(`./${search}`);
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    // Home over the paused, flat map (the M5 spec, item 3): the land shows between Cambridgeport's streets.
    await expect.poll(async () => (await landPixels(page))[mine], { timeout: 15_000 }).toBeGreaterThan(5_000);
    const counts = await landPixels(page);
    expect(counts[other], `${search || 'no switch'}: ${JSON.stringify(counts)}`).toBeLessThan(counts[mine] / 20);
  }
});

test.describe('the side-by-side’s pictures (TOKEN_PICK=1)', () => {
  test.skip(!process.env.TOKEN_PICK, 'writes the token pick’s pictures only when asked');

  /** A late game's lines (src/sim/scene.ts lateScene: the fixture's corridors, or Inner Boston's on the shipped build), paused at `hour` on day 1. */
  async function lateGame(page: Page, search: string, hour: number) {
    const simFile = page.waitForResponse((r) => /\/cities\/sim-[^/]+\.json$/.test(new URL(r.url()).pathname));
    await page.goto(`./${search}`);
    const text = await (await simFile).text();
    const loaded = loadCity(text);
    if (!loaded.ok) throw new Error(loaded.problem);
    const { city } = loaded;
    const inner = city.extent === 'inner-boston';
    const world = lateScene(city, { id: city.id, revision: city.extent, hash: createHash('sha256').update(text).digest('hex') }, inner ? CORRIDORS : FIXTURE_CORRIDORS, 18);
    world.state.elapsed = (hour - 5) * 3_600; // day 1 opens at 05:00
    await foundCompany(page);
    await page.getByRole('button', { name: 'Saves' }).click();
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Import a save file' }).click();
    await page.getByRole('button', { name: 'Replace this game' }).click();
    await (await chooser).setFiles({ name: 'late.json', mimeType: 'application/json', buffer: Buffer.from(encode(world.state, { sha: 'late', version: '0.0.0' })) });
    await expect(page.getByTestId('notice')).toContainText('Save file loaded');
    await page.getByTestId('saves').getByRole('button', { name: 'Close', exact: true }).click();
    await expect(page.getByTestId('map')).toHaveAttribute('data-daylight', hour >= 20 ? '4' : '0', { timeout: 15_000 });
  }

  test('both candidates at the same views, by day and at night', async ({ browser, page }) => {
    test.setTimeout(240_000);
    const shots: Record<string, Buffer> = {};
    const zooms: Record<string, string> = {};
    for (const [name, search] of [['warm', ''], ['paper', '?light=paper']] as const) {
      for (const [when, hour] of [['day', 12], ['night', 22]] as const) {
        // A context of its own each time, so no autosave stands on Home to ask about; its tab's splash already towed, as base.ts's.
        const context = await browser.newContext({ baseURL: test.info().project.use.baseURL!, viewport: { width: 1152, height: 720 }, reducedMotion: 'reduce' });
        await context.addInitScript(() => sessionStorage.setItem('interbus.tab.boot-wipe', '1'));
        const shot = await context.newPage();
        await lateGame(shot, search, hour);
        const box = (await shot.getByTestId('map').boundingBox())!;
        await shot.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        for (const [view, turns] of [['far', 0], ['near', 3]] as const) {
          for (let k = 0; k < turns; k++) {
            await shot.mouse.wheel(0, -500); // about 0.58 of a zoom level each
            await shot.waitForTimeout(300);
          }
          await shot.waitForTimeout(2_500); // the zoom's ease and the tiles it asks for
          shots[`${view}-${when}-${name}`] = await shot.screenshot();
          zooms[view] = Number((await shot.getByTestId('map').getAttribute('data-view'))!.split(',')[2]).toFixed(1);
        }
        await context.close();
      }
    }
    // Each view and time as one picture, the warm-neutral set left and V1's paper right, at 0.6 of the screen.
    const out = join(test.info().project.outputDir, 'token-pick');
    mkdirSync(out, { recursive: true });
    for (const view of ['far', 'near']) {
      for (const when of ['day', 'night']) {
        const pair = await page.evaluate(
          async ([left, right, caption]) => {
            const load = async (b64: string) => {
              const img = new Image();
              img.src = `data:image/png;base64,${b64}`;
              await img.decode();
              return img;
            };
            const [a, b] = [await load(left), await load(right)];
            const [w, h] = [Math.round(a.width * 0.6), Math.round(a.height * 0.6)];
            const canvas = Object.assign(document.createElement('canvas'), { width: w * 2 + 12, height: h + 34 });
            const g = canvas.getContext('2d')!;
            g.fillStyle = '#ffffff';
            g.fillRect(0, 0, canvas.width, canvas.height);
            g.drawImage(a, 0, 34, w, h);
            g.drawImage(b, w + 12, 34, w, h);
            g.fillStyle = '#2a2723';
            g.font = '600 15px sans-serif';
            g.fillText(`Warm-neutral (today’s) · ${caption}`, 6, 22);
            g.fillText(`V1 paper (?light=paper) · ${caption}`, w + 18, 22);
            return canvas.toDataURL('image/png').split(',')[1]!;
          },
          [shots[`${view}-${when}-warm`]!.toString('base64'), shots[`${view}-${when}-paper`]!.toString('base64'), `zoom ${zooms[view]}, ${when === 'day' ? '12:00' : '22:00, the darkest step'}`] as const,
        );
        writeFileSync(`${out}/${view}-${when}.png`, Buffer.from(pair, 'base64'));
      }
    }
    test.info().annotations.push({ type: 'token-pick', description: out });
  });
});
