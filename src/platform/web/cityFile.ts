// Reads a city's tile file from this build (PLAN §6 "City files"). Range requests where the host
// serves them; otherwise the whole file once. No Cache Storage copy on the web preview (D12).
import { assetUrl } from './assets';
import { reportReplaced } from './replaced';

export type CityFile =
  | { readonly kind: 'range'; readonly url: string }
  | { readonly kind: 'whole'; readonly url: string; readonly blob: Blob };

export async function openCityFile(path: string): Promise<CityFile> {
  const url = assetUrl(path);
  const probe = await fetch(url, { headers: { Range: 'bytes=0-511' } });
  if (probe.status === 404) {
    // The deploy refuses to publish a build without its city files, so a 404 here means a newer
    // deploy replaced this one after the retention window (CLAUDE.md deploy gate 6).
    reportReplaced('city-file');
    throw new Error(`city file gone: ${url}`);
  }
  if (probe.status === 206) {
    await probe.body?.cancel();
    return { kind: 'range', url };
  }
  if (probe.ok) return { kind: 'whole', url, blob: await probe.blob() };
  throw new Error(`city file: HTTP ${probe.status} for ${url}`);
}
