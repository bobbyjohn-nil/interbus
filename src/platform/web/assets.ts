/** Absolute URL of a file shipped with this build, resolved against the page, so it works under /interbus/ and later app://. */
export function assetUrl(path: string, base: string = document.baseURI): string {
  return new URL(path, base).href;
}

/** A URL template prefix (for MapLibre's {fontstack}/{range} placeholders, which new URL() would escape). */
export function assetBase(base: string = document.baseURI): string {
  return new URL('./', base).href;
}

/**
 * Whether a file of this build is gone from the server: a 404 or 410 means a newer deploy replaced
 * the build after the retention window. Network errors count as present; they are not this.
 */
export async function assetGone(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    return res.status === 404 || res.status === 410;
  } catch {
    return false;
  }
}
