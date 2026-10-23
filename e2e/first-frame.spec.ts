// I14's first frame (PLAN §6): on software GL, the map's first visually complete frame (MapLibre's
// 'load', marked interbus:map-load) comes within 2.5 s of the page's start, the median of three cold
// loads. The board ready, every overlay drawn and idle (interbus:map-ready), comes later and is
// printed beside it. CI's Chromium renders in software (SwiftShader), as the budget asks. The budget is
// the shipped build's, so this runs only where SHIPPED_BUILD=1: CI's smoke step, on Inner Boston.
import { expect, test } from './base';
import { MAP_LOADED_MARK, MAP_READY_MARK } from '../src/render/map/status';

/** I14: the first frame on software GL, in milliseconds from the page's start. */
const FIRST_FRAME_MS = 2_500;

test('the map’s first full frame comes within 2.5 s on software GL', async ({ browser }) => {
  test.skip(process.env.SHIPPED_BUILD !== '1', 'the shipped build’s budget: set SHIPPED_BUILD=1 after npm run build');
  test.setTimeout(120_000);
  const runs: { load: number; ready: number }[] = [];
  for (let i = 0; i < 3; i++) {
    // A new context each time: nothing cached from the load before.
    const context = await browser.newContext({ baseURL: test.info().project.use.baseURL! });
    const page = await context.newPage();
    await page.goto('./');
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    runs.push(
      await page.evaluate(([load, ready]) => {
        const at = (name: string) => Math.round(performance.getEntriesByName(name)[0]?.startTime ?? Infinity);
        return { load: at(load), ready: at(ready) };
      }, [MAP_LOADED_MARK, MAP_READY_MARK] as const),
    );
    await context.close();
  }
  const median = runs.map((r) => r.load).sort((a, b) => a - b)[1]!;
  console.log(`first frame (ms): ${runs.map((r) => r.load).join(', ')}; board ready: ${runs.map((r) => r.ready).join(', ')}`);
  test.info().annotations.push({ type: 'first frame', description: JSON.stringify(runs) });
  expect(median).toBeLessThanOrEqual(FIRST_FRAME_MS);
});
