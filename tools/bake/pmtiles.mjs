// Reads and writes PMTiles version 3 archives (https://github.com/protomaps/PMTiles/blob/main/spec/v3/spec.md,
// checked 2026-10-13), so the tiles job can rewrite the extract go-pmtiles cut. Internal compression
// and tiles are gzip, as in the extract. The writer keeps every directory in the root, which the
// spec allows while header and root fit in the first 16,384 bytes; Inner Boston's 453 tiles use
// about 1.5 KB.
import { createHash } from 'node:crypto';
import { gunzipSync, gzipSync } from 'node:zlib';

const HEADER_BYTES = 127;
const ROOT_LIMIT = 16_384;
const GZIP = 2;
const NONE = 1;

function readVarint(buf, pos) {
  let value = 0;
  let scale = 1;
  for (;;) {
    const byte = buf[pos++];
    if (byte === undefined) throw new RangeError('pmtiles: varint runs past the end');
    value += (byte & 0x7f) * scale;
    if (byte < 0x80) return [value, pos];
    scale *= 128;
  }
}

function writeVarint(out, value) {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`pmtiles: cannot write varint ${value}`);
  while (value >= 0x80) {
    out.push((value % 128) | 0x80);
    value = Math.floor(value / 128);
  }
  out.push(value);
}

const decompress = (buf, kind) => {
  if (kind === GZIP) return gunzipSync(buf);
  if (kind === NONE) return buf;
  throw new RangeError(`pmtiles: compression ${kind} is not read here`);
};

function parseHeader(buf) {
  if (buf.subarray(0, 7).toString('latin1') !== 'PMTiles' || buf[7] !== 3) throw new RangeError('pmtiles: not a version 3 archive');
  const u64 = (at) => Number(buf.readBigUInt64LE(at));
  return {
    rootOffset: u64(8),
    rootLength: u64(16),
    metadataOffset: u64(24),
    metadataLength: u64(32),
    leafOffset: u64(40),
    leafLength: u64(48),
    dataOffset: u64(56),
    dataLength: u64(64),
    addressedTiles: u64(72),
    tileEntries: u64(80),
    tileContents: u64(88),
    clustered: buf[96],
    internalCompression: buf[97],
    tileCompression: buf[98],
    tileType: buf[99],
    minZoom: buf[100],
    maxZoom: buf[101],
    minLonE7: buf.readInt32LE(102),
    minLatE7: buf.readInt32LE(106),
    maxLonE7: buf.readInt32LE(110),
    maxLatE7: buf.readInt32LE(114),
    centerZoom: buf[118],
    centerLonE7: buf.readInt32LE(119),
    centerLatE7: buf.readInt32LE(123),
  };
}

function parseDirectory(buf) {
  let pos = 0;
  let n;
  [n, pos] = readVarint(buf, pos);
  const entries = Array.from({ length: n }, () => ({ tileId: 0, runLength: 0, length: 0, offset: 0 }));
  let id = 0;
  for (const e of entries) {
    let delta;
    [delta, pos] = readVarint(buf, pos);
    id += delta;
    e.tileId = id;
  }
  for (const e of entries) [e.runLength, pos] = readVarint(buf, pos);
  for (const e of entries) [e.length, pos] = readVarint(buf, pos);
  entries.forEach((e, i) => {
    let v;
    [v, pos] = readVarint(buf, pos);
    e.offset = v === 0 && i > 0 ? entries[i - 1].offset + entries[i - 1].length : v - 1;
  });
  return entries;
}

function serializeDirectory(entries) {
  const out = [];
  writeVarint(out, entries.length);
  let last = 0;
  for (const e of entries) {
    writeVarint(out, e.tileId - last);
    last = e.tileId;
  }
  for (const e of entries) writeVarint(out, e.runLength);
  for (const e of entries) writeVarint(out, e.length);
  entries.forEach((e, i) => writeVarint(out, i > 0 && e.offset === entries[i - 1].offset + entries[i - 1].length ? 0 : e.offset + 1));
  return Buffer.from(out);
}

