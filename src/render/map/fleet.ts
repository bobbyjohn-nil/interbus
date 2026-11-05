// Where every bus is drawn at a given moment: each line's day plan and geometry, prepared once per
// change of lines, and the game clock run on between snapshots at the speed the sim runs. Pure
// apart from its caches; the numbers come from sim/rules (positionsInEffect), the same plan the costs
// bill (I6), a line settling after a change on its merged plan (rules/transition.ts). The renderer
// computes no sim number (AR-04), only where to draw.
import { inServiceAt, mostOut, positionsInEffect, prepareGeometry, WHERE_FLOATS, type PreparedGeometry } from '../../sim/rules/position';
import { planInEffect, type PlanInEffect } from '../../sim/rules/transition';
import type { LineView } from '../../sim/types';
import { MODEL_GLYPHS } from './glyphs';
import { placesOf, sidesAlong, type Places } from './sides';

const SECONDS_PER_DAY = 86_400;

/**
 * Floats per bus in a frame: lon, lat, heading (degrees), red, green, blue (0–1), the glyph's length and width in CSS pixels, and
 * its side: its line's place on the street, in ribbon widths to the right of the way the bus drives (sides.ts), so it rides on
 * its line's ribbon where lines share a street.
 */
export const BUS_FLOATS = 9;

interface Prepared {
  readonly id: number;
  readonly plan: PlanInEffect;
  /** Each version's geometry, oldest first, the line's own last. */
  readonly geos: readonly PreparedGeometry[];
  /** The game day its merged plan's frame counts from, or null with none. */
  readonly frameDay: number | null;
  readonly colour: readonly [number, number, number];
  readonly glyph: { readonly lengthPx: number; readonly widthPx: number };
  /** Each version's sides along its route, as the line's ribbon stands on each segment now (sides.ts). */
  readonly sides: readonly Float32Array[];
}

