// PLAN §6's heap budget on real laptops: at most 10% heap growth over 30 minutes of play. The nightly
// runs it on the shipped build (HEAP_MINUTES=30); the PR checks skip it, since it takes as long as it
// measures. The slow-laptop run's busy scene (src/sim/scene.ts) plays at 2,700× (1,800× until the
// tuning freeze), the pacing run's speed after day 1. After a 2-minute warm-up, the page's heap and
// each worker's (the sim's and MapLibre's), each read after a garbage collection, are set against
// themselves at the end.
import { createHash } from 'node:crypto';
import { expect, test, type CDPSession } from '@playwright/test';
import { CORRIDORS } from '../bench/inner';
import { loadCity } from '../src/sim/city/simfile';
import { encode } from '../src/sim/save/save';
import { busyScene, FIXTURE_CORRIDORS } from '../src/sim/scene';
import { foundCompany } from './found';
import { setSpeed } from './shell';

const MINUTES = Number(process.env.HEAP_MINUTES ?? 0);
const WARM_UP_MS = 2 * 60_000;
/** PLAN §6: heap growth over the run, as a share of the heap after the warm-up. */
const GROWTH_BUDGET = 0.1;

/** A CDP call to a target the browser session attached to (a worker), answered through the browser session. */
function onTarget(browser: CDPSession, sessionId: string): (method: string) => Promise<unknown> {
  let next = 0;
  const waiting = new Map<number, (result: unknown) => void>();
  browser.on('Target.receivedMessageFromTarget', (e: { sessionId: string; message: string }) => {
    if (e.sessionId !== sessionId) return;
    const m = JSON.parse(e.message) as { id?: number; result?: unknown };
    if (m.id !== undefined) waiting.get(m.id)?.(m.result);
  });
  return (method) =>
    new Promise((resolve) => {
      const id = ++next;
      waiting.set(id, resolve);
      void browser.send('Target.sendMessageToTarget', { sessionId, message: JSON.stringify({ id, method }) });
    });
}

test('the busy scene’s heaps grow at most 10% over 30 minutes at 2,700×', async ({ page, browser }) => {
  test.skip(MINUTES <= 0, 'nightly: set HEAP_MINUTES');
  test.setTimeout(WARM_UP_MS + MINUTES * 60_000 + 180_000);
  const simFile = page.waitForResponse((r) => /\/cities\/sim-[^/]+\.json$/.test(new URL(r.url()).pathname));
  await page.goto('./');
  const text = await (await simFile).text();
  const loaded = loadCity(text);
  if (!loaded.ok) throw new Error(loaded.problem);
  const { city } = loaded;
  const inner = city.extent === 'inner-boston';
  const scene = busyScene(city, { id: city.id, revision: city.extent, hash: createHash('sha256').update(text).digest('hex') }, inner ? CORRIDORS : FIXTURE_CORRIDORS, inner ? 200 : 1_000);
  await foundCompany(page);
  await page.getByRole('button', { name: 'Saves' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import a save file' }).click();
  await (await chooser).setFiles({ name: 'busy.json', mimeType: 'application/json', buffer: Buffer.from(encode(scene.world.state, { sha: 'scene', version: '0.0.0' })) });
  await expect(page.getByTestId('notice')).toContainText('Save file loaded');
  await page.getByRole('button', { name: 'Close' }).click();
  await setSpeed(page, '2,700×');

  // Every heap, by target: the page's through its own session, each worker's through the browser's.
  const pageSession = await page.context().newCDPSession(page);
  const browserSession = await browser.newBrowserCDPSession();
  const { targetInfos } = await browserSession.send('Target.getTargets');
  const workers = await Promise.all(
    targetInfos
      .filter((t) => t.type === 'worker')
      .map(async (t) => ({ name: t.url.includes('sim.worker') ? 'sim' : 'map', send: onTarget(browserSession, (await browserSession.send('Target.attachToTarget', { targetId: t.targetId, flatten: false })).sessionId) })),
  );
  const heaps = async (): Promise<Record<string, number>> => {
    await pageSession.send('HeapProfiler.collectGarbage');
    const out: Record<string, number> = { page: (await pageSession.send('Runtime.getHeapUsage')).usedSize };
    for (const [k, w] of workers.entries()) {
      await w.send('HeapProfiler.collectGarbage');
      out[`${w.name} ${k}`] = ((await w.send('Runtime.getHeapUsage')) as { usedSize: number }).usedSize;
    }
    return out;
  };
  const total = (h: Record<string, number>) => Object.values(h).reduce((a, b) => a + b, 0);

  await page.waitForTimeout(WARM_UP_MS);
  const start = await heaps();
  const dayAt = async () => Number(await page.getByTestId('sim-panel').getAttribute('data-elapsed')) / 86_400;
  const fromDay = await dayAt();
  await page.waitForTimeout(MINUTES * 60_000);
  const end = await heaps();
  const growth = total(end) / total(start) - 1;
  const mb = (b: number) => (b / 1e6).toFixed(1);
  const report = `${scene.buses} buses on ${city.extent}, game days ${fromDay.toFixed(1)}–${(await dayAt()).toFixed(1)} in ${MINUTES} min at 2,700×: ${Object.keys(start)
    .map((k) => `${k} ${mb(start[k]!)} → ${mb(end[k] ?? 0)} MB`)
    .join(', ')}; total ${mb(total(start))} → ${mb(total(end))} MB, ${(growth * 100).toFixed(1)}%`;
  console.log(report);
  test.info().annotations.push({ type: 'heap', description: report });
  expect(growth).toBeLessThanOrEqual(GROWTH_BUDGET);
});
