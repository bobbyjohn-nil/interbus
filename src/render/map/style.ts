// Builds the MapLibre style for a city from a token set: "quiet base, loud data" (PLAN §8).
// Layers come from @protomaps/basemaps; this module re-colours them, swaps in Afacad Flux, removes
// what interbus never draws, and adds the 3D buildings and the board mask.
import { layers, namedFlavor, type Flavor } from '@protomaps/basemaps';
import type { LayerSpecification, StyleSpecification } from 'maplibre-gl';
import type { Bbox } from '../../cities';
import { BUILDINGS_2D, BUILDINGS_3D } from './tilt';
import type { MapTokens } from './tokens';

export { BUILDINGS_2D, BUILDINGS_3D };

export const FONT_REGULAR = 'Afacad Flux Regular';
export const FONT_SEMIBOLD = 'Afacad Flux SemiBold';
export const FONT_STACKS: readonly string[] = [FONT_REGULAR, FONT_SEMIBOLD];

/** The tile source id inside the style. */
export const SOURCE = 'city';
/** The board mask's source: inline GeoJSON built from the play area, so it fetches nothing. */
export const BOARD = 'board';

/**
 * A building with no height in the tiles stands about three storeys tall in 3D. The bake replaces
 * this with OSM height, else levels × 3.2 m + 1 m, else a type default (PLAN §5), and week 2 counts
 * how many of Inner Boston's buildings carry a height at all (DECISIONS.md).
 */
export const DEFAULT_HEIGHT_M = 10;

/** V1's board mask: the grey beyond the play area and its dashed edge, drawn over everything. */
export const MASK_LAYERS: readonly string[] = ['board-mask', 'board-edge'];
/** How far the mask's panels reach past the play area, in degrees: far beyond any camera the bounds allow. */
const MASK_REACH = 4;

/**
 * Layers interbus never draws:
 * - roads_rail: the city starts with no transit of any kind (D17), and the map file holds none either
 *   (tools/bake/tiles.mjs strips it and G10 checks); the layer stays dropped should a later cut carry rail.
 * - pois, roads_shields, roads_oneway: icon layers; the style ships no sprite yet, and transit stations live in pois.
 */
export const DROPPED_LAYERS: readonly string[] = ['roads_rail', 'pois', 'roads_shields', 'roads_oneway'];

function flavorFrom(t: MapTokens): Flavor {
  const base = namedFlavor('light');
  return {
    ...base,
    regular: FONT_REGULAR,
    bold: FONT_SEMIBOLD,
    italic: FONT_REGULAR,
    background: t.void,
    earth: t.land,
    park_a: t.park,
    park_b: t.park,
    wood_a: t.wood,
    wood_b: t.wood,
    scrub_a: t.wood,
    scrub_b: t.wood,
    zoo: t.park,
    hospital: t.hospital,
    school: t.school,
    industrial: t.industrial,
    military: t.industrial,
    pedestrian: t.path,
    glacier: t.land,
    sand: t.land,
    beach: t.land,
    aerodrome: t.aerodrome,
    runway: t.path,
    water: t.water,
    pier: t.path,
    buildings: t.buildingFill,
    other: t.path,
    minor_service: t.street,
    minor_a: t.street,
    minor_b: t.street,
    link: t.arterial,
    major: t.arterial,
    highway: t.arterial,
    minor_service_casing: t.streetCasing,
    minor_casing: t.streetCasing,
    link_casing: t.arterialCasing,
    major_casing_early: t.arterialCasing,
    major_casing_late: t.arterialCasing,
    highway_casing_early: t.arterialCasing,
    highway_casing_late: t.arterialCasing,
    tunnel_other: t.path,
    tunnel_minor: t.path,
    tunnel_link: t.path,
    tunnel_major: t.path,
    tunnel_highway: t.path,
    tunnel_other_casing: t.streetCasing,
    tunnel_minor_casing: t.streetCasing,
    tunnel_link_casing: t.streetCasing,
    tunnel_major_casing: t.streetCasing,
    tunnel_highway_casing: t.streetCasing,
    bridges_other: t.path,
    bridges_minor: t.street,
    bridges_link: t.arterial,
    bridges_major: t.arterial,
    bridges_highway: t.arterial,
    bridges_other_casing: t.streetCasing,
    bridges_minor_casing: t.streetCasing,
    bridges_link_casing: t.arterialCasing,
    bridges_major_casing: t.arterialCasing,
    bridges_highway_casing: t.arterialCasing,
    railway: t.land,
    boundaries: t.boundary,
    roads_label_minor: t.labelMinor,
    roads_label_minor_halo: t.labelHalo,
    roads_label_major: t.label,
    roads_label_major_halo: t.labelHalo,
    ocean_label: t.waterLabel,
    subplace_label: t.labelMinor,
    subplace_label_halo: t.labelHalo,
    city_label: t.label,
    city_label_halo: t.labelHalo,
    state_label: t.labelMinor,
    state_label_halo: t.labelHalo,
    country_label: t.labelMinor,
    address_label: t.labelMinor,
    address_label_halo: t.labelHalo,
  };
}

