// Reads a city's sim.json (format 1, written by tools/bake/sim.mjs) into the City the sim runs on.
// One path for the game and the tests (V2's finalise was the one constructor, S12). Strict, like
// saves: a file that is not exactly format 1 is refused with the problem named, never repaired at
// load (PLAN §5: a missing or broken pack is a readable refusal, never a substitute city).
import type { Frame } from '../core/geo';
import { ok, refuse, type Result } from '../core/result';
import { buildGraph, labelComponents, type Graph } from './graph';

export const SIM_FORMAT = 1;
export const SECTORS = 20;

/** A weighted point in a cell, in the frame's metres: where some of its people live, or work. */
export interface SubPoint {
  readonly x: number;
  readonly y: number;
  readonly w: number;
}

export interface Cell {
  /** Column and row on the city's grid, from the extent's south-west corner. */
  readonly i: number;
  readonly j: number;
  readonly residents: number;
  readonly workers: number;
  readonly jobs: number;
  /** Jobs by LODES sector, CNS01–CNS20. */
  readonly sectors: readonly number[];
  readonly homes: readonly SubPoint[];
  readonly work: readonly SubPoint[];
}

export interface Street {
  readonly cls: string;
  readonly name: string;
  readonly oneway: -1 | 0 | 1;
  /** The street's line in the frame's metres, end to end. */
  readonly points: readonly (readonly [number, number])[];
}

/** Where people from beyond the play area come in: a road entry or the airport (PLAN §5). */
export interface Gateway {
  readonly name: string;
  readonly kind: 'road' | 'airport';
  /** The street node it joins the graph at. */
  readonly node: number;
  /** Commuters who enter here, by the cell they work in; demand reads them with visitors (week 5). */
  readonly inbound: readonly { readonly cell: number; readonly people: number }[];
}

/** A named place contracts are offered near (the M3 spec, item 1), in the frame's metres. */
export interface Landmark {
  readonly name: string;
  readonly at: readonly [number, number];
}

export interface City {
  readonly id: string;
  readonly extent: string;
  readonly frame: Frame;
  readonly cellMetres: number;
  readonly graph: Graph;
  /** Edge i of the graph is street i. */
  readonly streets: readonly Street[];
  readonly cells: readonly Cell[];
  /** demand × tripScalePermille / 1000 (PLAN §3: prices stay V1's, demand scales). */
  readonly tripScalePermille: number;
  readonly gateways: readonly Gateway[];
  /** Land a depot may stand on: industrial areas, as rings in the frame's metres (PLAN §3). */
  readonly depotLand: readonly (readonly (readonly [number, number])[])[];
  readonly landmarks: readonly Landmark[];
}

export type SimFileRefusal = 'not_json' | 'wrong_format' | 'malformed';

const isInt = (v: unknown): v is number => Number.isSafeInteger(v);
const ints = (v: unknown, length?: number): v is number[] =>
  Array.isArray(v) && v.every(isInt) && (length === undefined || v.length === length);

/** Sub-points per cell for homes and for jobs, at most (PLAN §5); demand keeps each side's sets in an 8-bit mask. */
export const MAX_SUB_POINTS = 8;

function points(flat: number[], what: string): SubPoint[] {
  if (flat.length % 3 !== 0) throw new Error(`${what}: not x, y, weight triples`);
  if (flat.length / 3 > MAX_SUB_POINTS) throw new Error(`${what}: ${flat.length / 3} points, more than ${MAX_SUB_POINTS}`);
  const out: SubPoint[] = [];
  for (let k = 0; k < flat.length; k += 3) out.push({ x: flat[k]! / 10, y: flat[k + 1]! / 10, w: flat[k + 2]! });
  return out;
}

