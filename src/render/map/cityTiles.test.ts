import { describe, expect, it } from 'vitest';
import { isGone } from './cityTiles';

describe('city tile reads', () => {
  it('treats 404 and 410 from pmtiles as a replaced build, nothing else', () => {
    expect(isGone(new Error('Bad response code: 404'))).toBe(true);
    expect(isGone(new Error('Bad response code: 410'))).toBe(true);
    expect(isGone(new Error('Bad response code: 500'))).toBe(false);
    expect(isGone(new Error('Wrong magic number for PMTiles archive'))).toBe(false);
    expect(isGone('Bad response code: 404')).toBe(false);
  });
});