/**
 * Replaces any Noto font name with an Afacad stack, however deeply nested: text-font, and the
 * per-script text-font overrides inside text-field's format expressions.
 */
function afacad(value: unknown): unknown {
  if (typeof value === 'string') {
    if (!value.startsWith('Noto Sans')) return value;
    return /Medium|Bold/.test(value) ? FONT_SEMIBOLD : FONT_REGULAR;
  }
  if (Array.isArray(value)) return value.map(afacad);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, afacad(v)]));
  }
  return value;
}

function adjust(layer: LayerSpecification, t: MapTokens): LayerSpecification {
  const out = structuredClone(layer) as unknown as {
    id: string;
    layout?: Record<string, unknown>;
    paint?: Record<string, unknown>;
  };
  if (out.layout) {
    out.layout = afacad(out.layout) as Record<string, unknown>;
    // Town dots and every other icon need a sprite this style does not ship.
    delete out.layout['icon-image'];
  }
  if (out.id === 'buildings' && out.paint) {
    // In 2D a building is a fill a notch darker than land with a hairline outline (PLAN §6).
    out.paint['fill-opacity'] = 1;
    out.paint['fill-outline-color'] = t.buildingOutline;
  }
  return out as unknown as LayerSpecification;
}

/**
 * The 3D buildings: the flat layer's buildings, extruded to their height. Hidden, and faded out, until
 * the board tilts (tilt.ts); the two layers cross-fade once per mode change, never per frame (RN-04).
 */
function extrusions(flat: LayerSpecification, t: MapTokens): LayerSpecification {
  return {
    id: BUILDINGS_3D,
    type: 'fill-extrusion',
    source: SOURCE,
    'source-layer': 'buildings',
    minzoom: 13,
    ...('filter' in flat && flat.filter ? { filter: flat.filter } : {}),
    layout: { visibility: 'none' },
    paint: {
      'fill-extrusion-color': t.buildingFill,
      'fill-extrusion-height': ['coalesce', ['get', 'height'], DEFAULT_HEIGHT_M],
      'fill-extrusion-base': ['coalesce', ['get', 'min_height'], 0],
      'fill-extrusion-opacity': 0,
    },
  };
}

type Ring = [number, number][];
const panel = (w: number, s: number, e: number, n: number) => ({
  type: 'Feature' as const,
  properties: { kind: 'mask' },
  geometry: { type: 'Polygon' as const, coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]] as Ring] },
});

/**
 * Four panels around the play area and its edge (V1, `Intralines@7af45b1:src/map/overlays.ts:55-114`):
 * a world polygon with the play area as a hole tessellates unreliably, V1 found.
 */
export function boardFeatures(extent: Bbox) {
  const [w, s, e, n] = extent;
  const m = MASK_REACH;
  return {
    type: 'FeatureCollection' as const,
    features: [
      panel(w - m, n, e + m, n + m), // north
      panel(w - m, s - m, e + m, s), // south
      panel(w - m, s, w, n), // west
      panel(e, s, e + m, n), // east
      {
        type: 'Feature' as const,
        properties: { kind: 'edge' },
        geometry: { type: 'LineString' as const, coordinates: [[w, s], [e, s], [e, n], [w, n], [w, s]] as Ring },
      },
    ],
  };
}

function boardMask(t: MapTokens): LayerSpecification[] {
  return [
    {
      id: 'board-mask',
      type: 'fill',
      source: BOARD,
      filter: ['==', ['get', 'kind'], 'mask'],
      // Unsmoothed, so the panels' shared edges leave no darker seam.
      paint: { 'fill-color': t.mask, 'fill-opacity': 0.62, 'fill-antialias': false },
    },
    {
      id: 'board-edge',
      type: 'line',
      source: BOARD,
      filter: ['==', ['get', 'kind'], 'edge'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': t.maskEdge,
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.6, 16, 4],
        'line-dasharray': [2.5, 2],
        'line-opacity': 0.75,
      },
    },
  ];
}

