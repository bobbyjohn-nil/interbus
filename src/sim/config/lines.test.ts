// The line colours apart (PLAN §8: shape plus colour; UX-08's final form, the palette's ΔE as a unit test). For normal vision
// the eight colours stay at least 5.5 apart in OKLab (×100, where about 2 is the least difference seen). Under simulated
// colour blindness they fall as close as 2.0, which no palette of eight avoids; so a line is never told by its colour alone:
// its name runs along its route (overlays.ts, lines-name), and the panels name it beside its swatch.
import { describe, expect, it } from 'vitest';
import { LINE_COLOURS } from './lines';

type Vec = readonly [number, number, number];

/** Full-severity simulations in linear RGB: Machado, Oliveira and Fernandes, "A Physiologically-based Model for Simulation of Color Vision Deficiency" (2009). */
const SIGHT: Record<string, readonly Vec[]> = {
  normal: [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ],
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};

const linear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const rgb = (hex: string): Vec => [1, 3, 5].map((i) => linear(parseInt(hex.slice(i, i + 2), 16) / 255)) as unknown as Vec;
const seen = (m: readonly Vec[], v: Vec): Vec => m.map((r) => Math.min(1, Math.max(0, r[0] * v[0] + r[1] * v[1] + r[2] * v[2]))) as unknown as Vec;
/** OKLab, from linear sRGB (Björn Ottosson's matrices, as oklch.ts). */
function oklab([r, g, b]: Vec): Vec {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}

/** The closest two line colours as `sight` sees them, in OKLab ×100. */
function closest(sight: readonly Vec[]): number {
  const lab = LINE_COLOURS.map((hex) => oklab(seen(sight, rgb(hex))));
  let least = Infinity;
  for (let i = 0; i < lab.length; i++) for (let j = i + 1; j < lab.length; j++) least = Math.min(least, 100 * Math.hypot(lab[i]![0] - lab[j]![0], lab[i]![1] - lab[j]![1], lab[i]![2] - lab[j]![2]));
  return least;
}

describe('the line colours', () => {
  it('stay apart for normal vision, and no closer than today under colour blindness, where the names tell lines apart', () => {
    expect(closest(SIGHT.normal!)).toBeGreaterThanOrEqual(5.5);
    // Measured 2026-10-22: protanopia 3.3, deuteranopia 4.3, tritanopia 2.0.
    expect(closest(SIGHT.protanopia!)).toBeGreaterThanOrEqual(3.2);
    expect(closest(SIGHT.deuteranopia!)).toBeGreaterThanOrEqual(4.2);
    expect(closest(SIGHT.tritanopia!)).toBeGreaterThanOrEqual(1.9);
  });
});
