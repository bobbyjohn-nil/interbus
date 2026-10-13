// Downloads each city's files named in cities/index.json (its tiles, and its sim.json once one is
// named) into public/cities/, checking each one's SHA-256 and size. The deploy runs this and fails
// on any missing or mismatched file; players' browsers never fetch source data (CLAUDE.md, WD-01).
//
//   npm run cities              fetch what is missing
//   npm run cities -- --require fail if a city has no tile file yet (the deploy)
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'public/cities');
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

/** Downloads one named file unless an identical copy is already there; refuses any mismatch. */
async function fetchFile(entry) {
  const target = join(OUT, entry.file);
  if (existsSync(target) && statSync(target).size === entry.bytes && sha256(readFileSync(target)) === entry.sha256) {
    console.log(`cities: ${entry.file} up to date`);
    return;
  }
  const res = await fetch(entry.url);
  if (!res.ok) throw new Error(`cities: HTTP ${res.status} for ${entry.url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length !== entry.bytes || sha256(buf) !== entry.sha256) {
    throw new Error(`cities: ${entry.file} does not match cities/index.json (got ${buf.length} B, sha256 ${sha256(buf)})`);
  }
  writeFileSync(`${target}.part`, buf);
  renameSync(`${target}.part`, target);
  console.log(`cities: ${entry.file} ${buf.length} B verified`);
}

async function main() {
  const require = process.argv.includes('--require');
  const { cities } = JSON.parse(readFileSync(join(ROOT, 'cities/index.json'), 'utf8'));
  mkdirSync(OUT, { recursive: true });
  for (const city of cities) {
    if (!city.tiles) {
      const message = `cities: ${city.name} has no tile file yet`;
      if (require) throw new Error(message);
      console.log(message);
    } else await fetchFile(city.tiles);
    // A sim file is optional until the first one is published (week 2); once named it is checked like tiles.
    if (city.sim) await fetchFile(city.sim);
    else console.log(`cities: ${city.name} has no sim file yet`);
    // The fixture the e2e tests play (npm run build:fixture), checked the same way.
    if (city.fixture) await fetchFile(city.fixture);
  }
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
