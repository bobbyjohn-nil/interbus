// The bake's census step (PLAN §5): 2020 blocks from the TIGER/Line .dbf, each block's municipality
// from the 2020 municipal boundaries (TIGER/Line county subdivisions), gate G4's control totals, and
// the clip of blocks and LODES rows to a box. Blocks join on their full 15-digit ids; V1 sliced them
// to 12 and merged whole block groups ("LODES parsed at 12 digits"), which G4 exists to catch.
//
// Municipalities come from the 2020 boundaries, not the LODES crosswalk: the crosswalk puts six
// populated border blocks (828 people) in Cambridge and Somerville that 2020's boundaries, and so
// the 2020 counts, put in Belmont and Medford. The crosswalk stays as a cross-check that reports them.
import { execFileSync } from 'node:child_process';
import { inBox, inRings, lines, parseDbf, parseShpPolygons, splitCsv } from './lib.mjs';

/** One member of a zip, by extension (a TIGER/Line zip holds one .shp and one .dbf). */
function unzipMember(zipPath, extension) {
  const member = execFileSync('unzip', ['-Z1', zipPath], { encoding: 'utf8' })
    .split('\n')
    .find((name) => name.endsWith(extension));
  if (!member) throw new Error(`census: no ${extension} in ${zipPath}`);
  return execFileSync('unzip', ['-p', zipPath, member], { maxBuffer: 512 * 1024 * 1024 });
}

export const BLOCK_HEADER = 'geoid,lon,lat,pop20,housing20,aland20,awater20,ctycsub';

/** Every 2020 block in a TIGER/Line tabblock20 zip: id, internal point, counts and areas. */
export function readBlocks(zipPath) {
  return blocksFromDbf(unzipMember(zipPath, '.dbf'));
}

export function blocksFromDbf(dbf) {
  const { rows } = parseDbf(dbf);
  return rows.map((r) => {
    if (!/^\d{15}$/.test(r.GEOID20 ?? '')) throw new Error(`census: block id "${r.GEOID20}" is not 15 digits`);
    return {
      geoid: r.GEOID20,
      lon: Number(r.INTPTLON20),
      lat: Number(r.INTPTLAT20),
      pop20: Number(r.POP20),
      housing20: Number(r.HOUSING20),
      aland20: Number(r.ALAND20),
      awater20: Number(r.AWATER20),
    };
  });
}

/** The 2020 municipal boundaries in a TIGER/Line cousub zip: 10-digit id, name, rings, box. */
export function readMunicipalities(zipPath) {
  const shapes = parseShpPolygons(unzipMember(zipPath, '.shp'));
  const { rows } = parseDbf(unzipMember(zipPath, '.dbf'));
  if (shapes.length !== rows.length) throw new Error(`census: ${zipPath} has ${shapes.length} shapes for ${rows.length} rows`);
  return rows.flatMap((row, i) => (shapes[i] ? [{ ctycsub: row.GEOID, name: row.NAMELSAD, ...shapes[i] }] : []));
}

/**
 * Block id → the municipality whose 2020 boundary holds the block's internal point. Blocks nest in
 * counties, so only that county's municipalities are tried. `wanted` limits the work to some blocks.
 */
export function assignMunicipalities(blocks, municipalities, wanted = () => true) {
  const byCounty = new Map();
  for (const m of municipalities) {
    const county = m.ctycsub.slice(0, 5);
    if (!byCounty.has(county)) byCounty.set(county, []);
    byCounty.get(county).push(m);
  }
  const out = new Map();
  for (const b of blocks) {
    if (!wanted(b)) continue;
    const hit = (byCounty.get(b.geoid.slice(0, 5)) ?? []).find(
      (m) => b.lon >= m.bbox[0] && b.lon <= m.bbox[2] && b.lat >= m.bbox[1] && b.lat <= m.bbox[3] && inRings(m.rings, b.lon, b.lat),
    );
    out.set(b.geoid, hit ? hit.ctycsub : '');
  }
  return out;
}

