// Census to cells (PLAN §5): 350 m squares on the city's grid, each with its residents (2020
// POP20), workers living there (LODES RAC), jobs by sector (LODES WAC), and up to 8 weighted
// sub-points for homes and 8 for jobs, so dots sit where people live and work and catchments sum
// sub-points, not a centroid (EC-15, WD-06). The grid starts at the extent's south-west corner, so
// the fixture's cells are Boston's cells. Integer output: positions in decimetres.

/** Sub-points per cell, for homes and for jobs each (PLAN §5). */
export const MAX_POINTS = 8;
export const SECTORS = 20; // LODES CNS01–CNS20 (NAICS supersectors)

/**
 * Up to `k` weighted points summarising `items` ({x, y, w, key}), deterministically: seeds are the
 * heaviest items (ties by key), then three rounds of nearest-centre assignment and weighted means.
 */
export function cluster(items, k = MAX_POINTS) {
  const live = items.filter((it) => it.w > 0).sort((a, b) => b.w - a.w || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  if (live.length === 0) return [];
  let centres = live.slice(0, k).map((it) => [it.x, it.y]);
  let groups = [];
  for (let round = 0; round < 3; round++) {
    groups = centres.map(() => []);
    for (const it of live) {
      let best = 0;
      let bestD = Infinity;
      centres.forEach(([cx, cy], c) => {
        const d = (it.x - cx) ** 2 + (it.y - cy) ** 2;
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      });
      groups[best].push(it);
    }
    groups = groups.filter((g) => g.length > 0);
    centres = groups.map((g) => {
      const w = g.reduce((s, it) => s + it.w, 0);
      return [g.reduce((s, it) => s + it.x * it.w, 0) / w, g.reduce((s, it) => s + it.y * it.w, 0) / w];
    });
  }
  return groups
    .map((g, c) => ({ x: Math.round(centres[c][0] * 10), y: Math.round(centres[c][1] * 10), w: g.reduce((s, it) => s + it.w, 0) }))
    .sort((a, b) => b.w - a.w || a.x - b.x || a.y - b.y);
}

/**
 * blocks: [{geoid, lon, lat, pop20}]; rac: Map geoid → workers; wac: Map geoid → {jobs, sectors[20]}.
 * Returns cells sorted by (j, i), only those holding residents, workers or jobs.
 */
export function buildCells({ blocks, rac, wac, frame, cellMetres }) {
  const toXY = (lon, lat) => [(lon - frame.origin[0]) * frame.metresPerDegLon, (lat - frame.origin[1]) * frame.metresPerDegLat];
  const cells = new Map();
  const cellOf = (x, y) => {
    const i = Math.floor(x / cellMetres);
    const j = Math.floor(y / cellMetres);
    const key = `${j}:${i}`;
    if (!cells.has(key)) cells.set(key, { i, j, residents: 0, workers: 0, jobs: 0, sectors: new Array(SECTORS).fill(0), homes: [], work: [] });
    return cells.get(key);
  };
  for (const b of [...blocks].sort((x, y) => (x.geoid < y.geoid ? -1 : 1))) {
    const workers = rac.get(b.geoid) ?? 0;
    const job = wac.get(b.geoid);
    if (b.pop20 === 0 && workers === 0 && !job) continue;
    const [x, y] = toXY(b.lon, b.lat);
    const cell = cellOf(x, y);
    cell.residents += b.pop20;
    cell.workers += workers;
    if (b.pop20 > 0) cell.homes.push({ x, y, w: b.pop20, key: b.geoid });
    if (job) {
      cell.jobs += job.jobs;
      job.sectors.forEach((n, s) => (cell.sectors[s] += n));
      if (job.jobs > 0) cell.work.push({ x, y, w: job.jobs, key: b.geoid });
    }
  }
  return [...cells.values()]
    .sort((a, b) => a.j - b.j || a.i - b.i)
    .map((c) => ({
      i: c.i,
      j: c.j,
      residents: c.residents,
      workers: c.workers,
      jobs: c.jobs,
      sectors: c.sectors,
      homes: cluster(c.homes),
      work: cluster(c.work),
    }));
}

/** Reads the fixture's LODES RAC and WAC CSVs into the maps buildCells takes. */
export function readLodes(racText, wacText) {
  const rows = (text) => {
    const [head, ...rest] = text.trim().split('\n');
    const keys = head.split(',');
    return rest.map((line) => Object.fromEntries(line.split(',').map((v, i) => [keys[i], v])));
  };
  const rac = new Map(rows(racText).map((r) => [r.h_geocode, Number(r.C000)]));
  const wac = new Map(
    rows(wacText).map((r) => [
      r.w_geocode,
      { jobs: Number(r.C000), sectors: Array.from({ length: SECTORS }, (_, s) => Number(r[`CNS${String(s + 1).padStart(2, '0')}`])) },
    ]),
  );
  return { rac, wac };
}
