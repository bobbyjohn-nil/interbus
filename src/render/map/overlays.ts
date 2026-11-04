// The game's layers on the map: depot land and depots, demand dots (where people live and work, each
// kind shown or hidden by the player), the lines with their stops, stops placed on their own, and the stops' QUIET and LOSS flags,
// the line being drawn, and a city event's street, hatched while pending and solid while on. Contracts
// draw no rings: the Contracts panel lists every offer (D25). GeoJSON sources set only when their data
// changes, never per frame (RN-04); they draw above the board mask. The numbers come from the sim
// worker; the renderer computes none (AR-04), only the shapes that show them.
import type { ExpressionSpecification, FilterSpecification, GeoJSONSource, LayerSpecification, Map as MapLibreMap, SymbolLayerSpecification } from 'maplibre-gl';
import { restsAt } from '../../sim/rules/periods';
import { louder } from './daylight';
import type { DepotView, Dots, EventView, LineDraftView, LineView, LngLatPair, StopView } from '../../sim/types';
import { dotRadiusExpression, ringExpressions, type DotKind } from './pick';
import { bridgesOf, placesAlong, placesOf, RIBBON_PX, runsOf, sidesAlong, type Places } from './sides';
import { FONT_SEMIBOLD } from './style';
import type { GameTokens, MapTokens } from './tokens';

export const DOTS = 'dots';
export const LINES = 'lines';
export const DEPOT_LAND = 'depot-land';
export const DEPOTS = 'depots';
export const DRAFT = 'draft';
export const EVENTS = 'events';
export const DOT_LAYERS = ['dots-homes', 'dots-jobs'] as const;
/** Each kind of dot's layer. */
export const DOT_LAYER: Readonly<Record<DotKind, (typeof DOT_LAYERS)[number]>> = { home: 'dots-homes', job: 'dots-jobs' };
export const LINE_LAYERS = ['lines-route', 'lines-stops', 'stops-lone'] as const;
export const FLAG_LAYERS = ['stops-flag-ring', 'stops-flag-word'] as const;
export const TINT_LAYERS = ['depot-land-fill', 'depot-land-edge'] as const;
export const DRAFT_LAYERS = ['draft-rings', 'draft-route', 'draft-stops', 'draft-order'] as const;
export const EVENT_LAYERS = ['event-pending', 'event-on', 'event-label'] as const;

const empty = { type: 'FeatureCollection' as const, features: [] };

/** A run's offset from the street's middle: its `side` (sides.ts) in ribbon widths, to the right of the way it runs. */
const sideOffset: ExpressionSpecification = ['interpolate', ['linear'], ['zoom'], 12, ['*', ['get', 'side'], RIBBON_PX[0]], 16, ['*', ['get', 'side'], RIBBON_PX[1]]];

/**
 * The game's layers, `step` steps toward night (daylight.ts): its translucent marks grow more opaque as the map dims (louder), and
 * its words in its own inks keep their own halo (wordHalo); the lines' names, in the labels' inks, dim with the map's labels. A
 * resting line's route and stops are mixed with `ground`, its streets' colour at night unless the map says otherwise at dawn.
 */
