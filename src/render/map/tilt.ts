// The tilt (PLAN §6; D2): `T` or the compass tilts the board to 50° with extruded buildings, and
// again flattens it; a right-drag (or Ctrl-drag, or a double-click held and dragged) pitches it, and
// released below 12° it snaps flat (the M5 spec, item 6). A double-click held still for half a second
// flips 2D and 3D; a quick one still zooms (D25). In 3D the same drags turn the board sideways, and Q
// and E turn it; N or the compass faces north. 2D always faces north, and a mode change that another
// move cuts short still ends in its mode (resettle). The buildings cross-fade once per mode change,
// never per frame (RN-04). The camera never changes a sim number, a save byte or a rule verdict
// (CLAUDE.md). It imports nothing, so the menu chunk that reads the keys stays free of the style (I14).

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

/** Where the camera goes when the mode changes: flattening keeps the zoom and faces north; tilting keeps the bearing. */
export function cameraFor(mode: ViewMode, zoom: number, bearing = 0): { pitch: number; zoom: number; bearing: number } {
  return mode === '3d' ? { pitch: TILT_PITCH, zoom: Math.max(zoom, MIN_ZOOM['3d']), bearing: normalBearing(bearing) } : { pitch: 0, zoom, bearing: 0 };
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

/** A sideways drag turns the board this many degrees a pixel: MapLibre's own rotate speed (its mouse.ts). */
export const ROTATE_DEG_PER_PX = 0.8;
/** A turn released within this of north snaps to north: MapLibre's own bearingSnap. */
export const BEARING_SNAP_DEG = 7;
/** Q and E turn the board this far: MapLibre's own keyboard bearing step. */
export const TURN_STEP_DEG = 15;

/** A bearing in −180° to 180°. */
export function normalBearing(bearing: number): number {
  const b = (((bearing + 180) % 360) + 360) % 360 - 180;
  return b === -180 ? 180 : b === 0 ? 0 : b;
}

/** The bearing a sideways drag reaches: right turns the board one way, left the other, all the way round. */
export function draggedBearing(startBearing: number, startX: number, x: number): number {
  return normalBearing(startBearing + (x - startX) * ROTATE_DEG_PER_PX);
}

/** Where a released drag settles: flat and facing north below the snap, else 3D at 25–60°, snapped to north within 7°. */
export function settled(pitch: number, bearing = 0): { readonly mode: ViewMode; readonly pitch: number; readonly bearing: number } {
  if (pitch < SNAP_FLAT_DEG) return { mode: '2d', pitch: 0, bearing: 0 };
  const b = normalBearing(bearing);
  return { mode: '3d', pitch: Math.min(MAX_PITCH, Math.max(MIN_3D_PITCH, pitch)), bearing: Math.abs(b) < BEARING_SNAP_DEG ? 0 : b };
}

/**
 * Where a camera at rest goes to agree with its mode, or null when it does: 2D flat and facing north,
 * 3D at 25–60°. A mode change that another move cut short (a turn, N, a pan) finishes there, a 3D one
 * at `aim`, the pitch it was going to.
 */
export function resettle(mode: ViewMode, pitch: number, bearing: number, aim = TILT_PITCH): { readonly pitch: number; readonly bearing?: number } | null {
  const near = (a: number, b: number) => Math.abs(a - b) < 0.01;
  if (mode === '2d') return near(pitch, 0) && near(normalBearing(bearing), 0) ? null : { pitch: 0, bearing: 0 };
  return pitch > MIN_3D_PITCH - 0.01 && pitch < MAX_PITCH + 0.01 ? null : { pitch: Math.min(MAX_PITCH, Math.max(MIN_3D_PITCH, aim)) };
}

/** A press that moves this far is a drag: MapLibre's own click tolerance, so its click and ours agree. */
export const HOLD_MOVE_PX = 3;
/** A double-click held still this long flips 2D and 3D: MapLibre's own long-press delay. */
export const HOLD_TOGGLE_MS = 500;

/** What a double-click's second press has become: a drag once it moves, a flip once held still, else (so far) the zoom it always was. */
export function holdOutcome(movedPx: number, heldMs: number): 'drag' | 'toggle' | 'zoom' {
  if (movedPx >= HOLD_MOVE_PX) return 'drag';
  return heldMs >= HOLD_TOGGLE_MS ? 'toggle' : 'zoom';
}

export interface KeyPress {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
  readonly repeat: boolean;
  readonly target: EventTarget | null;
}

/** What a key does to the view: `T` tilts or flattens, `N` faces north, `Q` and `E` turn (3D only). */
export type ViewKey = 'tilt' | 'north' | 'left' | 'right';

export const VIEW_KEYS: Readonly<Record<string, ViewKey>> = { t: 'tilt', n: 'north', q: 'left', e: 'right' };

/**
 * The view key pressed, with Shift or Caps Lock or neither, not held down, not typed into a field and not pressed in an open
 * list or menu, which keeps its keys as it keeps the game's (App.tsx): T tilted the map behind the speed list (round 10);
 * else null.
 */
export function viewKey(press: KeyPress): ViewKey | null {
  if (press.ctrlKey || press.metaKey || press.altKey || press.repeat) return null;
  const key = VIEW_KEYS[press.key.toLowerCase()];
  if (!key || press.key.length !== 1) return null;
  const target = press.target as { tagName?: string; isContentEditable?: boolean; closest?: (selector: string) => unknown } | null;
  if (target?.isContentEditable) return null;
  if (target?.closest?.('[role="listbox"], [role="menu"]')) return null;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '') ? null : key;
}

/** `T`, as viewKey reads it. */
export function isTiltKey(press: KeyPress): boolean {
  return viewKey(press) === 'tilt';
}
