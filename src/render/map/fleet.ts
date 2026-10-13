// Where every bus is drawn at a given moment: each line's day plan and geometry, prepared once per
// change of lines, and the game clock run on between snapshots at the speed the sim runs. Pure
// apart from its caches; the numbers come from sim/rules (positionsInEffect), the same plan the costs
// bill (I6), a line settling after a change on its merged plan (rules/transition.ts). The renderer
// computes no sim number (AR-04), only where to draw.
import { mostOut, positionsInEffect, prepareGeometry, type PreparedGeometry } from '../../sim/rules/position';
import { planInEffect, type PlanInEffect } from '../../sim/rules/transition';
import type { LineView } from '../../sim/types';
import { MODEL_GLYPHS } from './glyphs';

const SECONDS_PER_DAY = 86_400;

/** Floats per bus in a frame: lon, lat, heading (degrees), red, green, blue (0–1), and the glyph's length and width in CSS pixels. */
export const BUS_FLOATS = 8;

interface Prepared {
  readonly plan: PlanInEffect;
  /** Each version's geometry, oldest first, the line's own last. */
  readonly geos: readonly PreparedGeometry[];
  /** The game day its merged plan's frame counts from, or null with none. */
  readonly frameDay: number | null;
  readonly colour: readonly [number, number, number];
  readonly glyph: { readonly lengthPx: number; readonly widthPx: number };
}

function rgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** What the vehicle layer draws from: buses at a moment, and whether it should keep asking for frames. */
export interface BusSource {
  frame(nowMs: number): { count: number; data: ArrayLike<number> };
  readonly running: boolean;
}

export class Fleet implements BusSource {
  private lines: Prepared[] = [];
  private scratch = new Float64Array(0);
  private frameData = new Float64Array(0);
  private clock = { second: 0, rate: 0, atMs: 0, day: 0 };

  /** Rebuilds the plans when the lines change: never per frame. */
  setLines(lines: readonly LineView[]): void {
    this.lines = lines
      .filter((l) => l.stopAt.length >= 2 && l.plan.timing.buses > 0)
      .map((l) => {
        const earlier = l.settling?.earlier ?? [];
        return {
          plan: planInEffect(l.plan, earlier.map((e) => ({ inputs: e.plan, until: e.until, sameModel: e.sameModel, sameStart: e.sameStart }))),
          geos: [...earlier.map((e) => prepareGeometry(e)), prepareGeometry(l)],
          frameDay: l.settling?.frameDay ?? null,
          colour: rgb(l.colour),
          glyph: MODEL_GLYPHS[l.model],
        };
      });
    const most = this.lines.reduce((n, l) => Math.max(n, mostOut(l.plan)), 0);
    const total = this.lines.reduce((n, l) => n + mostOut(l.plan), 0);
    this.scratch = new Float64Array(3 * Math.max(1, most));
    this.frameData = new Float64Array(BUS_FLOATS * Math.max(1, total));
  }

  /** The sim's clock at a snapshot: seconds of the day, game seconds per real second (0 paused), and the game day. */
  setClock(second: number, rate: number, atMs: number, day = 0): void {
    this.clock = { second, rate, atMs, day };
  }

  get running(): boolean {
    return this.clock.rate > 0 && this.lines.length > 0;
  }

  /** The clock now in game seconds since the first day's midnight, run on from the last snapshot by at most a quarter-second of real time. */
  private absoluteAt(nowMs: number): number {
    const ahead = Math.min(Math.max(nowMs - this.clock.atMs, 0), 250) / 1000;
    return this.clock.day * SECONDS_PER_DAY + this.clock.second + ahead * this.clock.rate;
  }

  /** The clock now: its second of the day. */
  secondAt(nowMs: number): number {
    return this.absoluteAt(nowMs) % SECONDS_PER_DAY;
  }

  /** Every bus at `nowMs`: a view of BUS_FLOATS numbers per bus, valid until the next call. */
  frame(nowMs: number): { count: number; data: Float64Array } {
    const absolute = this.absoluteAt(nowMs);
    const second = absolute % SECONDS_PER_DAY;
    let count = 0;
    for (const line of this.lines) {
      const at = line.frameDay === null ? second : absolute - line.frameDay * SECONDS_PER_DAY;
      const n = positionsInEffect(line.plan, line.geos, at, this.scratch);
      for (let i = 0; i < n; i++) {
        const at = BUS_FLOATS * count++;
        const d = this.frameData;
        d[at] = this.scratch[3 * i]!;
        d[at + 1] = this.scratch[3 * i + 1]!;
        d[at + 2] = this.scratch[3 * i + 2]!;
        d[at + 3] = line.colour[0];
        d[at + 4] = line.colour[1];
        d[at + 5] = line.colour[2];
        d[at + 6] = line.glyph.lengthPx;
        d[at + 7] = line.glyph.widthPx;
      }
    }
    return { count, data: this.frameData };
  }
}
