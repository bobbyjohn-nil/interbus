// Colour measures for the palette tests (PLAN §8's rules; D13's token sets): how far apart two colours look, how readable one
// is on another, and what a translucent colour comes to over one beneath it. Imported only by tests.
import { hexToOklch } from './oklch';

/** OKLab distance between two colours (×100 is about one just-noticeable step). */
export function distance(x: string, y: string): number {
  const [p, q] = [hexToOklch(x), hexToOklch(y)];
  const ab = (c: { c: number; h: number }) => [c.c * Math.cos((c.h * Math.PI) / 180), c.c * Math.sin((c.h * Math.PI) / 180)];
  const [pa, pb] = ab(p);
  const [qa, qb] = ab(q);
  return Math.hypot(p.l - q.l, pa! - qa!, pb! - qb!);
}

/** WCAG 2's contrast ratio. */
export function contrast(x: string, y: string): number {
  const luminance = (hex: string) => {
    const n = Number.parseInt(hex.slice(1), 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
      const v = c / 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  };
  const [a, b] = [luminance(x), luminance(y)];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** `top` laid at `alpha` over `under`, as the screen blends it, each channel rounded. */
export function blend(top: string, alpha: number, under: string): string {
  const ch = (hex: string) => [16, 8, 0].map((shift) => (Number.parseInt(hex.slice(1), 16) >> shift) & 255);
  const [a, b] = [ch(top), ch(under)];
  return `#${a.map((c, i) => Math.round(alpha * c + (1 - alpha) * b[i]!).toString(16).padStart(2, '0')).join('')}`;
}
