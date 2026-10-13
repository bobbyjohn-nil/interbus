// The third-party notices the game ships (PLAN §11 "Licences and credits"): every package the
// lockfile installs for the game itself, not for its tools, with its version, its declared licence
// and its licence text, written to public/THIRD_PARTY_NOTICES.txt so the preview serves it beside
// the game. CI checks the committed file against the lockfile, so a dependency change that skips
// `node scripts/notices.mjs write` fails.
//
//   node scripts/notices.mjs write   regenerate the file
//   node scripts/notices.mjs check   fail if it differs from what the lockfile gives
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const NOTICES = join(ROOT, 'public/THIRD_PARTY_NOTICES.txt');

/** The packages the game installs, not its tools: the lockfile's entries not marked dev, by name. */
export function gamePackages(lock) {
  return Object.entries(lock.packages)
    .filter(([path, entry]) => path.startsWith('node_modules/') && !entry.dev && !entry.devOptional)
    .map(([path, entry]) => ({ path, name: path.slice(path.lastIndexOf('node_modules/') + 'node_modules/'.length), version: entry.version, license: entry.license ?? 'unstated' }))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/** A package's licence text, from the first file named like a licence in its folder, or null. */
function licenceText(dir) {
  if (!existsSync(dir)) return null;
  const file = readdirSync(dir)
    .filter((f) => /^(licen[cs]e|copying)(\.(md|txt|markdown))?$/i.test(f))
    .sort()[0];
  return file ? readFileSync(join(dir, file), 'utf8').replace(/\r\n/g, '\n').trim() : null;
}

/** The notices file for `lock`, reading licence texts from `root`'s node_modules. */
export function notices(lock, root = ROOT) {
  const parts = [
    'Third-party software in interbus',
    '',
    'The game is built with the packages below, each under its own licence, reproduced here as each',
    'package ships it. Generated from package-lock.json by scripts/notices.mjs; do not edit by hand.',
    'The game’s data and font licences are in LICENSE-DATA.md in the repository.',
  ];
  for (const p of gamePackages(lock)) {
    const text = licenceText(join(root, p.path));
    parts.push('', '='.repeat(72), `${p.name} ${p.version} (${p.license})`, '='.repeat(72), '', text ?? `The package ships no licence file; its package.json declares ${p.license}.`);
  }
  return `${parts.join('\n')}\n`;
}

function main([command]) {
  const lock = JSON.parse(readFileSync(join(ROOT, 'package-lock.json'), 'utf8'));
  const want = notices(lock);
  if (command === 'write') {
    writeFileSync(NOTICES, want);
    console.log(`notices: ${gamePackages(lock).length} packages written to public/THIRD_PARTY_NOTICES.txt`);
  } else if (command === 'check') {
    const got = existsSync(NOTICES) ? readFileSync(NOTICES, 'utf8') : '';
    if (got !== want) throw new Error('notices: public/THIRD_PARTY_NOTICES.txt is out of date; run `node scripts/notices.mjs write`');
    console.log(`notices: ${gamePackages(lock).length} packages, up to date`);
  } else {
    throw new Error('usage: node scripts/notices.mjs write | check');
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    main(process.argv.slice(2));
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
}
