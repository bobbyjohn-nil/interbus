// Builds Afacad Flux for the game (D13, PLAN §8 rule 5): two static instances (400 and 600) cut
// from the pinned variable font, Latin woff2 files for the interface, and MapLibre SDF glyph ranges
// for every one of the 256 ranges per stack, so no glyph request 404s. Outputs go to public/fonts/
// (not committed); a stamp skips the work when nothing pinned has changed.
//
//   npm run fonts            build if the stamp is stale
//   npm run fonts -- --force rebuild
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import fontnik from 'fontnik';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const LOCK_PATH = join(ROOT, 'scripts/fonts/fonts.lock.json');
const REQUIREMENTS = join(ROOT, 'scripts/fonts/requirements.txt');
const CACHE = join(ROOT, '.cache/fonts');
const OUT = join(ROOT, 'public/fonts');
const STAMP = join(OUT, '.stamp');

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const range = promisify(fontnik.range);

// fontnik draws the glyph ranges, so its installed version is part of what was built.
const FONTNIK_PACKAGE = join(ROOT, 'node_modules/fontnik/package.json');

function stampOf() {
  const h = createHash('sha256');
  for (const f of [LOCK_PATH, REQUIREMENTS, FONTNIK_PACKAGE, fileURLToPath(import.meta.url)]) h.update(readFileSync(f));
  return h.digest('hex');
}

async function download(url, expectedSha) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fonts: HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const got = sha256(buf);
  if (expectedSha && got !== expectedSha) {
    throw new Error(`fonts: ${url}\n  expected sha256 ${expectedSha}\n  got      ${got}\nRe-pin scripts/fonts/fonts.lock.json deliberately if the source really changed.`);
  }
  return buf;
}

/** A venv holding exactly the pinned tools; rebuilt whenever requirements.txt changes. */
function python() {
  const venv = join(CACHE, 'venv');
  const bin = join(venv, 'bin');
  const pinned = join(venv, '.requirements-sha256');
  const want = sha256(readFileSync(REQUIREMENTS));
  if (existsSync(join(bin, 'pyftsubset')) && existsSync(pinned) && readFileSync(pinned, 'utf8') === want) return bin;
  rmSync(venv, { recursive: true, force: true });
  execFileSync('python3', ['-m', 'venv', venv], { stdio: 'inherit' });
  execFileSync(join(bin, 'pip'), ['install', '--quiet', '--require-hashes', '--only-binary=:all:', '-r', REQUIREMENTS], {
    stdio: 'inherit',
  });
  writeFileSync(pinned, want);
  return bin;
}

async function main() {
  const force = process.argv.includes('--force');
  const stamp = stampOf();
  if (!force && existsSync(STAMP) && readFileSync(STAMP, 'utf8') === stamp) {
    console.log('fonts: up to date');
    return;
  }

  const lock = JSON.parse(readFileSync(LOCK_PATH, 'utf8'));
  const raw = (path) => `https://raw.githubusercontent.com/${lock.source.repo}/${lock.source.commit}/${path.split('/').map(encodeURIComponent).join('/')}`;
  mkdirSync(CACHE, { recursive: true });

  const srcPath = join(CACHE, `source-${lock.source.font.sha256.slice(0, 12)}.ttf`);
  if (!existsSync(srcPath) || sha256(readFileSync(srcPath)) !== lock.source.font.sha256) {
    writeFileSync(srcPath, await download(raw(lock.source.font.path), lock.source.font.sha256));
  }
  const licence = await download(raw(lock.source.licence.path));

  const bin = python();
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'OFL.txt'), licence);

  for (const instance of lock.instances) {
    const staticTtf = join(CACHE, `${instance.stack.replaceAll(' ', '-')}.ttf`);
    execFileSync(join(bin, 'fonttools'), ['varLib.instancer', srcPath, `wght=${instance.wght}`, 'slnt=0', '-q', '-o', staticTtf], {
      stdio: 'inherit',
    });
    execFileSync(
      join(bin, 'pyftsubset'),
      [staticTtf, `--unicodes=${lock.uiUnicodes}`, '--flavor=woff2', '--layout-features=*', `--output-file=${join(OUT, instance.file)}`],
      { stdio: 'inherit' },
    );

    const font = readFileSync(staticTtf);
    const dir = join(OUT, instance.stack);
    mkdirSync(dir, { recursive: true });
    let withGlyphs = 0;
    let bytes = 0;
    for (let start = 0; start < 65536; start += 256) {
      const end = start + 255;
      const pbf = await range({ font, start, end });
      writeFileSync(join(dir, `${start}-${end}.pbf`), pbf);
      bytes += pbf.length;
      if (pbf.length > 64) withGlyphs++;
    }
    const woff = statSync(join(OUT, instance.file)).size;
    console.log(`fonts: ${instance.stack}: ${instance.file} ${woff} B; 256 glyph ranges, ${withGlyphs} with glyphs, ${bytes} B`);
  }

  writeFileSync(STAMP, stamp);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
