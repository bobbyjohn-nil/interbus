// PLAN §5's week-2 count: how many of Inner Boston's buildings carry an OSM height or a level count.
// Rule (DECISIONS "Measurements to record"): under about half, Overture's lidar heights join the r1
// bake in week 5; otherwise the join is dropped. A building counts in Inner Boston when its first
// node lies inside the extent and inside one of the four municipalities' 2020 boundaries, the same
// boundaries gate G4 uses.
//
//   node tools/bake/heights.mjs boston     needs the mirrored extract and cousub (npm run bake:sources)
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readMunicipalities } from './census.mjs';
import { inRings, readCity, ROOT } from './lib.mjs';
import { ensureSource } from './sources.mjs';

const PYTHON = process.env.BAKE_PYTHON ?? 'python3';

export function countHeights(csvText, municipalities) {
  const [, ...rows] = csvText.trim().split('\n');
  const out = Object.fromEntries(municipalities.map((m) => [m.name, { buildings: 0, height: 0, levels: 0, either: 0 }]));
  for (const line of rows) {
    const [, lon, lat, height, levels] = line.split(',');
    const x = Number(lon);
    const y = Number(lat);
    const m = municipalities.find((mu) => x >= mu.bbox[0] && x <= mu.bbox[2] && y >= mu.bbox[1] && y <= mu.bbox[3] && inRings(mu.rings, x, y));
    if (!m) continue;
    const c = out[m.name];
    c.buildings++;
    if (height === '1') c.height++;
    if (levels === '1') c.levels++;
    if (height === '1' || levels === '1') c.either++;
  }
  const total = Object.values(out).reduce((t, c) => ({ buildings: t.buildings + c.buildings, either: t.either + c.either, height: t.height + c.height, levels: t.levels + c.levels }), { buildings: 0, either: 0, height: 0, levels: 0 });
  return { byMunicipality: out, total, share: total.buildings ? total.either / total.buildings : 0 };
}

async function main() {
  const cityId = process.argv[2];
  if (!cityId) {
    console.error('usage: node tools/bake/heights.mjs <city>');
    process.exit(2);
  }
  const { entry, config, lock } = readCity(cityId);
  if (!lock) throw new Error(`heights: cities/${cityId}/sources.lock.json does not exist yet`);
  const osm = await ensureSource(cityId, lock, 'osm');
  const cousub = await ensureSource(cityId, lock, 'cousub');
  const work = join(ROOT, '.cache/bake', cityId);
  mkdirSync(work, { recursive: true });
  const csv = join(work, 'buildings.csv');
  execFileSync(PYTHON, ['-I', join(ROOT, 'tools/bake/osm.py'), 'heights', osm, entry.extent.join(','), csv], { stdio: 'inherit' });
  const wanted = new Set(config.municipalities.list.map((m) => m.ctycsub));
  const municipalities = readMunicipalities(cousub)
    .filter((m) => wanted.has(m.ctycsub))
    .map((m) => ({ ...m, name: config.municipalities.list.find((l) => l.ctycsub === m.ctycsub).name }));
  const result = countHeights(readFileSync(csv, 'utf8'), municipalities);
  console.log(JSON.stringify(result, null, 2));
  console.log(`heights: ${result.total.either} of ${result.total.buildings} Inner Boston buildings (${(result.share * 100).toFixed(1)}%) carry a height or a level count`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error.message ?? error);
    process.exit(1);
  });
}