export function addOverlays(map: MapLibreMap, t: GameTokens, base: Pick<MapTokens, 'label' | 'labelHalo'>, step = 0, ground = t.restingGround): void {
  for (const id of [DEPOT_LAND, DOTS, LINES, DEPOTS, DRAFT, EVENTS]) map.addSource(id, { type: 'geojson', data: empty });
  // A city event's street (the M4 spec, item 2), under the lines and wider than them so it shows on
  // either side of a route: hatched while pending, solid while on, in the warning colour. Wider than every line on the street,
  // side by side (sides.ts), by 2 px a side at zoom 12 and 4 at 16 (`places`, setEvent): 15 px wide at zoom 16, it showed none
  // beside three lines' 21 px of ribbons, and half a pixel a side beside two (the systems audit's twenty-first round).
  const band = (z: 0 | 1): ExpressionSpecification => ['*', RIBBON_PX[z], ['max', 1, ['coalesce', ['get', 'places'], 1]]];
  for (const on of [false, true]) {
    map.addLayer({
      id: on ? 'event-on' : 'event-pending',
      type: 'line',
      source: EVENTS,
      filter: ['all', ['==', ['get', 'kind'], 'street'], ['==', ['get', 'on'], on]],
      layout: { 'line-cap': 'butt', 'line-join': 'round' },
      paint: {
        'line-color': t.stopFlag,
        'line-width': ['interpolate', ['linear'], ['zoom'], 12, ['+', 4, band(0)], 16, ['+', 8, band(1)]],
        'line-opacity': louder(on ? 0.7 : 0.6, step),
        ...(on ? {} : { 'line-dasharray': [0.6, 0.6] }),
      },
    });
  }
  map.addLayer({
    id: 'event-label',
    type: 'symbol',
    source: EVENTS,
    filter: ['==', ['get', 'kind'], 'label'],
    layout: { 'text-field': ['get', 'text'], 'text-font': [FONT_SEMIBOLD], 'text-size': 12, 'text-allow-overlap': true, 'text-offset': [0, -1.4] },
    paint: { 'text-color': t.stopFlag, 'text-halo-color': t.wordHalo, 'text-halo-width': 1.5 },
  });
  // The tint shows only while a depot is being placed (setTint): exactly the land the rule allows.
  map.addLayer({ id: 'depot-land-fill', type: 'fill', source: DEPOT_LAND, layout: { visibility: 'none' }, paint: { 'fill-color': t.depotLand, 'fill-opacity': louder(0.28, step) } });
  map.addLayer({ id: 'depot-land-edge', type: 'line', source: DEPOT_LAND, layout: { visibility: 'none' }, paint: { 'line-color': t.depotLand, 'line-width': 1.5 } });
  // A dot's area grows with its people: radius by the square root, larger as the map zooms in (pick.ts,
  // which finds the dot under the pointer by the same numbers).
  // Homes are filled and jobs ringed, so the two kinds differ in shape as well as colour (PLAN §8: shape plus colour).
  map.addLayer({
    id: 'dots-homes',
    type: 'circle',
    source: DOTS,
    filter: ['==', ['get', 'kind'], 'home'],
    paint: { 'circle-color': t.homeDot, 'circle-opacity': louder(0.55, step), 'circle-radius': dotRadiusExpression() as never, 'circle-pitch-alignment': 'map' },
  });
  map.addLayer({
    id: 'dots-jobs',
    type: 'circle',
    source: DOTS,
    filter: ['==', ['get', 'kind'], 'job'],
    // The ring inside the people radius (pick.ts, ringExpressions), so a job draws no larger than its jobs.
    paint: {
      'circle-color': 'rgba(0, 0, 0, 0)',
      'circle-stroke-color': t.jobDot,
      'circle-stroke-width': ringExpressions().width as never,
      'circle-stroke-opacity': louder(0.7, step),
      'circle-radius': ringExpressions().radius as never,
      'circle-pitch-alignment': 'map',
    },
  });
  const route: LayerSpecification = {
    id: 'lines-route',
    type: 'line',
    source: LINES,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    // Each run of the route at its place among the lines on its street (sides.ts), a ribbon's width a place, so lines on a
    // street they share stand side by side, each its own colour, where the later hid the earlier.
    paint: {
      'line-color': ['get', 'colour'],
      'line-width': ['interpolate', ['linear'], ['zoom'], 12, RIBBON_PX[0], 16, RIBBON_PX[1]],
      'line-offset': sideOffset,
    },
  };
  const stops: LayerSpecification = {
    id: 'lines-stops',
    type: 'circle',
    source: LINES,
    paint: {
      'circle-color': t.stopFill,
      'circle-stroke-color': ['get', 'colour'],
      'circle-stroke-width': 3,
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 4, 16, 8],
    },
  };
  // A resting line's route and then its stops under every running line's route (round 11): opaque, its stops covered a running
  // line's route where it passed them (the review of the twelfth round's second lane).
  addCopy(map, ground, route);
  addCopy(map, ground, stops);
  addRunning(map, route);
  // Each line's name along its route where it has room, in the labels' ink, beside its colour (PLAN §8: shape plus colour):
  // under simulated colour blindness the eight line colours fall as close as 2.0 apart in OKLab (×100), and two pairs are
  // within 7.1 for everyone (src/sim/config/lines.test.ts). Where lines share a street the names that have room show, each on
  // its own line's ribbon (nameOffset), and a click there lists them all. Under the running lines' stops and the flags, which it
  // never covers; over the resting lines' stops, which lie under the running routes.
  addResting(map, ground, {
    id: 'lines-name',
    type: 'symbol',
    source: LINES,
    layout: NAME_LAYOUT,
    paint: { 'text-color': base.label, 'text-halo-color': base.labelHalo, 'text-halo-width': 2 },
  });
  addRunning(map, stops);
  // A stop placed on its own (D25): ringed in the draft's ink, as a line not yet running is, until a line calls there.
  map.addLayer({
    id: 'stops-lone',
    type: 'circle',
    source: LINES,
    filter: ['==', ['get', 'kind'], 'lone'],
    paint: {
      'circle-color': t.stopFill,
      'circle-stroke-color': t.draft,
      'circle-stroke-width': 2,
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 4, 16, 8],
    },
  });
  // A flagged stop: a ring in the flag's colour around it, and the word above it.
  addResting(map, ground, {
    id: 'stops-flag-ring',
    type: 'circle',
    source: LINES,
    paint: {
      'circle-color': 'rgba(0, 0, 0, 0)',
      'circle-stroke-color': t.stopFlag,
      'circle-stroke-width': 2,
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 8, 16, 13],
    },
  });
  addResting(map, ground, {
    id: 'stops-flag-word',
    type: 'symbol',
    source: LINES,
    layout: { 'text-field': ['get', 'word'], 'text-font': [FONT_SEMIBOLD], 'text-size': 12, 'text-anchor': 'bottom', 'text-offset': [0, -1.1], 'text-allow-overlap': true },
    paint: { 'text-color': t.stopFlag, 'text-halo-color': t.wordHalo, 'text-halo-width': 1.5 },
  });
  map.addLayer({
    id: 'depots',
    type: 'circle',
    source: DEPOTS,
    paint: {
      'circle-color': t.depotMark,
      'circle-stroke-color': t.stopFill,
      'circle-stroke-width': 2,
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 6, 16, 11],
    },
  });
  // The draft: each stop's walk ring in the residents' colour, the route dashed, the stops hollow and numbered.
  map.addLayer({ id: 'draft-rings', type: 'fill', source: DRAFT, filter: ['==', ['get', 'kind'], 'ring'], paint: { 'fill-color': t.homeDot, 'fill-opacity': louder(0.08, step), 'fill-outline-color': t.homeDot } });
  // The route being edited at its line's places on the streets it drives already (setDraft), as its ribbon lies there.
  map.addLayer({
    id: 'draft-route',
    type: 'line',
    source: DRAFT,
    filter: ['==', ['get', 'kind'], 'route'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': t.draft, 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 2, 16, 5], 'line-dasharray': [2, 1.5], 'line-offset': sideOffset },
  });
  map.addLayer({
    id: 'draft-stops',
    type: 'circle',
    source: DRAFT,
    filter: ['==', ['get', 'kind'], 'stop'],
    paint: {
      'circle-color': t.stopFill,
      'circle-stroke-color': t.draft,
      // A stop the draft joins draws thicker: a transfer.
      'circle-stroke-width': ['case', ['get', 'joins'], 4, 2],
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 4, 16, 8],
    },
  });
  // Each stop's place in the draft, as the route editor numbers its list (D25).
  map.addLayer({
    id: 'draft-order',
    type: 'symbol',
    source: DRAFT,
    filter: ['==', ['get', 'kind'], 'stop'],
    layout: { 'text-field': ['to-string', ['get', 'n']], 'text-font': [FONT_SEMIBOLD], 'text-size': 12, 'text-anchor': 'bottom', 'text-offset': [0, -0.9], 'text-allow-overlap': true },
    paint: { 'text-color': t.draft, 'text-halo-color': t.wordHalo, 'text-halo-width': 1.5 },
  });
}

