// I15: a page from the previous deploy keeps working after the next deploy replaces the site,
// because the deploy retains the last two builds' hashed files (CLAUDE.md deploy gate 6, DP-01).
// When a file is gone anyway, the page says so with the replaced-build card instead of a blank map.
import { execFileSync } from 'node:child_process';
import { cpSync, copyFileSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { retain } from '../scripts/deploy/retain-assets.mjs';
import { serve } from './staticServer';

const WORK = resolve('.cache/swap');
const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);
const registry = JSON.parse(readFileSync('cities/index.json', 'utf8')) as { cities: { tiles: { file: string } | null }[] };
const CITY_FILE = registry.cities[0]?.tiles?.file ?? '';
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

const servers: { close: () => Promise<void> }[] = [];
let retainedUrl = '';
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
  const live = await serve(`${WORK}/a`);
  servers.push(live);

  // Deploy 2: build B, once with retention (what the deploy does) and once without (the control).
  build(`${WORK}/b-plain`, SHA_B);
  cpSync(`${WORK}/b-plain`, `${WORK}/b-retained`, { recursive: true });
  await retain({ dist: `${WORK}/b-retained`, live: live.url, id: SHA_B, log: quiet });

  // A browser still holding build A's index.html, from its cache or an open tab.
  for (const site of ['b-plain', 'b-retained']) copyFileSync(`${WORK}/a/index.html`, `${WORK}/${site}/stale.html`);

  const retained = await serve(`${WORK}/b-retained`);
  const plain = await serve(`${WORK}/b-plain`);
  servers.push(retained, plain);
  retainedUrl = retained.url;
  plainUrl = plain.url;
});

test.afterAll(async () => {
  await Promise.all(servers.map((s) => s.close()));
});

test('a stale page from the previous build still draws its map after the next deploy', async ({ page }) => {
  const missing = watch404s(page);
  const cityReads: string[] = [];
  page.on('response', (r) => {
    if (r.url().includes('/cities/')) cityReads.push(`${r.status()} ${r.url().split('/').pop()}`);
  });
  await page.goto(`${retainedUrl}/stale.html`);
  await expect(page.getByTestId('build-chip')).toHaveAttribute('data-sha', SHA_A);
  await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 60_000 });
  // It read build A's own city file, which only retention kept on the site.
  expect(cityReads.some((r) => r.endsWith(CITY_FILE_A) && /^20[06] /.test(r))).toBe(true);
  expect(missing).toEqual([]);
});

test('without retention the same stale page breaks (the test bites)', async ({ page }) => {
  const missing = watch404s(page);
  await page.goto(`${plainUrl}/stale.html`);
  await expect(page.getByTestId('build-chip')).toHaveCount(0);
  expect(missing.some((u) => u.includes('/assets/'))).toBe(true);
});

test('the live site still serves the current build', async ({ page }) => {
  await page.goto(`${retainedUrl}/`);
  await expect(page.getByTestId('build-chip')).toHaveAttribute('data-sha', SHA_B);
  await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'ready', { timeout: 60_000 });
});

// Past the retention window a stale page's files are gone for good. Each one says so with the
// card, never a blank or endlessly loading map (CLAUDE.md "Architecture guardrails").
for (const [what, file] of [
  ['lazy map chunk', () => fileOfA(/^loadMap-.*\.js$/)],
  ['map worker', () => fileOfA(/^maplibre-gl-worker-.*\.js$/)],
  ['city file', () => `cities/${CITY_FILE_A}`],
] as const) {
  test(`a stale page whose ${what} is gone shows the replaced-build card`, async ({ page }) => {
    const site = await serve(`${WORK}/b-retained`, [file()]);
    servers.push(site);
    await page.goto(`${site.url}/stale.html`);
    await expect(page.getByTestId('build-chip')).toHaveAttribute('data-sha', SHA_A);
    await expect(page.getByTestId('replaced-card')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('map')).toHaveAttribute('data-status', 'replaced');
  });
}
