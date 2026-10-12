// The bake's census step (PLAN §5): 2020 blocks from the TIGER/Line .dbf, each block's municipality
// from the LODES crosswalk, gate G4's control totals, and the clip of blocks and LODES rows to a box.
// Blocks join on their full 15-digit ids; V1 sliced them to 12 and merged whole block groups (K-list,
// "LODES parsed at 12 digits"), which G4 exists to catch.
import { execFileSync } from 'node:child_process';
import { lines, inBox, splitCsv, parseDbf } from './lib.mjs';

export const BLOCK_HEADER = 'geoid,lon,lat,pop20,housing20,aland20,awater20,ctycsub';

/** Every 2020 block in a TIGER/Line tabblock20 zip: id, internal point, counts and areas. */
export function readBlocks(zipPath) {
  const member = execFileSync('unzip', ['-Z1', zipPath], { encoding: 'utf8' })
    .split('\n')
    .find((name) => name.endsWith('.dbf'));
  if (!member) throw new Error(`census: no .dbf in ${zipPath}`);
  const dbf = execFileSync('unzip', ['-p', zipPath, member], { maxBuffer: 512 * 1024 * 1024 });
  return blocksFromDbf(dbf);
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
 * Gate G4: Σ POP20 over each municipality's blocks equals its census count exactly. Returns one
 * row per municipality, plus the blocks the crosswalk does not know (always a failure).
 */
export function controlTotals(blocks, crosswalk, municipalities) {
  const sums = new Map(municipalities.map((m) => [m.ctycsub, 0]));
  const unknown = [];
  for (const b of blocks) {
    const csub = crosswalk.get(b.geoid);
    if (csub === undefined) {
      unknown.push(b.geoid);
      continue;
    }
    if (sums.has(csub)) sums.set(csub, sums.get(csub) + b.pop20);
  }
  const rows = municipalities.map((m) => ({ ...m, sum: sums.get(m.ctycsub), ok: sums.get(m.ctycsub) === m.pop20 }));
  return { rows, unknown, ok: unknown.length === 0 && rows.every((r) => r.ok) };
}

/** The blocks whose internal point lies in the box, with their municipality, sorted by id. */
export function clipBlocks(blocks, crosswalk, box) {
  return blocks
    .filter((b) => inBox(box, b.lon, b.lat))
    .map((b) => ({ ...b, ctycsub: crosswalk.get(b.geoid) ?? '' }))
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