/** The lines' names' size, in CSS pixels: the ems their offset counts in. */
const NAME_PX = 12;
/** The furthest place from a street's middle a name follows its ribbon to, either way: past it, a name stands there. No street holds near so many. */
const FURTHEST = 16;

/**
 * A name's offset across its run of the route: its line's place on the street (`side`, sides.ts), in ribbon widths to the right of
 * the way the route runs, as line-offset lays the run's ribbon (RIBBON_PX); MapLibre keeps a line label's offset on that side of the
 * line as it turns the words to read upright. In the street's middle, the names sat over another line's ribbon: on Tremont Street,
 * Lines 2, 5 and 9 side by side, every name stood over Line 5's, and Line 2's 9.8 px from its own (the systems audit's twenty-first
 * round). Linear in the side, so each run's offset is its side times a ribbon. The offset is a layout property, which MapLibre works
 * out at each tile's whole zoom while the ribbon follows the map's own, so its stops stand half a zoom before the ribbon's: the name
 * meets its ribbon at each half zoom and from 16 on, and strays at most half a zoom's growth of a ribbon a place between, 0.5 px a
 * place, where at the ribbon's own stops it strayed twice that, 2.4 px for a line two and a half places out at zoom 14.95 (#201's
 * review). Flat; tilted, MapLibre sizes a name by its distance and a ribbon by the map's zoom.
 */
