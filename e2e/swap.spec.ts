// I15: a page from two deploys ago keeps working after the next deploys replace the site, because
// each deploy retains the last two builds' hashed files (CLAUDE.md deploy gate 6, DP-01). When a
// file is gone anyway, the page says so with the replaced-build card instead of a blank map.
import { execFileSync } from 'node:child_process';
import { cpSync, copyFileSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { retain } from '../scripts/deploy/retain-assets.mjs';
import { serve, type StaticSite } from './staticServer';

const WORK = resolve('.cache/swap');
const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);
const SHA_C = 'c'.repeat(40);
const registry = JSON.parse(readFileSync('cities/index.json', 'utf8')) as { cities: { tiles: { file: string } | null; sim: { file: string } | null }[] };
const CITY_FILE = registry.cities[0]?.tiles?.file ?? '';
const SIM_FILE = registry.cities[0]?.sim?.file ?? '';
// Build A stands for a deploy from before the last rebake, so its city file has another name and
// only retention keeps it on the site.
const CITY_FILE_A = 'boston-20260901-0000000a.pmtiles';

function build(outDir: string, sha: string) {
  execFileSync('npx', ['vite', 'build', '--outDir', outDir, '--emptyOutDir', '--logLevel', 'error'], {
    env: { ...process.env, BUILD_SHA: sha },
    stdio: 'inherit',
  });
}

/** Renames build A's city file and every reference to it in A's scripts. */
function rebakeBefore(dist: string) {
  renameSync(`${dist}/cities/${CITY_FILE}`, `${dist}/cities/${CITY_FILE_A}`);
  let rewritten = 0;
  for (const name of readdirSync(`${dist}/assets`).filter((f) => f.endsWith('.js'))) {
    const path = `${dist}/assets/${name}`;
    const code = readFileSync(path, 'utf8');
    if (!code.includes(CITY_FILE)) continue;
    writeFileSync(path, code.replaceAll(CITY_FILE, CITY_FILE_A));
    rewritten++;
  }
  if (rewritten === 0) throw new Error(`no script in build A names ${CITY_FILE}`);
}

/** Build A's own file of a kind, e.g. its lazy map chunk, by name pattern. */
function fileOfA(pattern: RegExp): string {
  const name = readdirSync(`${WORK}/a/assets`).find((f) => pattern.test(f));
  if (!name) throw new Error(`build A has no file matching ${pattern}`);
  return `assets/${name}`;
}

function watch404s(page: Page): string[] {
  const missing: string[] = [];
  page.on('response', (r) => {
    if (r.status() === 404) missing.push(r.url());
  });
  return missing;
}

const servers: StaticSite[] = [];
let site: StaticSite;
let plainUrl = '';

test.beforeAll(async () => {
  test.setTimeout(180_000);
  test.skip(!CITY_FILE, 'cities/index.json names no tile file yet');
  rmSync(WORK, { recursive: true, force: true });
  const quiet = () => {};

  // Deploy 1: build A goes live.
  build(`${WORK}/a`, SHA_A);
  rebakeBefore(`${WORK}/a`);
  await retain({ dist: `${WORK}/a`, live: 'http://127.0.0.1:9', id: SHA_A, log: quiet });
  const liveA = await serve(`${WORK}/a`);
  servers.push(liveA);

  // Deploy 2: build B, once with retention (what the deploy does) and once without (the control).
  build(`${WORK}/b-plain`, SHA_B);
  cpSync(`${WORK}/b-plain`, `${WORK}/b-retained`, { recursive: true });
  await retain({ dist: `${WORK}/b-retained`, live: liveA.url, id: SHA_B, log: quiet });
  const liveB = await serve(`${WORK}/b-retained`);
  servers.push(liveB);

  // Deploy 3: build C, inside Pages' ten-minute cache window, so A's page can still be open.
  build(`${WORK}/c`, SHA_C);
  await retain({ dist: `${WORK}/c`, live: liveB.url, id: SHA_C, log: quiet });

  // A browser still holding build A's index.html, from its cache or an open tab.
  for (const dir of ['b-plain', 'c']) copyFileSync(`${WORK}/a/index.html`, `${WORK}/${dir}/stale.html`);

  site = await serve(`${WORK}/c`);
  const plain = await serve(`${WORK}/b-plain`);
  servers.push(site, plain);
  plainUrl = plain.url;
});

