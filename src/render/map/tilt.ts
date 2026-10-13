// The tilt (PLAN §6; D2): `T` or the 2D/3D chip tilts the board to 50° with extruded buildings, and
// again flattens it; a right-drag pitches it, and released below 12° it snaps flat (the M5 spec,
// item 6). The buildings cross-fade once per mode change, never per frame (RN-04). The camera mode
// never changes a sim number, a save byte or a rule verdict (CLAUDE.md). It imports nothing, so the
// menu chunk that reads the T key stays free of the style (I14).

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

/** The buildings cross-fade over this long at each mode change; reduced motion swaps them at once. */
export const CROSS_FADE_MS = 400;

/** Each buildings layer's opacity in a mode: the one the mode shows at full, the other faded out. */
export function buildingOpacity(mode: ViewMode): { readonly [BUILDINGS_2D]: number; readonly [BUILDINGS_3D]: number } {
  return { [BUILDINGS_2D]: mode === '2d' ? 1 : 0, [BUILDINGS_3D]: mode === '3d' ? 1 : 0 };
}

/** A right-drag pitches the board this many degrees a pixel up (V3's, `Intralines_City@dc63602:src/render/three/constants.ts:14-49`). */
export const DRAG_DEG_PER_PX = 0.25;
/** Released below this pitch, the board snaps flat (PLAN §6). */
export const SNAP_FLAT_DEG = 12;
/** 3D's least pitch (PLAN §6: 25–60°). */
export const MIN_3D_PITCH = 25;

/** The pitch a right-drag reaches: up tilts, down flattens, within 0 and 3D's most. */
export function draggedPitch(startPitch: number, startY: number, y: number): number {
  return Math.min(MAX_PITCH, Math.max(0, startPitch + (startY - y) * DRAG_DEG_PER_PX));
}

/** Where a released drag settles: flat below the snap, else 3D at 25–60°. */
export function settled(pitch: number): { readonly mode: ViewMode; readonly pitch: number } {
  return pitch < SNAP_FLAT_DEG ? { mode: '2d', pitch: 0 } : { mode: '3d', pitch: Math.min(MAX_PITCH, Math.max(MIN_3D_PITCH, pitch)) };
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
