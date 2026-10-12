// The bake's only step that touches the source servers (PLAN §5): downloads every source named in
// cities/<city>/city.json, checks what can be checked (Geofabrik's MD5), names the OSM extract by
// its own timestamp, and writes cities/<city>/sources.lock.json with each file's size and SHA-256.
// The dispatch-only "Bake sources" workflow runs it and mirrors the files to a GitHub release;
// every later bake reads only that mirror (tools/bake/sources.mjs).
//
//   node tools/bake/fetch.mjs <city> <retrieved YYYY-MM-DD>
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createWriteStream, mkdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { lockPath, readCity, ROOT, sourcesDir } from './lib.mjs';

const REPO = process.env.GITHUB_REPOSITORY ?? 'bobbyjohn-nil/interbus';
const PYTHON = process.env.BAKE_PYTHON ?? 'python3';

/** Streams a URL to a file, returning its size, SHA-256 and MD5. */
async function download(url, target) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok || !res.body) throw new Error(`fetch: HTTP ${res.status} for ${url}`);
  const sha = createHash('sha256');
  const md5 = createHash('md5');
  let bytes = 0;
  const body = Readable.fromWeb(res.body);
  body.on('data', (chunk) => {
    sha.update(chunk);
    md5.update(chunk);
    bytes += chunk.length;
  });
  await pipeline(body, createWriteStream(`${target}.part`));
  renameSync(`${target}.part`, target);
  return { bytes, sha256: sha.digest('hex'), md5: md5.digest('hex') };
}

/** The mirror's file name for the OSM extract: Geofabrik's "-latest" renamed by the data's own date. */
function osmDate(file) {
  const out = execFileSync(PYTHON, ['-I', join(ROOT, 'tools/bake/osm.py'), 'header', file], { encoding: 'utf8' });
  const { timestamp } = JSON.parse(out);
  const m = /^(\d{4})-(\d{2})-(\d{2})T/.exec(timestamp);
  if (!m) throw new Error(`fetch: the OSM extract has no replication timestamp (got "${timestamp}")`);
  return { timestamp, date: `${m[1]}${m[2]}${m[3]}` };
}

async function main() {
  const [cityId, retrieved] = process.argv.slice(2);
  if (!cityId || !/^\d{4}-\d{2}-\d{2}$/.test(retrieved ?? '')) {
    console.error('usage: node tools/bake/fetch.mjs <city> <retrieved YYYY-MM-DD>');
    process.exit(2);
  }
  const { config } = readCity(cityId);
  const dir = sourcesDir(cityId);
  mkdirSync(dir, { recursive: true });
  const tag = `city-${cityId}-sources-${retrieved.replaceAll('-', '')}`;
  const sources = [];
  for (const source of config.sources) {
    const tmp = join(dir, `${source.id}.download`);
    rmSync(tmp, { force: true });
    console.log(`fetch: ${source.id} ← ${source.url}`);
    const got = await download(source.url, tmp);
    const entry = { id: source.id, url: source.url, bytes: got.bytes, sha256: got.sha256 };
    let asset = basename(new URL(source.url).pathname);
    if (source.md5Url) {
      const res = await fetch(source.md5Url);
      if (!res.ok) throw new Error(`fetch: HTTP ${res.status} for ${source.md5Url}`);
      const expected = (await res.text()).trim().split(/\s+/)[0];
      if (expected !== got.md5) throw new Error(`fetch: ${source.id} MD5 ${got.md5} does not match ${expected}`);
      entry.md5 = got.md5;
    }
    if (source.mirrorAs?.includes('{osmDate}')) {
      const { timestamp, date } = osmDate(tmp);
      asset = source.mirrorAs.replace('{osmDate}', date);
      entry.osmTimestamp = timestamp;
    }
    renameSync(tmp, join(dir, asset));
    entry.asset = asset;
    if (statSync(join(dir, asset)).size !== got.bytes) throw new Error(`fetch: ${asset} changed size on disk`);
    console.log(`fetch: ${asset} ${got.bytes} B sha256 ${got.sha256}`);
    sources.push(entry);
  }
  const lock = {
    about: 'Written by tools/bake/fetch.mjs; the bake reads these files only from the mirror release, never from the source servers (PLAN §5).',
    city: cityId,
    retrieved,
    mirror: { tag, base: `https://github.com/${REPO}/releases/download/${tag}/` },
    sources,
  };
  writeFileSync(lockPath(cityId), `${JSON.stringify(lock, null, 2)}\n`);
  console.log(`fetch: wrote ${lockPath(cityId)}; mirror tag ${tag}`);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
