// Each bus family's glyph on screen, in CSS pixels (PLAN §6's minimum lengths, held by I12 in
// e2e/i12.spec.ts), wider for the bigger buses. The fleet tags each bus with its line's, and the
// vehicle layer draws it that size at every camera.
import type { BusModelId } from '../../sim/types';

export const MODEL_GLYPHS: Readonly<Record<BusModelId, { readonly lengthPx: number; readonly widthPx: number }>> = {
  sparrow: { lengthPx: 20, widthPx: 9 },
  metro40: { lengthPx: 24, widthPx: 9 },
  goliath: { lengthPx: 32, widthPx: 10 },
};
export const SPARROW_GLYPH = MODEL_GLYPHS.sparrow;