function nameOffset(): ExpressionSpecification {
  const across = (px: number): ExpressionSpecification => [
    'interpolate',
    ['linear'],
    ['number', ['get', 'side'], 0],
    -FURTHEST,
    ['literal', [0, (-FURTHEST * px) / NAME_PX]],
    FURTHEST,
    ['literal', [0, (FURTHEST * px) / NAME_PX]],
  ];
  return ['interpolate', ['linear'], ['zoom'], 11.5, across(RIBBON_PX[0]), 15.5, across(RIBBON_PX[1])];
}

/** How far a line's name stops short of each end of its run, in metres, at most a quarter of the run's end segment. */
const NAME_SHORT_M = 5;

/**
 * A run's points drawn short of its ends (NAME_SHORT_M), for its name. MapLibre joins the lines of line labels that share an end
 * and their words before it places them (symbol_bucket.ts mergeLines), and the joined line keeps the first one's properties, so a
 * line's names, drawn run by run end to end, stood at whichever run came first in each tile: on the second company at zoom 14, 62%
 * of the names' cells lay off their own run's place, 305 of 491 (#201's review). 10 m apart, the runs' ends fall in different
 * cells of a tile down to zoom 11, the map's least, where a tile's cell is under 2 m, and each name keeps its own run.
 */
export function shortOfEnds(points: readonly LngLatPair[], metres = NAME_SHORT_M): LngLatPair[] {
  const out = points.map((p): LngLatPair => [p[0], p[1]]);
  if (points.length < 2) return out;
  const inward = (from: LngLatPair, to: LngLatPair): LngLatPair => {
    const length = Math.hypot((to[0] - from[0]) * Math.cos((from[1] * Math.PI) / 180), to[1] - from[1]) * 111_195;
    const t = length > 0 ? Math.min(metres, length / 4) / length : 0;
    return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t];
  };
  out[0] = inward(points[0]!, points[1]!);
  out[points.length - 1] = inward(points[points.length - 1]!, points[points.length - 2]!);
  return out;
}

/** A line's names, one along each run of its route (runsOf), short of the run's ends (shortOfEnds), at its place there (nameOffset). */
export function nameFeatures(line: Pick<LineView, 'id' | 'name'>, runs: readonly { readonly points: readonly LngLatPair[]; readonly side: number; readonly first: number; readonly last: number }[]) {
  return runs.map((run) => ({
    type: 'Feature' as const,
    properties: { kind: 'name', id: line.id, name: line.name, side: run.side, first: run.first, last: run.last },
    geometry: { type: 'LineString' as const, coordinates: shortOfEnds(run.points).map((p) => [...p]) },
  }));
}

/** The lines' names' layout: along each run of its route where it has room, on its line's ribbon (nameOffset). e2e/ribbons draws it too. */
export const NAME_LAYOUT: NonNullable<SymbolLayerSpecification['layout']> = {
  'symbol-placement': 'line',
  'symbol-spacing': 320,
  'text-field': ['get', 'name'],
  'text-font': [FONT_SEMIBOLD],
  'text-size': NAME_PX,
  'text-padding': 4,
  'text-offset': nameOffset(),
};

