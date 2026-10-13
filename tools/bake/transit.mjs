// No existing transit (D17, PLAN §5): the city starts with no bus, rail or ferry of any kind. This
// is what counts as transit, in OpenStreetMap's tags (the sim's input) and in the Protomaps basemap's
// layers (the map file), and what G10 checks survives in neither file. Bus lanes, busways and
// bus-only streets are not removed but opened: in the sim they are general streets, and on the map
// they draw as service streets.

/** An OSM element that is public transport and must not reach sim.json (osm.py keeps them in the clip so this is tested on real tags). */
export function isTransitTags(tags) {
  return (
    'railway' in tags ||
    'public_transport' in tags ||
    tags.highway === 'bus_stop' ||
    tags.highway === 'platform' ||
    tags.amenity === 'bus_station' ||
    tags.amenity === 'ferry_terminal' ||
    tags.route === 'ferry'
  );
}

// The Protomaps basemap's kinds, as found in build 20261012 over Inner Boston (DECISIONS, Measured).
/** Road kinds that are transit lines. */
export const TRANSIT_ROAD_KINDS = new Set(['rail', 'ferry']);
/** Road details that are transit: platforms drawn as lines. */
export const TRANSIT_ROAD_DETAILS = new Set(['platform']);
/** Road details that are bus-only streets: D17 opens them, so they draw as service streets. */
export const BUSWAY_ROAD_DETAILS = new Set(['busway', 'Bus_Lane', 'bus_guideway']);
/** Land that is transit: platforms and rail yards. */
export const TRANSIT_LANDUSE_KINDS = new Set(['platform', 'railway']);
/** Points that are transit: stops, stations, entrances, rail furniture and yards. A composite kind ("airport;ferry_terminal") counts if any part does. */
export const TRANSIT_POI_KINDS = new Set([
  'bus_station', 'bus_stop', 'ferry_terminal', 'halt', 'platform', 'railway', 'station', 'stop', 'stop_position',
  'stop_area', 'subway_entrance', 'train_station_entrance', 'buffer_stop', 'derail', 'railway_crossing',
  'railway_car', 'train', 'tram_stop', 'subway', 'light_rail', 'tram', 'monorail', 'funicular', 'bus',
  'trolleybus', 'aerialway',
]);

/**
 * What the map file does with a feature of `layer` with properties `props`: 'drop' it (transit),
 * make it a 'street' (a bus-only street opened to all), or 'keep' it.
 */
export function tileVerdict(layer, props) {
  const kind = String(props.kind ?? '');
  const detail = String(props.kind_detail ?? '');
  if (layer === 'roads') {
    if (TRANSIT_ROAD_KINDS.has(kind) || TRANSIT_ROAD_DETAILS.has(detail)) return 'drop';
    if (BUSWAY_ROAD_DETAILS.has(detail)) return 'street';
  }
  if (layer === 'landuse' && TRANSIT_LANDUSE_KINDS.has(kind)) return 'drop';
  if (layer === 'pois' && kind.split(';').some((k) => TRANSIT_POI_KINDS.has(k))) return 'drop';
  return 'keep';
}

/** A bus-only street as the map draws it once D17 opens it. */
export const OPENED_STREET = { kind: 'minor_road', kind_detail: 'service' };

// G10 does not trust the strip's own lists: it flags any kind or detail that reads like transit,
// so a kind a later Protomaps build adds (a "tram_stop" spelt differently) fails the bake instead of
// slipping through. These words name things that are not public transport.
const TRANSIT_WORDS = /rail|bus|ferry|station|subway|tram|metro|platform|halt|stop|train|transit|aerialway|funicular/i;
const NOT_TRANSIT = new Set([
  'bicycle_repair_station', 'charging_station', 'device_charging_station', 'fire_station', 'fitness_station',
  'polling_station', 'service_station', 'waste_transfer_station', 'police_station', 'ranger_station',
  'stationery', 'training', 'athletic_training', 'trailhead', 'trampoline',
]);

/** G10 on one tile feature: true if it still reads as transit. */
export function looksLikeTransit(layer, props) {
  if (tileVerdict(layer, props) === 'drop') return true;
  return [props.kind, props.kind_detail]
    .filter((v) => v !== undefined)
    .flatMap((v) => String(v).split(';'))
    .some((part) => TRANSIT_WORDS.test(part) && !NOT_TRANSIT.has(part));
}
