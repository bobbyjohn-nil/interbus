// Downloads each city's tile file named in cities/index.json into public/cities/, checking its
// SHA-256 and size. The deploy runs this and fails on any missing or mismatched file; players'
// browsers never fetch source data (CLAUDE.md, WD-01).
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

async function main() {
  const require = process.argv.includes('--require');
  const { cities } = JSON.parse(readFileSync(join(ROOT, 'cities/index.json'), 'utf8'));
  mkdirSync(OUT, { recursive: true });
  for (const city of cities) {
    const tiles = city.tiles;
    if (!tiles) {
      const message = `cities: ${city.name} has no tile file yet`;
      if (require) throw new Error(message);
      console.log(message);
      continue;
    }
    const target = join(OUT, tiles.file);
    if (existsSync(target) && statSync(target).size === tiles.bytes && sha256(readFileSync(target)) === tiles.sha256) {
      console.log(`cities: ${tiles.file} up to date`);
      continue;
    }
    const res = await fetch(tiles.url);
    if (!res.ok) throw new Error(`cities: HTTP ${res.status} for ${tiles.url}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length !== tiles.bytes || sha256(buf) !== tiles.sha256) {
      throw new Error(`cities: ${tiles.file} does not match cities/index.json (got ${buf.length} B, sha256 ${sha256(buf)})`);
    }
    writeFileSync(`${target}.part`, buf);
    renameSync(`${target}.part`, target);
    console.log(`cities: ${tiles.file} ${buf.length} B verified`);
  }
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
