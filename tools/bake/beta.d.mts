// Types for tools/bake/beta.mjs, which the sim's tests import (src/sim/demand/beta.test.ts).
export interface BakeCell {
  readonly workers: number;
  readonly jobs: number;
  /** Sub-points in decimetres, as sim.json holds them. */
  readonly homes: readonly { readonly x: number; readonly y: number; readonly w: number }[];
  readonly work: readonly { readonly x: number; readonly y: number; readonly w: number }[];
}
export const CUTOFF_KM: number;
export function cellKm(cells: readonly BakeCell[]): Float64Array;
export function modelMeanKm(cells: readonly BakeCell[], km: Float64Array, betaM: number): number;
export function observedMeanKm(cells: readonly BakeCell[], km: Float64Array, pairs: readonly (readonly [number, number, number])[]): number;
export function fitBeta(cells: readonly BakeCell[], pairs: readonly (readonly [number, number, number])[]): { betaM: number; observedKm: number; km: Float64Array };
