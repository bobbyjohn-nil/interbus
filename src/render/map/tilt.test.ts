import { describe, expect, it } from 'vitest';
import {
  BUILDINGS_2D,
  BUILDINGS_3D,
  buildingsLayer,
  buildingVisibility,
  cameraFor,
  isTiltKey,
  MAX_PITCH,
  MIN_ZOOM,
  TILT_PITCH,
  toggled,
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
    expect(cameraFor('3d', 15)).toEqual({ pitch: TILT_PITCH, zoom: 15 });
    expect(cameraFor('2d', 15)).toEqual({ pitch: 0, zoom: 15 });
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