/** Populated blocks the LODES crosswalk places in another municipality than the 2020 boundaries do. */
export function crosswalkDisagreements(blocks, assigned, crosswalk) {
  return blocks
    .filter((b) => b.pop20 > 0 && assigned.has(b.geoid) && crosswalk.has(b.geoid) && assigned.get(b.geoid) !== crosswalk.get(b.geoid))
    .map((b) => ({ geoid: b.geoid, pop20: b.pop20, boundary: assigned.get(b.geoid), crosswalk: crosswalk.get(b.geoid) }));
}

/** Block id → municipality (county subdivision, 10 digits) from the LODES crosswalk. */
export async function readCrosswalk(path) {
  const out = new Map();
  let header = null;
  for await (const line of lines(path)) {
    if (!line) continue;
    const fields = splitCsv(line);
    if (!header) {
      header = { block: fields.indexOf('tabblk2020'), csub: fields.indexOf('ctycsub'), name: fields.indexOf('ctycsubname') };
      if (header.block < 0 || header.csub < 0) throw new Error(`census: ${path} has no tabblk2020/ctycsub columns`);
      continue;
    }
    out.set(fields[header.block], fields[header.csub]);
  }
  return out;
}

/**
 * Gate G4: Σ POP20 over each municipality's blocks equals its census count exactly. `assigned` maps
 * block id → municipality; returns one row per municipality, plus the blocks it does not know
 * (always a failure).
 */
export function controlTotals(blocks, assigned, municipalities) {
  const sums = new Map(municipalities.map((m) => [m.ctycsub, 0]));
  const unknown = [];
  for (const b of blocks) {
    const csub = assigned.get(b.geoid);
    if (!csub) {
      unknown.push(b.geoid);
      continue;
    }
    if (sums.has(csub)) sums.set(csub, sums.get(csub) + b.pop20);
  }
  const rows = municipalities.map((m) => ({ ...m, sum: sums.get(m.ctycsub), ok: sums.get(m.ctycsub) === m.pop20 }));
  return { rows, unknown, ok: unknown.length === 0 && rows.every((r) => r.ok) };
}

/** The blocks whose internal point lies in the box, with their municipality, sorted by id. */
export function clipBlocks(blocks, assigned, box) {
  return blocks
    .filter((b) => inBox(box, b.lon, b.lat))
    .map((b) => ({ ...b, ctycsub: assigned.get(b.geoid) ?? '' }))
    .sort((a, b) => (a.geoid < b.geoid ? -1 : a.geoid > b.geoid ? 1 : 0));
}

export function blocksCsv(blocks) {
  const rows = blocks.map((b) => [b.geoid, b.lon, b.lat, b.pop20, b.housing20, b.aland20, b.awater20, b.ctycsub].join(','));
  return `${[BLOCK_HEADER, ...rows].join('\n')}\n`;
}

/**
 * LODES rows that stay inside the clip: RAC and WAC rows for its blocks, and OD rows whose home and
 * workplace both lie in it. Commuters from outside are the workplace's WAC total minus its inside
 * rows, so the fixture and the full bake count them the same way. Lines are kept verbatim, in file
 * order.
 */
export async function clipLodes(path, kind, inside) {
  const out = [];
  let cols = null;
  for await (const line of lines(path)) {
    if (!line) continue;
    if (!cols) {
      const header = line.split(',');
      cols =
        kind === 'od'
          ? [header.indexOf('w_geocode'), header.indexOf('h_geocode')]
          : [header.indexOf(kind === 'rac' ? 'h_geocode' : 'w_geocode')];
      if (cols.some((c) => c < 0)) throw new Error(`census: ${path} lacks the ${kind} geocode columns`);
      out.push(line);
      continue;
    }
    const fields = line.split(',');
    if (cols.every((c) => inside.has(fields[c]))) out.push(line);
  }
  return `${out.join('\n')}\n`;
}
