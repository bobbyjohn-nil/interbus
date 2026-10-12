import { describe, expect, it } from 'vitest';
import { CITIES, paddedBounds } from './cities';

describe('city registry', () => {
  it('starts with Boston, inside its own play area', () => {
    const boston = CITIES[0];
    expect(boston?.id).toBe('boston');
    const [w, s, e, n] = boston!.extent;
    const [lon, lat] = boston!.view.center;
    expect(lon).toBeGreaterThan(w);
    expect(lon).toBeLessThan(e);
    expect(lat).toBeGreaterThan(s);
    expect(lat).toBeLessThan(n);
  });

  it('pads the play area by 1.5 km on every side', () => {
    const [w, s, e, n] = paddedBounds([-71.16, 42.315, -70.98, 42.405]);
    expect(42.315 - s).toBeCloseTo(0.01347, 4);
    expect(n - 42.405).toBeCloseTo(0.01347, 4);
    expect(-71.16 - w).toBeCloseTo(0.01823, 4);
    expect(e - -70.98).toBeCloseTo(0.01823, 4);
  });

  it('names a content-hashed file and its checksum once tiles exist', () => {
    for (const city of CITIES) {
      if (!city.tiles) continue;
      expect(city.tiles.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(city.tiles.file).toContain(city.tiles.sha256.slice(0, 8));
      expect(city.tiles.url).toMatch(/^https:\/\/github\.com\/bobbyjohn-nil\/interbus\/releases\/download\//);
    }
  });
});

describe('the tiles workflow', () => {
  it('cuts exactly the padded play area the map allows', async () => {
    const { readFileSync } = await import('node:fs');
    const yml = readFileSync('.github/workflows/tiles.yml', 'utf8');
    const bbox = /BBOX: '([^']+)'/.exec(yml)?.[1]?.split(',').map(Number);
    const expected = paddedBounds(CITIES[0]!.extent);
    expect(bbox).toHaveLength(4);
    bbox!.forEach((v, i) => expect(v).toBeCloseTo(expected[i]!, 4));
  });
});
