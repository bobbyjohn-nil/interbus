// Shared pieces of the bake (PLAN §5). Node only; nothing here runs in a player's browser.
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { createGunzip } from 'node:zlib';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** Where a city's mirrored source files are kept on this machine (gitignored). */
export const sourcesDir = (cityId) => join(ROOT, '.cache/bake', cityId, 'sources');

export const lockPath = (cityId) => join(ROOT, 'cities', cityId, 'sources.lock.json');

/** The registry entry (extent, tiles) and the bake settings for one city, plus its lock if it has one. */
export function readCity(cityId) {
  const { cities } = JSON.parse(readFileSync(join(ROOT, 'cities/index.json'), 'utf8'));
  const entry = cities.find((c) => c.id === cityId);
  if (!entry) throw new Error(`bake: ${cityId} is not in cities/index.json`);
  const config = JSON.parse(readFileSync(join(ROOT, 'cities', cityId, 'city.json'), 'utf8'));
  const lock = existsSync(lockPath(cityId)) ? JSON.parse(readFileSync(lockPath(cityId), 'utf8')) : null;
  return { entry, config, lock };
}

export async function sha256File(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

export const sha256 = (data) => createHash('sha256').update(data).digest('hex');

/** [west, south, east, north] contains [lon, lat]; edges count as inside. */
export function inBox(box, lon, lat) {
  const [w, s, e, n] = box;
  return lon >= w && lon <= e && lat >= s && lat <= n;
}

export function boxInside(inner, outer) {
  return inner[0] >= outer[0] && inner[1] >= outer[1] && inner[2] <= outer[2] && inner[3] <= outer[3];
}

/** Lines of a text file, gunzipped first if its name ends in .gz. */
export async function* lines(path) {
  const raw = createReadStream(path);
  const input = path.endsWith('.gz') ? raw.pipe(createGunzip()) : raw;
  const reader = createInterface({ input, crlfDelay: Infinity });
  for await (const line of reader) yield line;
}

/**
 * One CSV line into fields: commas separate, double quotes enclose, "" is a quote. LODES files
 * quote the crosswalk's place names, some of which hold commas.
 */
export function splitCsv(line) {
  const out = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ',') {
      out.push(field);
      field = '';
    } else {
      field += c;
    }
  }
  if (quoted) throw new Error(`csv: unterminated quote in ${line.slice(0, 80)}`);
  out.push(field);
  return out;
}

/**
 * Reads a dBASE III table (the .dbf inside a TIGER/Line zip): the field list and every record as
 * an object of trimmed strings. Deleted records are skipped.
 */
export function parseDbf(buf) {
  const records = buf.readUInt32LE(4);
  const headerLength = buf.readUInt16LE(8);
  const recordLength = buf.readUInt16LE(10);
  const fields = [];
  for (let at = 32; buf[at] !== 0x0d; at += 32) {
    if (at + 32 > headerLength) throw new Error('dbf: field list runs past the header');
    const name = buf.toString('latin1', at, at + 11).replace(/\0.*$/s, '');
    fields.push({ name, type: String.fromCharCode(buf[at + 11]), length: buf[at + 16] });
  }
  const rows = [];
  for (let r = 0; r < records; r++) {
    const start = headerLength + r * recordLength;
    if (start + recordLength > buf.length) throw new Error(`dbf: record ${r} runs past the end of the file`);
    if (buf[start] === 0x2a) continue; // '*': deleted
    const row = {};
    let at = start + 1;
    for (const f of fields) {
      row[f.name] = buf.toString('latin1', at, at + f.length).trim();
      at += f.length;
    }
    rows.push(row);
  }
  return { fields, rows };
}
