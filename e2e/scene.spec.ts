// The busy scene in the page (the slow-laptop run, the M5 spec, item 9; src/sim/scene.ts): its save
// imports through Saves into whichever city this build plays, and every bus in it is drawn, more than
// any company can own today (TS-07: drawn, not merely sent). The fixture build (the PR checks) holds
// the fixture's scene; CI's smoke step runs this on the shipped build too, with Inner Boston's 200
// buses, the file bench/scene.ts writes for the run.
import { createHash } from 'node:crypto';
import { expect, test } from './base';
import { CORRIDORS } from '../bench/inner';
import { loadCity } from '../src/sim/city/simfile';
import { DEPOT_CAPACITY, MAX_DEPOTS } from '../src/sim/config/depots';
import { encode } from '../src/sim/save/save';
import { busyScene, FIXTURE_CORRIDORS } from '../src/sim/scene';
import { foundCompany } from './found';
import { setSpeed } from './shell';

test('the busy scene imports, and every bus in it is drawn', async ({ page }) => {
  test.setTimeout(180_000);
  const simFile = page.waitForResponse((r) => /\/cities\/sim-[^/]+\.json$/.test(new URL(r.url()).pathname));
  await page.goto('./');
  const text = await (await simFile).text();
  const loaded = loadCity(text);
  if (!loaded.ok) throw new Error(loaded.problem);
  const { city } = loaded;
  const inner = city.extent === 'inner-boston';
  const scene = busyScene(city, { id: city.id, revision: city.extent, hash: createHash('sha256').update(text).digest('hex') }, inner ? CORRIDORS : FIXTURE_CORRIDORS, inner ? 200 : 1_000);
  expect(scene.buses).toBeGreaterThan(MAX_DEPOTS * DEPOT_CAPACITY);
  if (inner) expect(scene.buses).toBeGreaterThanOrEqual(200);

  await foundCompany(page);
  await page.getByRole('button', { name: 'Saves' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import a save file' }).click();
  await page.getByRole('button', { name: 'Replace this game' }).click();
  await (await chooser).setFiles({ name: 'busy.json', mimeType: 'application/json', buffer: Buffer.from(encode(scene.world.state, { sha: 'scene', version: '0.0.0' })) });
  await expect(page.getByTestId('notice')).toContainText('Save file loaded');
  await page.getByRole('button', { name: 'Close', exact: true }).click();

  const map = page.getByTestId('map');
  await setSpeed(page, '600×');
  await expect.poll(async () => Number(await map.getAttribute('data-buses')), { timeout: 30_000 }).toBe(scene.buses);
  test.info().annotations.push({ type: 'scene', description: `${scene.buses} buses on ${scene.lines} lines drawn on ${city.extent}` });
});
