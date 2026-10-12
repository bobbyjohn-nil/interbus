// Keeps the last two deploys' hashed files alive in the new deploy, so a cached index.html or a tab
// left open never loads a chunk or city file that 404s (CLAUDE.md deploy gate 6, DP-01). GitHub
// Pages replaces the whole site on every deploy and caches pages for about 10 minutes.
// Ported from Intralines@7af45b1:scripts/retain-assets.mjs (d66e6dc), keeping 3 builds instead of 8.
//
//   LIVE_URL=https://bobbyjohn-nil.github.io/interbus node scripts/deploy/retain-assets.mjs [dist]
//
// Best-effort by design: the first deploy has nothing to keep, and a file already gone from the live
// site is dropped from the manifest. It never fails the deploy.
import { createWriteStream, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { pathToFileURL } from 'node:url';

export const KEEP_BUILDS = 3; // this one and the two before it
const RETAINED = /^(assets|cities)\/[\w.@-]+$/;

function filesIn(dist, dir) {
  const full = join(dist, dir);
  return existsSync(full) ? readdirSync(full).filter((f) => !f.endsWith('.map')).map((f) => `${dir}/${f}`) : [];
}

export async function retain({ dist, live, id, log = console.log }) {
  const current = [...filesIn(dist, 'assets'), ...filesIn(dist, 'cities')];
  let prior = [];
  try {
    const res = await fetch(`${live}/asset-manifest.json?run=${encodeURIComponent(id)}`, { cache: 'no-store' });
    if (res.ok) {
      const manifest = await res.json();
      if (Array.isArray(manifest.builds)) prior = manifest.builds;
    }
  } catch (error) {
    log(`retain-assets: no previous manifest reachable (${error.message})`);
  }
  prior = prior.filter((b) => b && b.id !== id && Array.isArray(b.files)).slice(0, KEEP_BUILDS - 1);

  const have = new Set(current);
  let fetched = 0;
  let missed = 0;
  for (const build of prior) {
    for (const file of build.files) {
      if (have.has(file) || !RETAINED.test(file)) continue;
      have.add(file);
      try {
        const res = await fetch(`${live}/${file}`);
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
        mkdirSync(dirname(join(dist, file)), { recursive: true });
        await pipeline(Readable.fromWeb(res.body), createWriteStream(join(dist, file)));
        fetched++;
      } catch {
        missed++;
        build.files = build.files.filter((f) => f !== file);
      }
    }
  }
  const manifest = { builds: [{ id, files: current }, ...prior] };
  writeFileSync(join(dist, 'asset-manifest.json'), `${JSON.stringify(manifest, null, 1)}\n`);
  log(`retain-assets: kept ${prior.length} earlier build(s), fetched ${fetched} file(s)${missed ? `, ${missed} already gone` : ''}`);
  return manifest;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const live = process.env.LIVE_URL;
  if (!live) {
    console.error('retain-assets: set LIVE_URL to the live site, e.g. https://bobbyjohn-nil.github.io/interbus');
    process.exit(1);
  }
  const id = process.env.BUILD_SHA ?? process.env.GITHUB_SHA ?? 'local';
  await retain({ dist: resolve(process.argv[2] ?? 'dist'), live: live.replace(/\/$/, ''), id });
}
