// Types for the parts of sim.mjs the sim's tests call: they bake the fixture in-process rather than
// read a file a previous step may not have written.
export interface Frame {
  origin: [number, number];
  metresPerDegLon: number;
  metresPerDegLat: number;
}
export function cityFrame(extent: readonly [number, number, number, number]): Frame;
export function bakeSim(cityId: string, extentId: string): { text: string; sha256: string; report: Record<string, unknown> };
