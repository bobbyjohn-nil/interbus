// Where every bus is drawn at a given moment: each line's day plan and geometry, prepared once per
// change of lines, and the game clock run on between snapshots at the speed the sim runs. Pure
// apart from its caches; the numbers come from sim/rules (busPositionsAt), the same plan the costs
// bill (I6). The renderer computes no sim number (AR-04), only where to draw.
import { busPositionsAt, prepareGeometry, type PreparedGeometry } from '../../sim/rules/position';
import { busesOut, dayPlan, type DayPlan } from '../../sim/rules/schedule';
import type { LineView } from '../../sim/types';

const SECONDS_PER_DAY = 86_400;

/** Floats per bus in a frame: lon, lat, heading (degrees), red, green, blue (0–1). */
export const BUS_FLOATS = 6;

interface Prepared {
  readonly plan: DayPlan;
  readonly geo: PreparedGeometry;
  readonly colour: readonly [number, number, number];
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
  private clock = { second: 0, rate: 0, atMs: 0 };

  /** Rebuilds the plans when the lines change: never per frame. */
  setLines(lines: readonly LineView[]): void {
    this.lines = lines
      .filter((l) => l.stopAt.length >= 2 && l.plan.timing.buses > 0)
      .map((l) => ({ plan: dayPlan(l.plan), geo: prepareGeometry(l), colour: rgb(l.colour) }));
    const most = this.lines.reduce((n, l) => Math.max(n, busesOut(l.plan)), 0);
    const total = this.lines.reduce((n, l) => n + busesOut(l.plan), 0);
    this.scratch = new Float64Array(3 * Math.max(1, most));
    this.frameData = new Float64Array(BUS_FLOATS * Math.max(1, total));
  }

  /** The sim's clock at a snapshot: seconds of the day, and game seconds per real second (0 paused). */
  setClock(second: number, rate: number, atMs: number): void {
    this.clock = { second, rate, atMs };
  }

  get running(): boolean {
    return this.clock.rate > 0 && this.lines.length > 0;
  }

  /** The clock now, run on from the last snapshot by at most a quarter-second of real time. */
  secondAt(nowMs: number): number {
    const ahead = Math.min(Math.max(nowMs - this.clock.atMs, 0), 250) / 1000;
    return (this.clock.second + ahead * this.clock.rate) % SECONDS_PER_DAY;
  }

  /** Every bus at `nowMs`: a view of BUS_FLOATS numbers per bus, valid until the next call. */
  frame(nowMs: number): { count: number; data: Float64Array } {
    const second = this.secondAt(nowMs);
    let count = 0;
    for (const line of this.lines) {
      const n = busPositionsAt(line.plan, line.geo, second, this.scratch);
      for (let i = 0; i < n; i++) {
        const at = BUS_FLOATS * count++;
        const d = this.frameData;
        d[at] = this.scratch[3 * i]!;
        d[at + 1] = this.scratch[3 * i + 1]!;
        d[at + 2] = this.scratch[3 * i + 2]!;
        d[at + 3] = line.colour[0];
        d[at + 4] = line.colour[1];
        d[at + 5] = line.colour[2];
      }
    }
    return { count, data: this.frameData };
  }
}
