import { describe, expect, it } from 'vitest';
import {
  BUILDINGS_2D,
  BUILDINGS_3D,
  buildingOpacity,
  buildingsLayer,
  buildingVisibility,
  cameraFor,
  draggedBearing,
  draggedPitch,
  holdOutcome,
  isTiltKey,
  MAX_PITCH,
  MIN_ZOOM,
  normalBearing,
  settled,
  TILT_PITCH,
  toggled,
  viewKey,
  type KeyPress,
} from './tilt';

const press = (over: Partial<KeyPress> = {}): KeyPress => ({
  key: 't',
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  repeat: false,
  target: null,
  ...over,
});

describe('raw tilt', () => {
  it('T tilts to 50° and back to flat', () => {
    expect(toggled('2d')).toBe('3d');
    expect(toggled(toggled('2d'))).toBe('2d');
    expect(cameraFor('3d', 15)).toEqual({ pitch: TILT_PITCH, zoom: 15, bearing: 0 });
    expect(cameraFor('2d', 15)).toEqual({ pitch: 0, zoom: 15, bearing: 0 });
    expect(TILT_PITCH).toBeLessThanOrEqual(MAX_PITCH);
  });

  it('tilts no further out than zoom 14 (PLAN §6), and flattening keeps the zoom', () => {
    expect(cameraFor('3d', 12).zoom).toBe(MIN_ZOOM['3d']);
    expect(MIN_ZOOM['3d']).toBe(14);
    expect(cameraFor('2d', 14.5).zoom).toBe(14.5);
  });

  it('shows footprints in 2D and extrusions in 3D, never both', () => {
    expect(buildingVisibility('2d')).toEqual({ [BUILDINGS_2D]: 'visible', [BUILDINGS_3D]: 'none' });
    expect(buildingVisibility('3d')).toEqual({ [BUILDINGS_2D]: 'none', [BUILDINGS_3D]: 'visible' });
    expect(buildingsLayer('2d')).toBe(BUILDINGS_2D);
    expect(buildingsLayer('3d')).toBe(BUILDINGS_3D);
  });
});

describe('the T key', () => {
  it('is t or T, Shift and Caps Lock alike', () => {
    expect(isTiltKey(press())).toBe(true);
    expect(isTiltKey(press({ key: 'T' }))).toBe(true);
    expect(isTiltKey(press({ key: 'y' }))).toBe(false);
  });

  it('leaves browser and system shortcuts alone (Cmd-T, Ctrl-T, Alt-T)', () => {
    expect(isTiltKey(press({ metaKey: true }))).toBe(false);
    expect(isTiltKey(press({ ctrlKey: true }))).toBe(false);
    expect(isTiltKey(press({ altKey: true }))).toBe(false);
  });

  it('tilts once per press, not again while held', () => {
    expect(isTiltKey(press({ repeat: true }))).toBe(false);
  });

  it('types into a field instead of tilting', () => {
    for (const tagName of ['INPUT', 'TEXTAREA', 'SELECT']) {
      expect(isTiltKey(press({ target: { tagName } as unknown as EventTarget }))).toBe(false);
    }
    expect(isTiltKey(press({ target: { tagName: 'DIV', isContentEditable: true } as unknown as EventTarget }))).toBe(false);
    expect(isTiltKey(press({ target: { tagName: 'BUTTON' } as unknown as EventTarget }))).toBe(true);
  });
});

// The drag, snap and cross-fade (the M5 spec, item 6). Shown failing (TS-04) with no snap (a release
// at 8° left the board half tilted with flat buildings) and with both layers drawn at full in either mode.
describe('drag, snap and cross-fade', () => {
  it('pitches 0.25° a pixel up and flattens down, within 0–60°', () => {
    expect(draggedPitch(0, 500, 400)).toBe(25);
    expect(draggedPitch(50, 500, 540)).toBe(40);
    expect(draggedPitch(50, 500, 100)).toBe(60);
    expect(draggedPitch(10, 500, 900)).toBe(0);
  });

  it('snaps flat below 12°, and settles in 3D at 25–60° otherwise', () => {
    expect(settled(8)).toEqual({ mode: '2d', pitch: 0, bearing: 0 });
    expect(settled(11.9)).toEqual({ mode: '2d', pitch: 0, bearing: 0 });
    expect(settled(12)).toEqual({ mode: '3d', pitch: 25, bearing: 0 });
    expect(settled(40)).toEqual({ mode: '3d', pitch: 40, bearing: 0 });
  });

  it('fades the mode’s buildings in and the other’s out', () => {
    expect(buildingOpacity('2d')).toEqual({ buildings: 1, 'buildings-3d': 0 });
    expect(buildingOpacity('3d')).toEqual({ buildings: 0, 'buildings-3d': 1 });
  });
});

// The owner's initial playtest (D25): "it would be nice to just hold double click down and be able to
// switch. you also can't rotate when in 3d mode, you can only look from the south to north". Shown
// failing (TS-04) with the old cameraFor and settled, which carried no bearing, and with no hold.
describe('double-click and hold, and turning in 3D', () => {
  it('reads a held double-click: a drag once it moves 3 px, a flip once still for half a second, else the zoom', () => {
    expect(holdOutcome(1, 120)).toBe('zoom');
    expect(holdOutcome(3, 100)).toBe('drag');
    expect(holdOutcome(2, 500)).toBe('toggle');
    expect(holdOutcome(1, 499)).toBe('zoom');
    expect(holdOutcome(10, 900)).toBe('drag');
  });

  it('turns 0.8° a pixel sideways, all the way round', () => {
    expect(draggedBearing(0, 500, 600)).toBe(80);
    expect(draggedBearing(170, 0, 25)).toBe(-170);
    expect(draggedBearing(-170, 25, 0)).toBe(170);
    expect(normalBearing(360)).toBe(0);
    expect(normalBearing(-180)).toBe(180);
    expect(Object.is(normalBearing(-0), 0)).toBe(true);
  });

  it('settles flat facing north, and in 3D keeps the turn unless it is within 7° of north', () => {
    expect(settled(8, 135)).toEqual({ mode: '2d', pitch: 0, bearing: 0 });
    expect(settled(40, 5)).toEqual({ mode: '3d', pitch: 40, bearing: 0 });
    expect(settled(40, -6.9)).toEqual({ mode: '3d', pitch: 40, bearing: 0 });
    expect(settled(40, 135)).toEqual({ mode: '3d', pitch: 40, bearing: 135 });
    expect(settled(40, 190)).toEqual({ mode: '3d', pitch: 40, bearing: -170 });
  });

  it('flattens to north and tilts keeping the turn', () => {
    expect(cameraFor('2d', 15, 135).bearing).toBe(0);
    expect(cameraFor('3d', 15, 135).bearing).toBe(135);
  });

  it('reads T, N, Q and E with the T key’s guards', () => {
    expect(viewKey(press({ key: 'n' }))).toBe('north');
    expect(viewKey(press({ key: 'Q' }))).toBe('left');
    expect(viewKey(press({ key: 'e' }))).toBe('right');
    expect(viewKey(press({ key: 't' }))).toBe('tilt');
    expect(viewKey(press({ key: 'Enter' }))).toBeNull();
    expect(viewKey(press({ key: 'e', metaKey: true }))).toBeNull();
    expect(viewKey(press({ key: 'q', repeat: true }))).toBeNull();
    expect(viewKey(press({ key: 'n', target: { tagName: 'INPUT' } as unknown as EventTarget }))).toBeNull();
  });
});
