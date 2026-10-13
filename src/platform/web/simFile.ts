// The sim's side of a city: its sim.json, read as text for the worker, and the worker itself. A file
// or worker gone because a newer deploy replaced this build shows the replaced-build card.
import simWorkerUrl from '../../worker/sim.worker.ts?worker&url';
import { assetGone, assetUrl } from './assets';
import { reportReplaced } from './replaced';

export async function readSimFile(file: string): Promise<string> {
  const url = assetUrl(`cities/${file}`);
  const res = await fetch(url);
  if (res.status === 404) {
    reportReplaced('city-file');
    throw new Error(`sim file gone: ${url}`);
  }
  if (!res.ok) throw new Error(`sim file: HTTP ${res.status} for ${url}`);
  return res.text();
}

export async function startSimWorker(): Promise<Worker> {
  // A module worker that fails to load only logs; check it exists first (as loadMap does for MapLibre's).
  if (await assetGone(simWorkerUrl)) {
    reportReplaced('worker');
    throw new Error('sim worker gone');
  }
  return new Worker(simWorkerUrl, { type: 'module' });
}
