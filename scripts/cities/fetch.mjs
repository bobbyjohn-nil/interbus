// Downloads each city's files named in cities/index.json (its tiles, and its sim.json once one is
// named) into public/cities/, checking each one's SHA-256 and size. The deploy runs this and fails
// on any missing or mismatched file; players' browsers never fetch source data (CLAUDE.md, WD-01).
//
//   npm run cities              fetch what is missing
//   npm run cities -- --require fail if a city has no tile file yet (the deploy)
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'public/cities');
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

/**
 * The file at `url`. GitHub's own failure, an HTTP 5xx or a dropped connection, is tried again, `tries` times in all and
 * `delayMs` apart, as the deploy's asset retention tries its manifest: a 504 on Inner Boston's sim file failed #206's deploy
 * on its one try (Deploy preview run 41999545377). Any other answer, a 404 among them, is the file's own and fails at once.
 */
export async function download(url, { tries = 3, delayMs = 3000, log = console.log, get = fetch } = {}) {
  for (let attempt = 1; ; attempt++) {
    let why;
    let res = null;
    try {
      res = await get(url);
    } catch (error) {
      why = error.message;
    }
    if (res?.ok) {
      try {
        return Buffer.from(await res.arrayBuffer());
      } catch (error) {
        why = error.message;
      }
    } else if (res) {
      if (res.status < 500) throw new Error(`cities: HTTP ${res.status} for ${url}`);
      why = `HTTP ${res.status}`;
    }
    if (attempt >= tries) throw new Error(`cities: ${why} for ${url} (try ${attempt} of ${tries})`);
    log(`cities: ${why} for ${url} (try ${attempt} of ${tries}), trying again`);
    await new Promise((done) => setTimeout(done, delayMs));
  }
}

/** Downloads one named file unless an identical copy is already there; refuses any mismatch. */
async function fetchFile(entry) {
  const target = join(OUT, entry.file);
  if (existsSync(target) && statSync(target).size === entry.bytes && sha256(readFileSync(target)) === entry.sha256) {
    console.log(`cities: ${entry.file} up to date`);
    return;
  }
  const buf = await download(entry.url);
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

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error.message ?? error);
    process.exit(1);
  });
}