/** The overlays' layers as addOverlays adds them `step` steps toward night, for the light's paints (daylight.ts). */
export function overlayLayers(t: GameTokens, base: Pick<MapTokens, 'label' | 'labelHalo'>, step = 0, ground = t.restingGround): LayerSpecification[] {
  const layers: LayerSpecification[] = [];
  const recorder = { addSource: () => undefined, addLayer: (layer: LayerSpecification) => void layers.push(layer) };
  addOverlays(recorder as unknown as MapLibreMap, t, base, step, ground);
  return layers;
}

/** How much of a line shows while it rests: its route, its name, its stops and their flags. */
export const RESTING_OPACITY = 0.35;
/** A paint property's name, as MapLibre takes it. */
export type PaintName = Parameters<MapLibreMap['setPaintProperty']>[1];
/**
 * The layers a resting line fades in, each drawn twice (addResting): under it a faded copy, `<layer>-resting`, which holds the
 * resting lines' features, and the layer itself, which holds the rest; which features each holds is its filter's, by each
 * feature's line (`id`) or, for a flag, which is a stop's, by its stop (restingStops). The fade is the same for every feature of a
 * layer: faded by an expression of each line's id, the line, symbol and circle programs for it compiled at the first midnight, and
 * held the page 518–1,249 ms in Low graphics (the systems audit's eleventh round). And drawn under, a resting line no longer tints
 * a running one on a street they share, and its name is placed after theirs (MapLibre places the upper layer's names first).
 * - The route and the stops are opaque, their colours RESTING_OPACITY of themselves over the resting ground (`mixes`): laid at
 *   RESTING_OPACITY over the streets, two lines resting on a street they share blended, each over the other, into neither's colour,
 *   and every new line rests at night, overnight off (the systems audit's twelfth round). Opaque, the later hides the earlier where they
 *   lie over one another, as at a stop they share, as by day; on a street they share they stand side by side (sides.ts).
 * - The names and the flags, which never lie over one another, are laid at RESTING_OPACITY (`fades`).
 */
const RESTING: readonly { readonly layer: string; readonly kind: string; readonly by: 'id' | 'stop'; readonly fades: readonly string[]; readonly mixes: readonly string[] }[] = [
  { layer: 'lines-route', kind: 'route', by: 'id', fades: [], mixes: ['line-color'] },
  { layer: 'lines-name', kind: 'name', by: 'id', fades: ['text-opacity'], mixes: [] },
  { layer: 'lines-stops', kind: 'stop', by: 'id', fades: [], mixes: ['circle-color', 'circle-stroke-color'] },
  { layer: 'stops-flag-ring', kind: 'flag', by: 'stop', fades: ['circle-stroke-opacity'], mixes: [] },
  { layer: 'stops-flag-word', kind: 'flag', by: 'stop', fades: ['text-opacity'], mixes: [] },
];

