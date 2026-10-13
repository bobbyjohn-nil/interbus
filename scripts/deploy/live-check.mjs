// The deploy's last step (CLAUDE.md deploy gate 5): load the live preview with a cache-busting
// query until both version.json and the on-screen build chip show the commit just deployed.
// Also records how Pages serves the city file (Range 206 or not, and its cache lifetime), the
// week-1 header check (PLAN §14 item 4).
//
//   node scripts/deploy/live-check.mjs <url> <sha> <run-id>
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';

const [url, sha, run] = process.argv.slice(2);
if (!url || !sha || !run) {
  console.error('usage: live-check.mjs <url> <sha> <run-id>');
  process.exit(2);
}
const base = url.endsWith('/') ? url : `${url}/`;
const deadline = Date.now() + 15 * 60_000;
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

async function pollVersion() {
  for (let attempt = 1; Date.now() < deadline; attempt++) {
    try {
      const res = await fetch(`${base}version.json?run=${run}-${attempt}`, { cache: 'no-store' });
      if (res.ok) {
        const live = await res.json();
        if (live.sha === sha) return live;
        console.log(`live-check: version.json shows ${String(live.sha).slice(0, 7)}, waiting for ${sha.slice(0, 7)}`);
      } else {
        console.log(`live-check: version.json HTTP ${res.status}`);
      }
    } catch (error) {
      console.log(`live-check: ${error.message}`);
    }
    await sleep(15_000);
  }
  throw new Error(`live-check: ${sha.slice(0, 7)} never appeared in version.json`);
}

async function checkChip() {
  // PW_CHROMIUM points at a preinstalled Chromium locally, as in playwright.config.ts; CI installs Playwright's own.
  const executablePath = process.env.PW_CHROMIUM || undefined;
  const browser = await chromium.launch({ ...(executablePath ? { executablePath } : {}), args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
  try {
    const page = await browser.newPage();
    await page.goto(`${base}?run=${run}`);
    const chip = page.getByTestId('build-chip');
    await chip.waitFor({ timeout: 30_000 });
    const shown = await chip.getAttribute('data-sha');
    if (shown !== sha) throw new Error(`live-check: the build chip shows ${shown}, expected ${sha}`);
    const { cities } = JSON.parse(readFileSync('cities/index.json', 'utf8'));
    if (cities.some((c) => c.tiles)) {
      // A deploy is not live until the map draws: the week-1 bugs (a worker that 404'd, a map 0 px
      // tall) both left the chip correct and the map blank.
      const map = page.getByTestId('map');
      await page.waitForSelector('[data-testid=map][data-status=ready]', { state: 'attached', timeout: 90_000 });
      const box = await map.boundingBox();
      const viewport = page.viewportSize();
      if (!box || !viewport || box.width < viewport.width * 0.99 || box.height < viewport.height * 0.99) {
        throw new Error(`live-check: the map is ${box?.width}x${box?.height}, not the full window`);
      }
    }
    if (cities.some((c) => c.sim)) {
      // The sim worker started on this deploy's sim file: Home, the first screen, appears only once
      // it is ready (the M5 spec, item 3; the chip row waits for the game behind it).
      await page.getByTestId('home').waitFor({ timeout: 60_000 });
      console.log('live-check: the sim worker is running on the city\'s sim file');
    }
    console.log(`live-check: build chip shows ${sha.slice(0, 7)}; the map is ready and fills the window`);
  } finally {
    await browser.close();
  }
}

async function cityHeaders() {
  const { cities } = JSON.parse(readFileSync('cities/index.json', 'utf8'));
  for (const city of cities) {
    if (!city.tiles) continue;
    const res = await fetch(`${base}cities/${city.tiles.file}`, { headers: { Range: 'bytes=0-511' } });
    await res.body?.cancel();
    console.log(
      `live-check: ${city.tiles.file}: HTTP ${res.status} (206 means Range works), ` +
        `cache-control "${res.headers.get('cache-control')}", accept-ranges "${res.headers.get('accept-ranges')}"`,
    );
  }
}

await pollVersion();
await checkChip();
await cityHeaders();
console.log(`live-check: ${base} is ${sha}`);
