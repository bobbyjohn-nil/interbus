// Downloads a city's source files from its mirror release (never from the source servers) and
// checks each against cities/<city>/sources.lock.json; a missing or mismatched file fails (PLAN §5).
//
//   node tools/bake/sources.mjs <city> [id ...]     all sources, or only the ids named
import { createWriteStream, existsSync, mkdirSync, renameSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { pathToFileURL } from 'node:url';
import { readCity, sha256File, sourcesDir } from './lib.mjs';

/** Path of a verified local copy of one locked source, downloading it from the mirror if needed. */
export async function ensureSource(cityId, lock, id) {
  const entry = lock.sources.find((s) => s.id === id);
  if (!entry) throw new Error(`sources: ${id} is not in cities/${cityId}/sources.lock.json`);
  const dir = sourcesDir(cityId);
  mkdirSync(dir, { recursive: true });
  const target = join(dir, entry.asset);
  if (existsSync(target) && statSync(target).size === entry.bytes && (await sha256File(target)) === entry.sha256) {
    return target;
  }
  const url = `${lock.mirror.base}${entry.asset}`;
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`sources: HTTP ${res.status} for ${url}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(`${target}.part`));
  const bytes = statSync(`${target}.part`).size;
  const sha = await sha256File(`${target}.part`);
  if (bytes !== entry.bytes || sha !== entry.sha256) {
    throw new Error(`sources: ${entry.asset} from the mirror is ${bytes} B sha256 ${sha}; the lock says ${entry.bytes} B ${entry.sha256}`);
  }
  renameSync(`${target}.part`, target);
  return target;
}

async function main() {
  const [cityId, ...ids] = process.argv.slice(2);
  if (!cityId) {
    console.error('usage: node tools/bake/sources.mjs <city> [id ...]');
    process.exit(2);
  }
  const { lock } = readCity(cityId);
  if (!lock) throw new Error(`sources: cities/${cityId}/sources.lock.json does not exist yet; run the "Bake sources" workflow`);
  for (const id of ids.length ? ids : lock.sources.map((s) => s.id)) {
    const path = await ensureSource(cityId, lock, id);
    console.log(`sources: ${id} verified at ${path}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error.message ?? error);
    process.exit(1);
  });
}
