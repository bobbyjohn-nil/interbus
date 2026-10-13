// The full bake's inputs (PLAN §5): the mirrored sources clipped to a city's play extent, in the
// same files the committed fixture holds, so one bake reads either. The play area is the city's
// municipalities (city.json) inside the extent box in cities/index.json (D11); blocks outside them
// are left out, streets are every drivable way that touches the box. Nothing here is committed:
// the files go to .cache/bake/<city>/<extent>/ and are reused while the sources and the box match.
//
//   node tools/bake/extent.mjs <city>     cut the play extent (about 5 minutes, most of it osm.py)
//
// Gate G4 runs first, as in the fixture cut, and the cut refuses to write if it fails.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { assignMunicipalities, blocksCsv, clipBlocks, clipLodes, controlTotals, readBlocks, readMunicipalities } from './census.mjs';
import { inBox, readCity, ROOT } from './lib.mjs';
import { ensureSource } from './sources.mjs';

const PYTHON = process.env.BAKE_PYTHON ?? 'python3';
/** The sources the bake reads; the OD files wait for gateways. */
const USED = ['osm', 'blocks', 'cousub', 'lodes-rac', 'lodes-wac'];

/** The play extent's id and box: city.json names it, cities/index.json holds its box (K18). */
export function playExtent(cityId) {
  const { entry, config } = readCity(cityId);
  if (!config.extent?.id) throw new Error(`extent: cities/${cityId}/city.json names no play extent`);
  return { id: config.extent.id, box: entry.extent };
}

export const extentDir = (cityId, extentId) => join(ROOT, '.cache/bake', cityId, extentId);

/** Cuts the play extent's inputs unless an up-to-date cut is already there; returns its directory. */
export async function cutExtent(cityId) {
  const { config, lock } = readCity(cityId);
  if (!lock) throw new Error(`extent: cities/${cityId}/sources.lock.json does not exist yet; run the "Bake sources" workflow`);
  const { id, box } = playExtent(cityId);
  const dir = extentDir(cityId, id);
  const sources = Object.fromEntries(lock.sources.filter((s) => USED.includes(s.id)).map((s) => [s.id, s.sha256]));
  const play = config.municipalities.list.map((m) => m.ctycsub);
  const want = { city: cityId, extent: id, box, municipalities: play, sources };
  const manifestPath = join(dir, 'extent.json');
  if (existsSync(manifestPath)) {
    const have = JSON.parse(readFileSync(manifestPath, 'utf8'));
    if (JSON.stringify(have.cut) === JSON.stringify(want)) {
      console.log(`extent: ${id} is already cut for these sources`);
      return dir;
    }
  }

  const src = {};
  for (const s of USED) src[s] = await ensureSource(cityId, lock, s);
  const blocks = readBlocks(src.blocks);
  const counties = new Set(play.map((c) => c.slice(0, 5)));
  const assigned = assignMunicipalities(blocks, readMunicipalities(src.cousub), (b) => counties.has(b.geoid.slice(0, 5)) || inBox(box, b.lon, b.lat));
  const g4 = controlTotals(blocks.filter((b) => assigned.has(b.geoid)), assigned, config.municipalities.list);
  for (const r of g4.rows) console.log(`extent: G4 ${r.name} Σ POP20 ${r.sum} (census ${r.pop20}) ${r.ok ? 'ok' : 'MISMATCH'}`);
  if (!g4.ok) throw new Error(`extent: gate G4 failed${g4.unknown.length ? `; ${g4.unknown.length} blocks in no municipality` : ''}`);

  const work = `${dir}.part`;
  rmSync(work, { recursive: true, force: true });
  mkdirSync(work, { recursive: true });
  const inBoxed = clipBlocks(blocks, assigned, box);
  const inPlay = inBoxed.filter((b) => play.includes(b.ctycsub));
  writeFileSync(join(work, 'blocks.csv'), blocksCsv(inPlay));
  const inside = new Set(inPlay.map((b) => b.geoid));
  for (const [sourceId, kind] of [['lodes-rac', 'rac'], ['lodes-wac', 'wac']]) writeFileSync(join(work, `${sourceId}.csv`), await clipLodes(src[sourceId], kind, inside));
  const osm = JSON.parse(execFileSync(PYTHON, ['-I', join(ROOT, 'tools/bake/osm.py'), 'clip', src.osm, box.join(','), join(work, 'osm.opl')], { encoding: 'utf8' }));
  const manifest = {
    about: 'Written by tools/bake/extent.mjs; the cut is reused while `cut` matches. Not committed.',
    cut: want,
    blocks: { inBox: inBoxed.length, inPlayArea: inPlay.length, residents: inPlay.reduce((s, b) => s + b.pop20, 0), leftOut: inBoxed.length - inPlay.length },
    osm,
  };
  writeFileSync(join(work, 'extent.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  rmSync(dir, { recursive: true, force: true });
  renameSync(work, dir);
  console.log(`extent: ${id} cut; ${inPlay.length} of the box's ${inBoxed.length} blocks lie in the play area (${manifest.blocks.residents} residents); OSM ${osm.ways} ways`);
  return dir;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [cityId] = process.argv.slice(2);
  if (!cityId) {
    console.error('usage: node tools/bake/extent.mjs <city>');
    process.exit(2);
  }
  cutExtent(cityId).catch((error) => {
    console.error(error.message ?? error);
    process.exit(1);
  });
}
