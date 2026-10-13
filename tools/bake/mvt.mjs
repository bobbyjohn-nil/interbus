// Rewrites Mapbox Vector Tiles (spec 2.1, https://github.com/mapbox/vector-tile-spec/tree/master/2.1,
// checked 2026-10-13) at the protobuf level: features are dropped or their tags changed, and every
// other byte (geometry, ids, layer settings) is copied as it was, so nothing kept moves by a unit.
// No dependencies: the few protobuf wire rules the format uses are below.

/** Reads a varint at `pos`; returns [value, next]. Values past 2^53 lose precision, so ids are only ever copied, never read. */
function varint(buf, pos) {
  let value = 0;
  let scale = 1;
  for (;;) {
    const byte = buf[pos++];
    if (byte === undefined) throw new RangeError('mvt: varint runs past the end');
    value += (byte & 0x7f) * scale;
    if (byte < 0x80) return [value, pos];
    scale *= 128;
  }
}

function writeVarint(out, value) {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`mvt: cannot write varint ${value}`);
  while (value >= 0x80) {
    out.push((value % 128) | 0x80);
    value = Math.floor(value / 128);
  }
  out.push(value);
}

/** The fields of one message: { field, wire, raw (tag and payload), body (length-delimited payload), value (varint) }. */
export function fields(buf) {
  const out = [];
  let pos = 0;
  while (pos < buf.length) {
    const start = pos;
    let key;
    [key, pos] = varint(buf, pos);
    const field = Math.floor(key / 8);
    const wire = key % 8;
    let body = null;
    let value = null;
    if (wire === 0) [value, pos] = varint(buf, pos);
    else if (wire === 1) pos += 8;
    else if (wire === 5) pos += 4;
    else if (wire === 2) {
      let length;
      [length, pos] = varint(buf, pos);
      body = buf.subarray(pos, pos + length);
      pos += length;
    } else throw new RangeError(`mvt: wire type ${wire} is not used by vector tiles`);
    if (pos > buf.length) throw new RangeError('mvt: a field runs past the end');
    out.push({ field, wire, raw: buf.subarray(start, pos), body, value });
  }
  return out;
}

function lengthDelimited(field, bytes) {
  const head = [];
  writeVarint(head, field * 8 + 2);
  writeVarint(head, bytes.length);
  return Buffer.concat([Buffer.from(head), bytes]);
}

function packedVarints(buf) {
  const values = [];
  for (let pos = 0; pos < buf.length; ) {
    let v;
    [v, pos] = varint(buf, pos);
    values.push(v);
  }
  return values;
}

/** A Value message as JS: string, number or boolean. */
export function decodeValue(buf) {
  const f = fields(buf)[0];
  if (!f) return null;
  const view = Buffer.from(f.raw.subarray(f.raw.length - (f.wire === 1 ? 8 : 4)));
  switch (f.field) {
    case 1:
      return Buffer.from(f.body).toString('utf8');
    case 2:
      return view.readFloatLE(0);
    case 3:
      return view.readDoubleLE(0);
    case 4:
    case 5:
      return f.value;
    case 6:
      return f.value % 2 === 0 ? f.value / 2 : -(f.value + 1) / 2;
    case 7:
      return f.value !== 0;
    default:
      return null;
  }
}

const stringValue = (s) => lengthDelimited(1, Buffer.from(s, 'utf8'));

/**
 * Rewrites one tile. `decide(layer, props)` returns 'drop', 'keep', or an object of string
 * properties to set on the feature. Layers left with no feature are removed. Returns the new tile
 * and what happened, as counts by `${layer}:${kind}`.
 */
export function rewriteTile(tile, decide) {
  const dropped = new Map();
  const changed = new Map();
  const count = (map, key) => map.set(key, (map.get(key) ?? 0) + 1);
  const layers = [];
  for (const layerField of fields(tile)) {
    if (layerField.field !== 3) {
      layers.push(layerField.raw);
      continue;
    }
    const parts = fields(layerField.body);
    const name = Buffer.from(parts.find((p) => p.field === 1).body).toString('utf8');
    const keys = parts.filter((p) => p.field === 3).map((p) => Buffer.from(p.body).toString('utf8'));
    const values = parts.filter((p) => p.field === 4).map((p) => decodeValue(p.body));
    const addedKeys = [];
    const addedValues = [];
    const valueIndex = (s) => {
      const at = values.findIndex((v) => v === s);
      if (at >= 0) return at;
      values.push(s);
      addedValues.push(lengthDelimited(4, stringValue(s)));
      return values.length - 1;
    };
    const keyIndex = (k) => {
      const at = keys.indexOf(k);
      if (at >= 0) return at;
      keys.push(k);
      addedKeys.push(lengthDelimited(3, Buffer.from(k, 'utf8')));
      return keys.length - 1;
    };
    const out = [];
    let kept = 0;
    for (const part of parts) {
      if (part.field !== 2) {
        out.push(part.raw);
        continue;
      }
      const feature = fields(part.body);
      const tagsField = feature.find((f) => f.field === 2);
      const tags = tagsField ? packedVarints(tagsField.body) : [];
      const props = {};
      for (let t = 0; t + 1 < tags.length; t += 2) props[keys[tags[t]]] = values[tags[t + 1]];
      const verdict = decide(name, props);
      const label = `${name}:${props.kind ?? ''}${props.kind_detail ? `/${props.kind_detail}` : ''}`;
      if (verdict === 'drop') {
        count(dropped, label);
        continue;
      }
      kept++;
      if (verdict === 'keep') {
        out.push(part.raw);
        continue;
      }
      count(changed, label);
      const next = [...tags];
      for (const [k, v] of Object.entries(verdict)) {
        const ki = keyIndex(k);
        const vi = valueIndex(v);
        const at = next.findIndex((x, i) => i % 2 === 0 && x === ki);
        if (at >= 0) next[at + 1] = vi;
        else next.push(ki, vi);
      }
      const packed = [];
      for (const v of next) writeVarint(packed, v);
      const rebuilt = feature.map((f) => (f.field === 2 ? lengthDelimited(2, Buffer.from(packed)) : f.raw));
      if (!tagsField) rebuilt.push(lengthDelimited(2, Buffer.from(packed)));
      out.push(lengthDelimited(2, Buffer.concat(rebuilt)));
    }
    if (kept === 0) continue;
    layers.push(lengthDelimited(3, Buffer.concat([...out, ...addedKeys, ...addedValues])));
  }
  return { tile: Buffer.concat(layers), dropped, changed };
}

/** Every feature of a tile as { layer, props }, for checks. */
export function featuresOf(tile) {
  const out = [];
  for (const layerField of fields(tile)) {
    if (layerField.field !== 3) continue;
    const parts = fields(layerField.body);
    const layer = Buffer.from(parts.find((p) => p.field === 1).body).toString('utf8');
    const keys = parts.filter((p) => p.field === 3).map((p) => Buffer.from(p.body).toString('utf8'));
    const values = parts.filter((p) => p.field === 4).map((p) => decodeValue(p.body));
    for (const part of parts) {
      if (part.field !== 2) continue;
      const tagsField = fields(part.body).find((f) => f.field === 2);
      const tags = tagsField ? packedVarints(tagsField.body) : [];
      const props = {};
      for (let t = 0; t + 1 < tags.length; t += 2) props[keys[tags[t]]] = values[tags[t + 1]];
      out.push({ layer, props });
    }
  }
  return out;
}
