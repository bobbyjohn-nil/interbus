// The map file's half of D17 and G10 (PLAN §5): strips every transit feature from a city's tiles
// and opens bus-only streets as service streets, then checks no feature that reads as transit is
// left. The City tiles workflow runs it on go-pmtiles' extract before publishing.
//
//   node tools/bake/tiles.mjs strip <in.pmtiles> <out.pmtiles>
//   node tools/bake/tiles.mjs check <file.pmtiles>
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { featuresOf, rewriteTile } from './mvt.mjs';
import { packTile, readPmtiles, unpackTile, writePmtiles } from './pmtiles.mjs';
import { looksLikeTransit, OPENED_STREET, tileVerdict } from './transit.mjs';

const add = (into, from) => {
  for (const [k, v] of from) into.set(k, (into.get(k) ?? 0) + v);
};

/** Strips transit from an archive's bytes; returns the new bytes and counts of what was dropped and opened. */
export function stripTransit(buf) {
  const { header, metadata, tiles } = readPmtiles(buf);
  const dropped = new Map();
  const opened = new Map();
  const out = tiles.map((t) => {
    const result = rewriteTile(unpackTile(header, t.data), (layer, props) => {
      const verdict = tileVerdict(layer, props);
      return verdict === 'street' ? OPENED_STREET : verdict;
    });
    add(dropped, result.dropped);
    add(opened, result.changed);
    return { ...t, data: packTile(header, result.tile) };
  });
  const note = 'No existing transit (D17): rail, ferry, stops, stations, platforms and rail yards removed; bus-only streets drawn as service streets.';
  return { bytes: writePmtiles(header, { ...metadata, interbus: note }, out), dropped, opened };
}

/** G10 on an archive: every feature that still reads as transit, counted by layer and kind. */
export function transitLeft(buf) {
  const { header, tiles } = readPmtiles(buf);
  const left = new Map();
  for (const t of tiles) {
    for (const { layer, props } of featuresOf(unpackTile(header, t.data))) {
      if (!looksLikeTransit(layer, props)) continue;
      const key = `${layer}:${props.kind ?? ''}${props.kind_detail ? `/${props.kind_detail}` : ''}`;
      left.set(key, (left.get(key) ?? 0) + 1);
    }
  }
  return left;
}

const total = (m) => [...m.values()].reduce((s, v) => s + v, 0);
const list = (m) => [...m].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ');

function main([command, ...args]) {
  if (command === 'strip' && args.length === 2) {
    const input = readFileSync(args[0]);
    const { bytes, dropped, opened } = stripTransit(input);
    const left = transitLeft(bytes);
    if (left.size) throw new Error(`tiles: G10 ${total(left)} transit features left after the strip: ${list(left)}`);
    writeFileSync(args[1], bytes);
    console.log(`tiles: ${args[0]} (${input.length} B) → ${args[1]} (${bytes.length} B)`);
    console.log(`tiles: dropped ${total(dropped)} transit features: ${list(dropped)}`);
    console.log(`tiles: opened ${total(opened)} bus-only street features: ${list(opened)}`);
    console.log('tiles: G10 0 transit features left');
  } else if (command === 'check' && args.length === 1) {
    const left = transitLeft(readFileSync(args[0]));
    if (left.size) throw new Error(`tiles: G10 ${total(left)} transit features in ${args[0]}: ${list(left)}`);
    console.log(`tiles: G10 0 transit features in ${args[0]}`);
  } else {
    throw new Error('usage: node tools/bake/tiles.mjs strip <in.pmtiles> <out.pmtiles> | check <file.pmtiles>');
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    main(process.argv.slice(2));
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
