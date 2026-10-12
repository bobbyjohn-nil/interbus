// I15: a page from the previous deploy keeps working after the next deploy replaces the site,
// because the deploy retains the last two builds' hashed files (CLAUDE.md deploy gate 6, DP-01).
import { execFileSync } from 'node:child_process';
import { cpSync, copyFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { retain } from '../scripts/deploy/retain-assets.mjs';
import { serve } from './staticServer';

const WORK = resolve('.cache/swap');
const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);

function build(outDir: string, sha: string) {
  execFileSync('npx', ['vite', 'build', '--outDir', outDir, '--emptyOutDir', '--logLevel', 'error'], {
    env: { ...process.env, BUILD_SHA: sha },
    stdio: 'inherit',
  });
}

const servers: { close: () => Promise<void> }[] = [];
let retainedUrl = '';
let plainUrl = '';

test.beforeAll(async () => {
  test.setTimeout(120_000);
  rmSync(WORK, { recursive: true, force: true });
  const quiet = () => {};

  // Deploy 1: build A goes live.
  build(`${WORK}/a`, SHA_A);
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

test('a stale page from the previous build still boots after the next deploy', async ({ page }) => {
  const missing: string[] = [];
  page.on('response', (r) => {
    if (r.status() === 404) missing.push(r.url());
  });
  await page.goto(`${retainedUrl}/stale.html`);
  await expect(page.getByTestId('build-chip')).toHaveAttribute('data-sha', SHA_A);
  expect(missing).toEqual([]);
});

test('without retention the same stale page breaks (the test bites)', async ({ page }) => {
  const missing: string[] = [];
  page.on('response', (r) => {
    if (r.status() === 404) missing.push(r.url());
  });
  await page.goto(`${plainUrl}/stale.html`);
  await expect(page.getByTestId('build-chip')).toHaveCount(0);
  expect(missing.some((u) => u.includes('/assets/'))).toBe(true);
});

test('the live site still serves the current build', async ({ page }) => {
  await page.goto(`${retainedUrl}/`);
  await expect(page.getByTestId('build-chip')).toHaveAttribute('data-sha', SHA_B);
});
