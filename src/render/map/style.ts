// Builds the MapLibre style for a city from a token set: "quiet base, loud data" (PLAN §8).
// Layers come from @protomaps/basemaps; this module re-colours them, swaps in Afacad Flux and
// removes what interbus never draws.
import { layers, namedFlavor, type Flavor } from '@protomaps/basemaps';
import type { LayerSpecification, StyleSpecification } from 'maplibre-gl';
import type { MapTokens } from './tokens';

export const FONT_REGULAR = 'Afacad Flux Regular';
export const FONT_SEMIBOLD = 'Afacad Flux SemiBold';
export const FONT_STACKS: readonly string[] = [FONT_REGULAR, FONT_SEMIBOLD];

/** The tile source id inside the style. */
export const SOURCE = 'city';

/**
 * Layers interbus never draws:
 * - roads_rail: the city starts with no transit of any kind (D17); the week-3 bake also strips it from the tiles.
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

/** Replaces any Noto font name, however deeply nested in an expression, with an Afacad stack. */
function afacad(value: unknown): unknown {
  if (typeof value === 'string') {
    if (!value.startsWith('Noto Sans')) return value;
    return /Medium|Bold/.test(value) ? FONT_SEMIBOLD : FONT_REGULAR;
  }
  if (Array.isArray(value)) return value.map(afacad);
  return value;
}

function adjust(layer: LayerSpecification, t: MapTokens): LayerSpecification {
  const out = structuredClone(layer) as unknown as {
    id: string;
    layout?: Record<string, unknown>;
    paint?: Record<string, unknown>;
  };
  if (out.layout) {
    if ('text-font' in out.layout) out.layout['text-font'] = afacad(out.layout['text-font']);
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

export interface StyleOptions {
  /** pmtiles:// URL of the city's tile file. */
  readonly tilesUrl: string;
  /** Absolute URL prefix of this build's files, ending in "/". */
  readonly assetBase: string;
  readonly tokens: MapTokens;
}

export function buildStyle({ tilesUrl, assetBase, tokens }: StyleOptions): StyleSpecification {
  const all = layers(SOURCE, flavorFrom(tokens), { lang: 'en' });
  return {
    version: 8,
    glyphs: `${assetBase}fonts/{fontstack}/{range}.pbf`,
    sources: {
      [SOURCE]: {
        type: 'vector',
        url: tilesUrl,
        attribution: '© OpenStreetMap contributors · Protomaps',
      },
    },
    layers: all.filter((l) => !DROPPED_LAYERS.includes(l.id)).map((l) => adjust(l, tokens)),
  };
}
