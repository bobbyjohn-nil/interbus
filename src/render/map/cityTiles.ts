import { FetchSource, type RangeResponse } from 'pmtiles';
import { reportReplaced } from '../../platform';

/**
 * Reads a city's tiles by HTTP Range. A 404 or 410 means a newer deploy replaced this build's city
 * file after the retention window (CLAUDE.md deploy gate 6), so it raises the replaced-build card.
 * pmtiles reports a bad response only as `Error("Bad response code: 404")`, with no status field.
 */
export class CityFetchSource extends FetchSource {
  override async getBytes(offset: number, length: number, signal?: AbortSignal, etag?: string): Promise<RangeResponse> {
    try {
      return await super.getBytes(offset, length, signal, etag);
    } catch (error) {
      if (isGone(error)) reportReplaced('city-file');
      throw error;
    }
  }
}

export function isGone(error: unknown): boolean {
  return error instanceof Error && /\bBad response code: (404|410)\b/.test(error.message);
}
