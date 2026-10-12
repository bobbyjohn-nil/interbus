/** Absolute URL of a file shipped with this build, resolved against the page, so it works under /interbus/ and later app://. */
export function assetUrl(path: string, base: string = document.baseURI): string {
  return new URL(path, base).href;
}

/** A URL template prefix (for MapLibre's {fontstack}/{range} placeholders, which new URL() would escape). */
export function assetBase(base: string = document.baseURI): string {
  return new URL('./', base).href;
}
