// What crosses between the sim worker and the page: the only sim module besides sim/rules that
// src/ui and src/render may import (CLAUDE.md "Architecture guardrails"). Plain data: anything here
// must survive structured cloning.

export type LngLatPair = [lon: number, lat: number];

/** Paused, then three speeds (worker/host.ts SPEEDS). */
export type Speed = 0 | 1 | 2 | 3;

export interface CityRefData {
  readonly id: string;
  readonly revision: string;
  readonly hash: string;
}

export interface LineView {
  readonly id: number;
  readonly name: string;
  readonly colour: string;
  readonly stops: readonly LngLatPair[];
  /** The streets it drives, stop to stop. */
  readonly route: readonly LngLatPair[];
  readonly ridersPerDay: number;
}

export interface Snapshot {
  /** Whole game-seconds since founding (05:00 on day 1). */
  readonly elapsed: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly speed: Speed;
  readonly cashCents: number;
  readonly ridersPerDay: number;
  readonly lines: readonly LineView[];
  /** Changes whenever `lines` does, so the map redraws them only then (RN-04). */
  readonly linesVersion: number;
}

/** Where people live and work: each cell's sub-points, weighted. */
export interface Dots {
  readonly homes: readonly [lon: number, lat: number, people: number][];
  readonly jobs: readonly [lon: number, lat: number, jobs: number][];
}

export interface DayCard {
  readonly day: number;
  readonly rows: readonly { readonly kind: string; readonly amountCents: number; readonly lineId: number | null }[];
  readonly cashBeforeCents: number;
  readonly cashAfterCents: number;
}

export type ToWorker =
  | { readonly type: 'init'; readonly simText: string; readonly city: CityRefData; readonly seed: number }
  | { readonly type: 'speed'; readonly speed: Speed }
  | { readonly type: 'add-debug-line' }
  | { readonly type: 'probe'; readonly id: number; readonly at: LngLatPair };

export type FromWorker =
  | { readonly type: 'ready'; readonly dots: Dots; readonly snapshot: Snapshot }
  | { readonly type: 'snapshot'; readonly snapshot: Snapshot }
  | { readonly type: 'day-card'; readonly card: DayCard }
  | { readonly type: 'probe'; readonly id: number; readonly people: number }
  | { readonly type: 'refused'; readonly command: string; readonly reason: string }
  | { readonly type: 'failed'; readonly problem: string };