/** An archive as { header, metadata (parsed JSON), tiles: [{ tileId, runLength, data (as stored) }] } in tile id order. */
export function readPmtiles(buf) {
  const header = parseHeader(buf);
  const tiles = [];
  const walk = (offset, length) => {
    for (const e of parseDirectory(decompress(buf.subarray(offset, offset + length), header.internalCompression))) {
      if (e.runLength === 0) walk(header.leafOffset + e.offset, e.length);
      else tiles.push({ tileId: e.tileId, runLength: e.runLength, data: buf.subarray(header.dataOffset + e.offset, header.dataOffset + e.offset + e.length) });
    }
  };
  walk(header.rootOffset, header.rootLength);
  tiles.sort((a, b) => a.tileId - b.tileId);
  const metadata = JSON.parse(decompress(buf.subarray(header.metadataOffset, header.metadataOffset + header.metadataLength), header.internalCompression).toString('utf8'));
  return { header, metadata, tiles };
}

/** A tile's bytes uncompressed, and the reverse, for the archive's tile compression. */
export const unpackTile = (header, data) => decompress(data, header.tileCompression);
export const packTile = (header, data) => {
  if (header.tileCompression === GZIP) return gzipSync(data, { level: 9 });
  if (header.tileCompression === NONE) return data;
  throw new RangeError(`pmtiles: compression ${header.tileCompression} is not written here`);
};

/** Writes an archive with `header`'s zooms, bounds and types; identical tiles are stored once. */
export function writePmtiles(header, metadata, tiles) {
  const sorted = [...tiles].sort((a, b) => a.tileId - b.tileId);
  const stored = new Map();
  const chunks = [];
  let dataLength = 0;
  const entries = sorted.map((t) => {
    const hash = createHash('sha256').update(t.data).digest('hex');
    let at = stored.get(hash);
    if (at === undefined) {
      at = dataLength;
      stored.set(hash, at);
      chunks.push(t.data);
      dataLength += t.data.length;
    }
    return { tileId: t.tileId, runLength: t.runLength, offset: at, length: t.data.length };
  });
  const root = gzipSync(serializeDirectory(entries), { level: 9 });
  if (HEADER_BYTES + root.length > ROOT_LIMIT) throw new RangeError(`pmtiles: a ${root.length} B root directory needs leaf directories, which this writer does not make`);
  const meta = gzipSync(Buffer.from(JSON.stringify(metadata), 'utf8'), { level: 9 });
  const out = Buffer.alloc(HEADER_BYTES);
  out.write('PMTiles', 0, 'latin1');
  out[7] = 3;
  const u64 = (at, v) => out.writeBigUInt64LE(BigInt(v), at);
  const rootOffset = HEADER_BYTES;
  const metadataOffset = rootOffset + root.length;
  const dataOffset = metadataOffset + meta.length;
  u64(8, rootOffset);
  u64(16, root.length);
  u64(24, metadataOffset);
  u64(32, meta.length);
  u64(40, dataOffset);
  u64(48, 0);
  u64(56, dataOffset);
  u64(64, dataLength);
  u64(72, entries.reduce((s, e) => s + e.runLength, 0));
  u64(80, entries.length);
  u64(88, stored.size);
  out[96] = 1;
  out[97] = GZIP;
  out[98] = header.tileCompression;
  out[99] = header.tileType;
  out[100] = header.minZoom;
  out[101] = header.maxZoom;
  out.writeInt32LE(header.minLonE7, 102);
  out.writeInt32LE(header.minLatE7, 106);
  out.writeInt32LE(header.maxLonE7, 110);
  out.writeInt32LE(header.maxLatE7, 114);
  out[118] = header.centerZoom;
  out.writeInt32LE(header.centerLonE7, 119);
  out.writeInt32LE(header.centerLatE7, 123);
  return Buffer.concat([out, root, meta, ...chunks]);
}
