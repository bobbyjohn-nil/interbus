// Mini-Boston (PLAN §5): every bake input clipped to the fixture box in city.json and committed, so
// PR checks, the economy and M1 run without the full bake.
//
//   node tools/bake/fixture.mjs <city> cut     clip the mirrored sources into tools/bake/fixtures/<id>/
//   node tools/bake/fixture.mjs <city> check   the committed files match fixture.json, and fixture.json
//                                              matches city.json and the lock (no network; PR CI)
//
// `cut` also runs gate G4 on the whole state's blocks and refuses to write if it fails.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { blocksCsv, clipBlocks, clipLodes, controlTotals, readBlocks, readCrosswalk } from './census.mjs';
import { readCity, ROOT, sha256 } from './lib.mjs';
import { ensureSource } from './sources.mjs';

const PYTHON = process.env.BAKE_PYTHON ?? 'python3';
export const fixtureDir = (fixtureId) => join(ROOT, 'tools/bake/fixtures', fixtureId);

const LODES = [
  ['lodes-rac', 'rac'],
  ['lodes-wac', 'wac'],
  ['lodes-od-main', 'od'],
  ['lodes-od-aux', 'od'],
];

async function cut(cityId) {
  const { config, lock } = readCity(cityId);
  if (!lock) throw new Error(`fixture: cities/${cityId}/sources.lock.json does not exist yet; run the "Bake sources" workflow`);
  const { id, box } = config.fixture;
  const src = {};
  for (const s of lock.sources) src[s.id] = await ensureSource(cityId, lock, s.id);

  // Gate G4 on the whole state, before anything is written.
  const blocks = readBlocks(src.blocks);
  const crosswalk = await readCrosswalk(src['lodes-xwalk']);
  const g4 = controlTotals(blocks, crosswalk, config.municipalities.list);
  for (const r of g4.rows) console.log(`fixture: G4 ${r.name} Σ POP20 ${r.sum} (census ${r.pop20}) ${r.ok ? 'ok' : 'MISMATCH'}`);
  if (!g4.ok) {
    throw new Error(`fixture: gate G4 failed${g4.unknown.length ? `; ${g4.unknown.length} blocks missing from the crosswalk` : ''}`);
  }

  const work = `${fixtureDir(id)}.part`;
  rmSync(work, { recursive: true, force: true });
  mkdirSync(work, { recursive: true });
  const files = {};
  const write = (name, text, rows) => {
    writeFileSync(join(work, name), text);
    files[name] = { bytes: Buffer.byteLength(text), sha256: sha256(text), rows };
  };

  const clipped = clipBlocks(blocks, crosswalk, box);
  write('blocks.csv', blocksCsv(clipped), clipped.length);
  const inside = new Set(clipped.map((b) => b.geoid));
  for (const [sourceId, kind] of LODES) {
    const text = await clipLodes(src[sourceId], kind, inside);
    write(`${sourceId}.csv`, text, text.split('\n').length - 2);
  }

  const osmOut = join(work, 'osm.opl');
  const counts = JSON.parse(
    execFileSync(PYTHON, ['-I', join(ROOT, 'tools/bake/osm.py'), 'clip', src.osm, box.join(','), osmOut], { encoding: 'utf8' }),
  );
  const opl = readFileSync(osmOut, 'utf8');
  files['osm.opl'] = { bytes: Buffer.byteLength(opl), sha256: sha256(opl), rows: counts.nodes + counts.ways + counts.relations };

  const manifest = {
    about: 'Written by `node tools/bake/fixture.mjs <city> cut`; `check` verifies it in PR CI. Do not edit by hand.',
    city: cityId,
    fixture: id,
    box,
    sources: Object.fromEntries(lock.sources.map((s) => [s.id, s.sha256])),
    pyosmium: execFileSync(PYTHON, ['-I', '-c', 'import osmium.version as v; print(v.pyosmium_release)'], { encoding: 'utf8' }).trim(),
    g4: g4.rows.map(({ name, sum }) => ({ name, sum })),
    osm: counts,
    residents: clipped.reduce((sum, b) => sum + b.pop20, 0),
    files: Object.fromEntries(Object.entries(files).sort(([a], [b]) => (a < b ? -1 : 1))),
  };
  writeFileSync(join(work, 'fixture.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  rmSync(fixtureDir(id), { recursive: true, force: true });
  renameSync(work, fixtureDir(id));
  for (const [name, f] of Object.entries(manifest.files)) console.log(`fixture: ${name} ${f.bytes} B, ${f.rows} rows`);
  console.log(`fixture: ${id} cut; ${manifest.residents} residents in the box`);
}

/** Problems with the committed fixture, or an empty list. */
export function checkFixture(cityId) {
  const { config, lock } = readCity(cityId);
  const dir = fixtureDir(config.fixture.id);
  if (!existsSync(join(dir, 'fixture.json'))) return [`${config.fixture.id} has not been cut yet`];
  const manifest = JSON.parse(readFileSync(join(dir, 'fixture.json'), 'utf8'));
  const problems = [];
  if (JSON.stringify(manifest.box) !== JSON.stringify(config.fixture.box)) {
    problems.push(`fixture.json box ${JSON.stringify(manifest.box)} is not city.json's ${JSON.stringify(config.fixture.box)}; re-cut it`);
  }
  for (const s of lock?.sources ?? []) {
    if (manifest.sources[s.id] !== s.sha256) problems.push(`${s.id} was cut from another source file than the lock names; re-cut it`);
  }
  for (const [name, f] of Object.entries(manifest.files)) {
    const path = join(dir, name);
    if (!existsSync(path)) {
      problems.push(`${name} is missing`);
      continue;
    }
    const data = readFileSync(path);
    if (data.length !== f.bytes || sha256(data) !== f.sha256) problems.push(`${name} does not match fixture.json`);
  }
  return problems;
}

async function main() {
  const [cityId, command] = process.argv.slice(2);
  if (!cityId || !['cut', 'check'].includes(command ?? '')) {
    console.error('usage: node tools/bake/fixture.mjs <city> cut|check');
    process.exit(2);
  }
  if (command === 'cut') return cut(cityId);
  const problems = checkFixture(cityId);
  for (const p of problems) console.error(`fixture: ${p}`);
  if (problems.length) process.exit(1);
  console.log(`fixture: ${readCity(cityId).config.fixture.id} matches fixture.json`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error.message ?? error);
    process.exit(1);
  });
}