/** A line's second at `absolute` (game seconds since the first day's midnight): of the day, or of its merged plan's frame. */
const secondOf = (line: Prepared, absolute: number) => (line.frameDay === null ? absolute % SECONDS_PER_DAY : absolute - line.frameDay * SECONDS_PER_DAY);

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
  private where = new Float64Array(0);
  private frameData = new Float64Array(0);
  private clock = { second: 0, rate: 0, atMs: 0, day: 0 };
  /** How many buses the last frame drew. */
  private drawn = 0;
  /** The earlier versions of the lines' routes a bus drove at the last frame, as `id:version,version;` per line (onEarlier). */
  private earlierKey = '';
  private earlier: readonly { readonly id: number; readonly version: number }[] = [];

  /**
   * Rebuilds the plans when the lines change: never per frame. `places` stands the lines on their streets (sides.ts), or null to
   * leave them in the street's middle until setPlaces stands them, so the sides are not worked out twice (#202's review: 11.7 to
   * 18.0 ms a change on the late game, at every change).
   */
  setLines(lines: readonly LineView[], places: Places | null = placesOf(lines)): void {
    this.lines = lines
      .filter((l) => l.stopAt.length >= 2 && l.plan.timing.buses > 0)
      .map((l) => {
        const earlier = l.settling?.earlier ?? [];
        const geos = [...earlier.map((e) => prepareGeometry(e)), prepareGeometry(l)];
        return {
          id: l.id,
          plan: planInEffect(l.plan, earlier.map((e) => ({ inputs: e.plan, until: e.until, sameModel: e.sameModel, sameStart: e.sameStart }))),
          geos,
          frameDay: l.settling?.frameDay ?? null,
          colour: rgb(l.colour),
          glyph: MODEL_GLYPHS[l.model],
          sides: places ? geos.map((g) => sidesAlong(places, l.id, g.geometry.route)) : [],
        };
      });
    const most = this.lines.reduce((n, l) => Math.max(n, mostOut(l.plan)), 0);
    const total = this.lines.reduce((n, l) => n + mostOut(l.plan), 0);
    this.scratch = new Float64Array(3 * Math.max(1, most));
    this.where = new Float64Array(WHERE_FLOATS * Math.max(1, most));
    this.frameData = new Float64Array(BUS_FLOATS * Math.max(1, total));
    // Which bus is out, and on which version of its route, by the clock: for running, and for onEarlier.
    this.drawn = this.frame(this.clock.atMs).count;
  }

  /**
   * Stands the lines on their streets again (`places`, sides.ts), each version's sides along its own route: as a bus of a settling
   * line leaves or takes its line's earlier route (onEarlier, loadMap.ts), and the lines it shared streets with stand back in place.
   */
  setPlaces(places: Places): void {
    this.lines = this.lines.map((l) => ({ ...l, sides: l.geos.map((g) => sidesAlong(places, l.id, g.geometry.route)) }));
  }

  /**
   * The earlier versions of the lines' routes some bus drove at the last frame, or the last snapshot: a settling line's route as it
   * was before a change, while one of its buses still drives it (positionsInEffect), its index in the line's `settling.earlier`.
   * `onEarlierKey` changes exactly as they do.
   */
  get onEarlier(): readonly { readonly id: number; readonly version: number }[] {
    return this.earlier;
  }

  get onEarlierKey(): string {
    return this.earlierKey;
  }

  /** The sim's clock at a snapshot: seconds of the day, game seconds per real second (0 paused), and the game day. */
  setClock(second: number, rate: number, atMs: number, day = 0): void {
    this.clock = { second, rate, atMs, day };
    // Which bus is out, and on which version of its route, by this clock: for running, and for onEarlier, paused too, as after a
    // load. Each frame between snapshots keeps them so.
    this.frame(atMs);
  }

  /**
   * Whether line `id` has a bus in service at the last snapshot's clock (inServiceAt): one still on a trip begun before its period
   * stopped, as drawn. A line with no plan here (no buses, or under two stops) has none.
   */
  inService(id: number): boolean {
    const line = this.lines.find((l) => l.id === id);
    return line ? inServiceAt(line.plan, secondOf(line, this.clock.day * SECONDS_PER_DAY + this.clock.second)) : false;
  }

  /**
   * Whether the layer keeps asking for frames: time runs and a bus is drawn, by the last frame or the last snapshot's clock, or
   * since the lines last changed. With every bus parked, overnight off or before the day's first bus, nothing on the map moves, so
   * it asks for none: kept asking whenever a line existed, it drew 25–28 frames a second of nothing new in a small window (the
   * systems audit's twenty-first round). A snapshot that finds a bus out starts it again (loadMap.ts setClock).
   */
  get running(): boolean {
    return this.clock.rate > 0 && this.drawn > 0;
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
    let count = 0;
    let key = '';
    for (const line of this.lines) {
      const n = positionsInEffect(line.plan, line.geos, secondOf(line, absolute), this.scratch, this.where);
      // Its route's earlier versions some bus of it drives: only a line settling onto a change has any. A bus on its drive to or
      // from its depot (segment -1) drives none: home from its last trip on an earlier route, it held that route's place among the
      // lines until it was home, an empty place beside the lines on its streets for 130 to 310 game seconds after changes made from
      // 23:15 to 23:45 (the systems audit's twenty-second round).
      if (line.geos.length > 1) {
        const versions = new Set<number>();
        for (let i = 0; i < n; i++) if (this.where[WHERE_FLOATS * i]! < line.geos.length - 1 && this.where[WHERE_FLOATS * i + 1]! >= 0) versions.add(this.where[WHERE_FLOATS * i]!);
        if (versions.size) key += `${line.id}:${[...versions].sort((a, b) => a - b).join(',')};`;
      }
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
        // Its line's place on the segment it drives, to the right of the way it drives: driving back, the other side of the route's.
        const segment = this.where[WHERE_FLOATS * i + 1]!;
        const side = segment >= 0 ? (line.sides[this.where[WHERE_FLOATS * i]!]?.[segment] ?? 0) : 0;
        d[at + 8] = this.where[WHERE_FLOATS * i + 2] && side ? -side : side;
      }
    }
    this.drawn = count;
    if (key !== this.earlierKey) {
      this.earlierKey = key;
      this.earlier = key
        .split(';')
        .filter(Boolean)
        .flatMap((part) => {
          const [id, versions] = part.split(':');
          return versions!.split(',').map((v) => ({ id: Number(id), version: Number(v) }));
        });
    }
    return { count, data: this.frameData };
  }
}
