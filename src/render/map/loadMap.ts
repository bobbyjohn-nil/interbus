// The lazy map chunk: MapLibre, PMTiles and the style generator load only when the board opens,
// so the menu stays small (PLAN §6, I14).
import { addProtocol, Map as MapLibreMap, type ErrorEvent } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { FileSource, PMTiles, Protocol } from 'pmtiles';
import { assetBase, openCityFile, reportReplaced } from '../../platform';
import { paddedBounds, type City } from '../../cities';
import { buildStyle } from './style';
import { LIGHT } from './tokens';

let protocol: Protocol | null = null;

function pmtilesProtocol(): Protocol {
  if (!protocol) {
    protocol = new Protocol();
    addProtocol('pmtiles', protocol.tile);
  }
  return protocol;
}

export interface MountedMap {
  readonly map: MapLibreMap;
  readonly tileReads: 'range' | 'whole';
  dispose(): void;
}

export async function mountMap(container: HTMLElement, city: City): Promise<MountedMap> {
  if (!city.tiles) throw new Error(`${city.name} has no tile file in this build`);
  const file = await openCityFile(`cities/${city.tiles.file}`);
  const tiles =
    file.kind === 'range' ? new PMTiles(file.url) : new PMTiles(new FileSource(new File([file.blob], city.tiles.file)));
  pmtilesProtocol().add(tiles);

  const [w, s, e, n] = paddedBounds(city.extent);
  const map = new MapLibreMap({
    container,
    style: buildStyle({ tilesUrl: `pmtiles://${tiles.source.getKey()}`, assetBase: assetBase(), tokens: LIGHT }),
    center: [city.view.center[0], city.view.center[1]],
    zoom: city.view.zoom,
    minZoom: 11,
    maxZoom: 18,
    maxBounds: [w, s, e, n],
    // Flat in week 1; the T key tilts from week 2 (PLAN §14).
    pitch: 0,
    maxPitch: 0,
    dragRotate: false,
    pitchWithRotate: false,
    touchPitch: false,
    attributionControl: false,
  });
  map.touchZoomRotate.disableRotation();
  map.keyboard.disableRotation();

  map.on('error', (event: ErrorEvent) => {
    const status = (event.error as { status?: number } | undefined)?.status;
    if (status === 404) reportReplaced('city-file');
  });

  return {
    map,
    tileReads: file.kind,
    dispose: () => map.remove(),
  };
}