test.afterAll(async () => {
  await Promise.all(servers.map((s) => s.close()));
});

test('a page from two deploys ago still draws its map, reading its own city file by range', async ({ page }) => {
  const missing = watch404s(page);
  const cityReads: string[] = [];
  page.on('response', (r) => {
    if (r.url().includes('/cities/')) cityReads.push(`${r.status()} ${r.url().split('/').pop()}`);
  });
  await page.goto(`${site.url}/stale.html`);
  await expect(page.getByTestId('build-chip')).toHaveAttribute('data-sha', SHA_A);
  const map = page.getByTestId('map');
  await expect(map).toHaveAttribute('data-status', 'ready', { timeout: 60_000 });
  await expect(map).toHaveAttribute('data-tile-reads', 'range');
  // It read build A's own city file, which only two rounds of retention kept on the site.
  expect(cityReads.some((r) => r === `206 ${CITY_FILE_A}`)).toBe(true);
  expect(missing).toEqual([]);
});

test('without retention a stale page breaks (the test bites)', async ({ page }) => {
  const missing = watch404s(page);
  await page.goto(`${plainUrl}/stale.html`);
  await expect(page.getByTestId('build-chip')).toHaveCount(0);
  expect(missing.some((u) => u.includes('/assets/'))).toBe(true);
});

test('the live site still serves the current build', async ({ page }) => {
  await page.goto(`${site.url}/`);
  await expect(page.getByTestId('build-chip')).toHaveAttribute('data-sha', SHA_C);
  await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 60_000 });
});

// Past the retention window a stale page's files are gone for good. Each one says so with the
// card, never a blank or endlessly loading map (CLAUDE.md "Architecture guardrails").
for (const [what, file] of [
  ['lazy map chunk', () => fileOfA(/^loadMap-.*\.js$/)],
  ['map worker', () => fileOfA(/^maplibre-gl-worker-.*\.js$/)],
  ['city file', () => `cities/${CITY_FILE_A}`],
  ...(SIM_FILE
    ? ([
        ['sim worker', () => fileOfA(/^sim\.worker-.*\.js$/)],
        ['sim file', () => `cities/${SIM_FILE}`],
      ] as const)
    : []),
] as const) {
  test(`a stale page whose ${what} is gone shows the replaced-build card`, async ({ page }) => {
    const gone = await serve(`${WORK}/c`, [file()]);
    servers.push(gone);
    await page.goto(`${gone.url}/stale.html`);
    await expect(page.getByTestId('build-chip')).toHaveAttribute('data-sha', SHA_A);
    await expect(page.getByTestId('replaced-card')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'replaced');
  });
}

test('a tab whose city file disappears mid-session shows the card on its next tile read', async ({ page }) => {
  const changing = await serve(`${WORK}/c`);
  servers.push(changing);
  await page.goto(`${changing.url}/stale.html`);
  const map = page.getByTestId('map');
  await expect(map).toHaveAttribute('data-status', 'ready', { timeout: 60_000 });
  await expect(map).toHaveAttribute('data-tile-reads', 'range');
  changing.hide(`cities/${CITY_FILE_A}`);
  // Zoom in so MapLibre asks for tiles it has not read yet, over open map clear of the founding card.
  const box = (await map.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.8);
  for (let i = 0; i < 4; i++) {
    await page.mouse.wheel(0, -600);
    await page.waitForTimeout(150);
  }
  await expect(page.getByTestId('replaced-card')).toBeVisible({ timeout: 30_000 });
});