/** `top` laid at `alpha` over `under`, as the screen blends it, each channel rounded. */
function over(top: string, alpha: number, under: string): string {
  const ch = (hex: string) => [16, 8, 0].map((shift) => (Number.parseInt(hex.slice(1), 16) >> shift) & 255);
  const [a, b] = [ch(top), ch(under)];
  return `#${a.map((c, i) => Math.round(alpha * c + (1 - alpha) * b[i]!).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * A colour paint as a resting line shows it, opaque: RESTING_OPACITY of it over `ground`, worked out here for a colour, and by the
 * map for each feature's own (an interpolation from the ground to it, which MapLibre takes in each channel as the screen blends).
 */
export function restingColour(colour: unknown, ground: string): unknown {
  if (typeof colour === 'string') return over(colour, RESTING_OPACITY, ground);
  return ['interpolate', ['linear'], RESTING_OPACITY, 0, ['to-color', ground], 1, ['to-color', colour]];
}
/** The faded copies, for the pick under a click: a resting line opens as any other. */
export const RESTING_LAYERS = RESTING.map((r) => `${r.layer}-resting`);

/** Which of a layer's kind of feature a resting layer's copy holds (`rests`) or the layer itself does: those named by `ids`, or the others. */
function restingFilter(r: (typeof RESTING)[number], ids: readonly number[], rests: boolean): FilterSpecification {
  const named: ExpressionSpecification = ['in', ['get', r.by], ['literal', [...ids]]];
  return ['all', ['==', ['get', 'kind'], r.kind], rests ? named : ['!', named]];
}

/** Adds the faded copy of `layer` (one of RESTING's) on `ground`, as no line rests. */
function addCopy(map: MapLibreMap, ground: string, layer: LayerSpecification): void {
  const r = RESTING.find((x) => x.layer === layer.id)!;
  const own = (layer as { paint?: Record<string, unknown> }).paint ?? {};
  const paint = { ...own, ...Object.fromEntries(r.fades.map((p) => [p, RESTING_OPACITY])), ...Object.fromEntries(r.mixes.map((p) => [p, restingColour(own[p], ground)])) };
  map.addLayer({ ...layer, id: `${layer.id}-resting`, filter: restingFilter(r, [], true), paint } as LayerSpecification);
}

/** Adds `layer` (one of RESTING's) itself, which holds every line's features as no line rests. */
function addRunning(map: MapLibreMap, layer: LayerSpecification): void {
  const r = RESTING.find((x) => x.layer === layer.id)!;
  map.addLayer({ ...layer, filter: restingFilter(r, [], false) } as LayerSpecification);
}

/** Adds `layer` (one of RESTING's) and, just under it, its faded copy on `ground`, both as no line rests. */
function addResting(map: MapLibreMap, ground: string, layer: LayerSpecification): void {
  addCopy(map, ground, layer);
  addRunning(map, layer);
}

/**
 * Mixes the resting copies' route and stops with `ground` instead (addOverlays): the main roads at the step shown while a line
 * rests at dawn, as the base lightens toward 05:00. A colour of each feature's set anew lays out the lines' source again, so the
 * map sets it only as it changes, four times a night at most: at 03:30, 04:00 and 04:30, and back as the lines wake at 05:00, with
 * the filters that wake them (loadMap.ts).
 */
export function setRestingGround(map: Pick<MapLibreMap, 'setPaintProperty'>, t: GameTokens, base: Pick<MapTokens, 'label' | 'labelHalo'>, ground: string): void {
  const layers = overlayLayers(t, base, 0, ground);
  for (const r of RESTING) {
    const copy = layers.find((l) => l.id === `${r.layer}-resting`) as { paint: Record<string, unknown> };
    for (const p of r.mixes) map.setPaintProperty(`${r.layer}-resting`, p as PaintName, copy.paint[p] as never);
  }
}

/**
 * The lines resting at `secondOfDay` (restsAt, D13's one predicate, with the schedule's periods): those whose period runs no
 * service and with no bus in service on a trip begun before it (`inService`: the fleet's plans, inServiceAt), so a line with
 * overnight off rests from its last bus's return after 00:00 until 05:00. D13: the map says the time of day without the tint,
 * so it never depends on it.
 */
export function restingLines(lines: readonly Pick<LineView, 'id' | 'headways'>[], secondOfDay: number, inService: (id: number) => boolean = () => false): number[] {
  return lines.filter((line) => restsAt(line.headways, secondOfDay, inService(line.id))).map((line) => line.id);
}

/** The stops only resting lines call at: their flags rest with them, a word on a line that does not run. */
export function restingStops(stops: readonly Pick<StopView, 'id' | 'lineIds'>[], resting: readonly number[]): number[] {
  const rests = new Set(resting);
  return stops.filter((s) => s.lineIds.length > 0 && s.lineIds.every((id) => rests.has(id))).map((s) => s.id);
}

/**
 * Moves the resting lines' features, and their stops' flags, into the faded copies, and every other line's back: filters alone, so
 * no paint changes and no program is compiled (RESTING). Set when they change, at night or with the lines, never per frame (RN-04).
 */
export function setResting(map: Pick<MapLibreMap, 'setFilter'>, lines: readonly number[], stops: readonly number[]): void {
  for (const r of RESTING) {
    const ids = r.by === 'id' ? lines : stops;
    map.setFilter(`${r.layer}-resting`, restingFilter(r, ids, true));
    map.setFilter(r.layer, restingFilter(r, ids, false));
  }
}

export function setDepotLand(map: MapLibreMap, rings: readonly (readonly LngLatPair[])[]): void {
  const features = rings.map((ring) => ({ type: 'Feature' as const, properties: {}, geometry: { type: 'Polygon' as const, coordinates: [[...ring.map((p) => [...p]), [...ring[0]!]]] } }));
  (map.getSource(DEPOT_LAND) as GeoJSONSource).setData({ type: 'FeatureCollection', features });
}

/** Shows or hides the depot-land tint: once per tool change, never per frame (RN-04). */
export function setTint(map: MapLibreMap, visible: boolean): void {
  for (const id of TINT_LAYERS) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
}

export function setDepots(map: MapLibreMap, depots: readonly DepotView[]): void {
  const features = depots.map((d) => ({ type: 'Feature' as const, properties: { id: d.id }, geometry: { type: 'Point' as const, coordinates: [...d.at] } }));
  (map.getSource(DEPOTS) as GeoJSONSource).setData({ type: 'FeatureCollection', features });
}

/** A walk ring of `metres` around `at`, as a 48-sided polygon (a shape for the eye; the count comes from the sim). */
function ring(at: LngLatPair, metres: number): number[][] {
  const [lon, lat] = at;
  const dLat = metres / 111_132;
  const dLon = metres / (111_320 * Math.cos((lat * Math.PI) / 180));
  return Array.from({ length: 49 }, (_, k) => {
    const a = (2 * Math.PI * (k % 48)) / 48;
    return [lon + dLon * Math.cos(a), lat + dLat * Math.sin(a)];
  });
}

/**
 * The line being drawn or edited: each stop's walk ring, its route and its stops. A route edited for line `line` runs at that line's
 * places (`places`, sides.ts) on the streets it drives already, where its ribbon lies: in the street's middle, Line 2's draft on
 * Tremont Street lay over Line 5's ribbon, 7 px from its own (the systems audit's twenty-first round). Elsewhere, and for a new
 * line, in the middle.
 */
export function setDraft(map: MapLibreMap, draft: LineDraftView | null, places: Places = new Map(), line: number | null = null): void {
  const sides = draft && line !== null ? sidesAlong(places, line, draft.route) : new Float32Array(Math.max(0, (draft?.route.length ?? 1) - 1));
  const features = draft
    ? [
        ...draft.stops.map((s) => ({ type: 'Feature' as const, properties: { kind: 'ring' }, geometry: { type: 'Polygon' as const, coordinates: [ring(s.at, draft.walkM)] } })),
        ...runsOf(draft.route, sides).map((run) => ({ type: 'Feature' as const, properties: { kind: 'route', side: run.side }, geometry: { type: 'LineString' as const, coordinates: run.points.map((p) => [...p]) } })),
        ...draft.stops.map((s, k) => ({ type: 'Feature' as const, properties: { kind: 'stop', joins: s.joins !== null, n: k + 1 }, geometry: { type: 'Point' as const, coordinates: [...s.at] } })),
      ]
    : [];
  (map.getSource(DRAFT) as GeoJSONSource).setData({ type: 'FeatureCollection', features });
}

const EVENT_NAMES: Readonly<Record<EventView['kind'], string>> = { roadworks: 'Roadworks', festival: 'Festival', snow: 'Snow' };

/** The words at a city event: "Roadworks tomorrow", "Festival tomorrow" or "Snow tomorrow" while pending, then the days left. */
export function eventLabel(e: Pick<EventView, 'kind' | 'phase' | 'daysLeft'>): string {
  const name = EVENT_NAMES[e.kind];
  if (e.phase === 'pending') return `${name} tomorrow`;
  return e.daysLeft <= 1 ? `${name} · last day` : `${name} · ${e.daysLeft} days left`;
}

/** A city event's street and its words; `places` stands the lines on the streets (sides.ts), its street drawn wider than them. */
export function setEvent(map: MapLibreMap, event: EventView | null, places: Places = new Map()): void {
  const features = event
    ? [
        ...event.path.flatMap((line) =>
          runsOf(line, placesAlong(places, line)).map((run) => ({
            type: 'Feature' as const,
            properties: { kind: 'street', on: event.phase === 'on', places: run.side },
            geometry: { type: 'LineString' as const, coordinates: run.points.map((p) => [...p]) },
          })),
        ),
        { type: 'Feature' as const, properties: { kind: 'label', text: eventLabel(event) }, geometry: { type: 'Point' as const, coordinates: [...event.at] } },
      ]
    : [];
  (map.getSource(EVENTS) as GeoJSONSource).setData({ type: 'FeatureCollection', features });
}

/** Each dot carries its kind, its people (`w`) and its place in its kind's list (`i`), for the pick under the pointer. */
export function setDots(map: MapLibreMap, dots: Dots): void {
  const point = (kind: DotKind) => ([lon, lat, w]: readonly [number, number, number], i: number) => ({
    type: 'Feature' as const,
    properties: { kind, w, i },
    geometry: { type: 'Point' as const, coordinates: [lon, lat] },
  });
  (map.getSource(DOTS) as GeoJSONSource).setData({ type: 'FeatureCollection', features: [...dots.homes.map(point('home')), ...dots.jobs.map(point('job'))] });
}

/** Which kinds of dot the map shows. */
export type DotKinds = Readonly<Record<DotKind, boolean>>;

/** Shows or hides each kind of dot: once per change, never per frame (RN-04). */
export function setDotKinds(map: Pick<MapLibreMap, 'setLayoutProperty'>, shown: DotKinds): void {
  for (const kind of ['home', 'job'] as const) map.setLayoutProperty(DOT_LAYER[kind], 'visibility', shown[kind] ? 'visible' : 'none');
}

/** The flag a stop shows on the map, or null: Quiet, Loss, or both (in sentence case, D25's copy pass). */
export function flagWord(stop: Pick<StopView, 'quiet' | 'loss'>): string | null {
  return stop.quiet && stop.loss ? 'Quiet · loss' : stop.quiet ? 'Quiet' : stop.loss ? 'Loss' : null;
}

/** The lines' routes, stops and names, and the stops no line calls at; `places` stands the lines on their streets (sides.ts). */
export function setLines(map: MapLibreMap, lines: readonly LineView[], stops: readonly StopView[], places: Places = placesOf(lines)): void {
  const features = [
    ...lines.flatMap((line) => {
      // The route in runs, each at its place among the lines on that street (`side`), cut where it turns back too, with the
      // pieces that carry its ribbon across from each run to the next (bridgesOf); and the name along each run, on its ribbon.
      const sides = sidesAlong(places, line.id, line.route);
      const drawn = runsOf(line.route, sides, true);
      const runs = runsOf(line.route, sides);
      return [
        // The bridges marked as such: a bridge stands between its line's places, over a neighbour's ribbon, so a click on it says
        // which line the player pointed at, as a name does (loadMap.ts; #202's review).
        ...[...drawn.map((run) => ({ run, bridge: false })), ...bridgesOf(line.route, drawn).map((run) => ({ run, bridge: true }))].map(({ run, bridge }) => ({
          type: 'Feature' as const,
          properties: { kind: 'route', colour: line.colour, id: line.id, side: run.side, first: run.first, last: run.last, bridge },
          geometry: { type: 'LineString' as const, coordinates: run.points.map((p) => [...p]) },
        })),
        ...nameFeatures(line, runs),
        ...line.stops.map((p, q) => ({ type: 'Feature' as const, properties: { kind: 'stop', colour: line.colour, id: line.id, stop: line.stopIds[q] ?? -1 }, geometry: { type: 'Point' as const, coordinates: [...p] } })),
      ];
    }),
    ...stops.flatMap((s) => (s.lineIds.length ? [] : [{ type: 'Feature' as const, properties: { kind: 'lone', stop: s.id }, geometry: { type: 'Point' as const, coordinates: [...s.at] } }])),
    ...stops.flatMap((s) => {
      const word = flagWord(s);
      return word ? [{ type: 'Feature' as const, properties: { kind: 'flag', word, stop: s.id }, geometry: { type: 'Point' as const, coordinates: [...s.at] } }] : [];
    }),
  ];
  (map.getSource(LINES) as GeoJSONSource).setData({ type: 'FeatureCollection', features });
}
