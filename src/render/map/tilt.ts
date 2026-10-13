// The raw tilt (PLAN §6, week 2): `T` tilts the board to 50° with extruded buildings, and again
// flattens it. The 2D/3D chip, the cross-fade, right-drag and the snap flat below 12° land in
// week 10. The camera mode never changes a sim number, a save byte or a rule verdict (CLAUDE.md).
// It imports nothing, so the menu chunk that reads the T key stays free of the style (I14).

export type ViewMode = '2d' | '3d';

/** Flat footprints, drawn in 2D (Protomaps' own layer). */
export const BUILDINGS_2D = 'buildings';
/** Extrusions, drawn in 3D instead of the footprints (style.ts). */
export const BUILDINGS_3D = 'buildings-3d';

/** The `T` default camera (I12): pitch 50° at zoom 14 or closer. */
export const TILT_PITCH = 50;
/** 3D allows 25–60° (PLAN §6). */
export const MAX_PITCH = 60;
/** 3D allows zoom 14 and closer; 2D zooms out to the whole of Inner Boston. */
export const MIN_ZOOM: Readonly<Record<ViewMode, number>> = { '2d': 11, '3d': 14 };

export const toggled = (mode: ViewMode): ViewMode => (mode === '2d' ? '3d' : '2d');

/** Where the camera goes when the mode changes; flattening keeps the zoom. */
export function cameraFor(mode: ViewMode, zoom: number): { pitch: number; zoom: number } {
  return mode === '3d' ? { pitch: TILT_PITCH, zoom: Math.max(zoom, MIN_ZOOM['3d']) } : { pitch: 0, zoom };
}

/** The buildings layer each mode shows: footprints in 2D, extrusions in 3D. */
export function buildingsLayer(mode: ViewMode): string {
  return mode === '2d' ? BUILDINGS_2D : BUILDINGS_3D;
}

export function buildingVisibility(mode: ViewMode): Record<string, 'visible' | 'none'> {
  return {
    [BUILDINGS_2D]: mode === '2d' ? 'visible' : 'none',
    [BUILDINGS_3D]: mode === '3d' ? 'visible' : 'none',
  };
}

export interface KeyPress {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
  readonly repeat: boolean;
  readonly target: EventTarget | null;
}

/** `T`, with Shift or Caps Lock or neither, not held down and not typed into a field. */
export function isTiltKey(press: KeyPress): boolean {
  if (press.ctrlKey || press.metaKey || press.altKey || press.repeat) return false;
  if (press.key !== 't' && press.key !== 'T') return false;
  const target = press.target as { tagName?: string; isContentEditable?: boolean } | null;
  if (target?.isContentEditable) return false;
  return !['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '');
}