/**
 * A filter as an expression: the legacy forms protomaps' layers write (a property named by its key), or an expression as it is.
 * Anything else throws, so a new protomaps form fails the style tests rather than drawing wrong.
 */
export function asExpression(filter: unknown): unknown {
  if (!Array.isArray(filter)) throw new Error(`not a filter: ${JSON.stringify(filter)}`);
  const [op, key, ...values] = filter as [unknown, unknown, ...unknown[]];
  if (op === 'all' || op === 'any') return [op, ...filter.slice(1).map(asExpression)];
  if (typeof key !== 'string') return filter;
  const get = key === '$type' ? ['geometry-type'] : key === '$id' ? ['id'] : ['get', key];
  switch (op) {
    case 'in':
      return ['in', get, ['literal', values]];
    case '!in':
      return ['!', ['in', get, ['literal', values]]];
    case '==':
    case '!=':
      return [op, get, values[0]];
    case 'has':
      return ['has', key];
    case '!has':
      return ['!', ['has', key]];
    default:
      throw new Error(`a filter this style cannot read: ${JSON.stringify(filter)}`);
  }
}

/**
 * A fill whose colour depends on each feature (a case on its kind, as the parks' is), as one layer for each colour it picks, each
 * with that colour constant and the features its case picks it for. A colour that depends on each feature changes only by laying
 * out again every tile of its source on screen, the 3D buildings' too, and takes no transition: each step of the light
 * (daylight.ts) cost a 612 ms task in 3D on software GL and drew the parks a step ahead of the land round them (the review of the
 * day and night tint).
 */
export function byColour(layer: LayerSpecification): LayerSpecification[] {
  const paint = (layer as { paint?: Record<string, unknown> }).paint;
  const colour = paint?.['fill-color'];
  if (layer.type !== 'fill' || !Array.isArray(colour) || colour[0] !== 'case') return [layer];
  const picks = colour.filter((_, k) => k > 0 && (k % 2 === 0 || k === colour.length - 1));
  if (!picks.every((c): c is string => typeof c === 'string')) return [layer];
  const filter = 'filter' in layer && layer.filter ? [asExpression(layer.filter)] : [];
  return [...new Set(picks)].map(
    (c, k) => ({ ...layer, id: k === 0 ? layer.id : `${layer.id}-${k + 1}`, filter: ['all', ...filter, ['==', colour, c]], paint: { ...paint, 'fill-color': c } }) as unknown as LayerSpecification,
  );
}

export interface StyleOptions {
  /** pmtiles:// URL of the city's tile file. */
  readonly tilesUrl: string;
  /** Absolute URL prefix of this build's files, ending in "/". */
  readonly assetBase: string;
  readonly tokens: MapTokens;
  /** The play area; the board mask greys everything beyond it. */
  readonly extent: Bbox;
}

export function buildStyle({ tilesUrl, assetBase, tokens, extent }: StyleOptions): StyleSpecification {
  const base = layers(SOURCE, flavorFrom(tokens), { lang: 'en' })
    .filter((l) => !DROPPED_LAYERS.includes(l.id))
    .map((l) => adjust(l, tokens))
    .flatMap(byColour);
  // Extrusions go above every ground layer, so no street draws over a building, and below the labels.
  const firstLabel = base.findIndex((l) => l.type === 'symbol');
  const flat = base.find((l) => l.id === BUILDINGS_2D);
  if (firstLabel < 0 || !flat) throw new Error('the basemap has no labels or no buildings layer');
  return {
    version: 8,
    glyphs: `${assetBase}fonts/{fontstack}/{range}.pbf`,
    sources: {
      [SOURCE]: {
        type: 'vector',
        url: tilesUrl,
        attribution: '© OpenStreetMap contributors · Protomaps · Overture Maps',
      },
      [BOARD]: { type: 'geojson', data: boardFeatures(extent) },
    },
    // The mask goes over everything, labels included, as in V1; the game's own layers will draw above it.
    layers: [...base.slice(0, firstLabel), extrusions(flat, tokens), ...base.slice(firstLabel), ...boardMask(tokens)],
  };
}