function parse(data: Record<string, unknown>): City {
  const { frame, nodes, edges, cells, classes, names, calib } = data;
  const f = (frame ?? {}) as { origin?: unknown; metresPerDegLon?: unknown; metresPerDegLat?: unknown };
  const origin = f?.origin as unknown[] | undefined;
  if (!Array.isArray(origin) || origin.length !== 2 || !origin.every(Number.isFinite) || !(Number(f.metresPerDegLon) > 0) || !(Number(f.metresPerDegLat) > 0)) {
    throw new Error('frame: not an origin and two scales');
  }
  if (typeof data.city !== 'string' || typeof data.extent !== 'string') throw new Error('city and extent: not names');
  if (!isInt(data.cellMetres) || (data.cellMetres as number) <= 0) throw new Error('cellMetres: not a whole number of metres');
  if (!Array.isArray(classes) || !Array.isArray(names) || ![...(classes as unknown[]), ...(names as unknown[])].every((s) => typeof s === 'string')) {
    throw new Error('classes and names: not lists of text');
  }
  if (!ints(nodes) || (nodes as number[]).length % 2 !== 0) throw new Error('nodes: not x, y pairs of whole decimetres');
  const xy = nodes as number[];
  const nodeList: [number, number][] = [];
  for (let k = 0; k < xy.length; k += 2) nodeList.push([xy[k]! / 10, xy[k + 1]! / 10]);
  if (!Array.isArray(edges)) throw new Error('edges: not a list');
  const streets: Street[] = [];
  const edgeInputs = (edges as unknown[]).map((e, i) => {
    if (!Array.isArray(e) || e.length !== 8 || !ints(e.slice(0, 7)) || !ints(e[7])) throw new Error(`edges[${i}]: not [a, b, dm, cs, oneway, class, name, points]`);
    const [a, b, dm, cs, rawOneway, cls, name, inner] = e as [number, number, number, number, number, number, number, number[]];
    if (rawOneway !== 0 && rawOneway !== 1 && rawOneway !== -1) throw new Error(`edges[${i}]: oneway ${rawOneway}`);
    const oneway: -1 | 0 | 1 = rawOneway;
    if (!(cls >= 0 && cls < (classes as string[]).length && name >= 0 && name < (names as string[]).length)) throw new Error(`edges[${i}]: class or name out of range`);
    if (inner.length % 2 !== 0) throw new Error(`edges[${i}]: points not in pairs`);
    if (!nodeList[a] || !nodeList[b]) throw new Error(`edges[${i}]: names a missing node`);
    const line: [number, number][] = [nodeList[a]!];
    for (let k = 0; k < inner.length; k += 2) line.push([inner[k]! / 10, inner[k + 1]! / 10]);
    line.push(nodeList[b]!);
    streets.push({ cls: (classes as string[])[cls]!, name: (names as string[])[name]!, oneway, points: line });
    return { a, b, dm, cs, oneway };
  });
  const graph = buildGraph(nodeList, edgeInputs);
  if (graph.nodeCount > 0 && labelComponents(graph).count !== 1) throw new Error('the street network is in more than one piece');

  if (!Array.isArray(cells)) throw new Error('cells: not a list');
  const cellList = (cells as Record<string, unknown>[]).map((c, n) => {
    const { i, j, residents, workers, jobs, sectors, homes, work } = c ?? {};
    if (![i, j, residents, workers, jobs].every(isInt) || !ints(sectors, SECTORS) || !ints(homes) || !ints(work)) throw new Error(`cells[${n}]: malformed`);
    const cell: Cell = { i: i as number, j: j as number, residents: residents as number, workers: workers as number, jobs: jobs as number, sectors: sectors as number[], homes: points(homes as number[], `cells[${n}].homes`), work: points(work as number[], `cells[${n}].work`) };
    if (cell.homes.reduce((s, p) => s + p.w, 0) !== cell.residents) throw new Error(`cells[${n}]: home points do not add up to its residents`);
    if (cell.work.reduce((s, p) => s + p.w, 0) !== cell.jobs) throw new Error(`cells[${n}]: job points do not add up to its jobs`);
    return cell;
  });
  const scale = (calib as { tripScalePermille?: unknown } | undefined)?.tripScalePermille;
  if (!isInt(scale) || scale <= 0) throw new Error('calib.tripScalePermille: not a positive whole number');

  if (!Array.isArray(data.gateways)) throw new Error('gateways: not a list');
  const gateways: Gateway[] = (data.gateways as Record<string, unknown>[]).map((g, n) => {
    const { name, kind, node, inbound } = g ?? {};
    if (typeof name !== 'string' || (kind !== 'road' && kind !== 'airport') || !isInt(node) || !nodeList[node] || !ints(inbound) || inbound.length % 2 !== 0) {
      throw new Error(`gateways[${n}]: not a name, a kind, a street node and cell, people pairs`);
    }
    const pairs: { cell: number; people: number }[] = [];
    for (let k = 0; k < inbound.length; k += 2) {
      const [cell, people] = [inbound[k]!, inbound[k + 1]!];
      if (!cellList[cell] || people <= 0) throw new Error(`gateways[${n}]: inbound names a missing cell or no one`);
      pairs.push({ cell, people });
    }
    return { name, kind, node, inbound: pairs };
  });
  if (!Array.isArray(data.depotLand)) throw new Error('depotLand: not a list');
  const depotLand = (data.depotLand as unknown[]).map((ring, n) => {
    if (!ints(ring) || ring.length % 2 !== 0 || ring.length < 6) throw new Error(`depotLand[${n}]: not a ring of three or more x, y pairs`);
    const pts: [number, number][] = [];
    for (let k = 0; k < ring.length; k += 2) pts.push([ring[k]! / 10, ring[k + 1]! / 10]);
    return pts;
  });

  if (!Array.isArray(data.landmarks)) throw new Error('landmarks: not a list');
  const landmarks: Landmark[] = (data.landmarks as Record<string, unknown>[]).map((l, n) => {
    const { name, x, y } = l ?? {};
    if (typeof name !== 'string' || name === '' || !isInt(x) || !isInt(y)) throw new Error(`landmarks[${n}]: not a name and an x, y`);
    return { name, at: [x / 10, y / 10] };
  });

  return {
    id: data.city as string,
    extent: data.extent as string,
    frame: { origin: [origin[0] as number, origin[1] as number], metresPerDegLon: Number(f.metresPerDegLon), metresPerDegLat: Number(f.metresPerDegLat) },
    cellMetres: data.cellMetres as number,
    graph,
    streets,
    cells: cellList,
    tripScalePermille: scale,
    gateways,
    depotLand,
    landmarks,
  };
}

export function loadCity(text: string): Result<{ city: City }, SimFileRefusal, { problem: string }> {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return refuse('not_json', { problem: 'not JSON' });
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return refuse('malformed', { problem: 'not an object' });
  const format = (data as { format?: unknown }).format;
  if (format !== SIM_FORMAT) return refuse('wrong_format', { problem: `format ${String(format)}, not ${SIM_FORMAT}` });
  try {
    return ok({ city: parse(data as Record<string, unknown>) });
  } catch (error) {
    return refuse('malformed', { problem: (error as Error).message });
  }
}
