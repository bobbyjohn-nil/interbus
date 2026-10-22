// External links leave the game only through here, so the desktop build can route them to the
// system browser and refuse anything else (PLAN §6 "Platform seams").
export const ALLOWED_LINKS: readonly string[] = ['https://www.openstreetmap.org/copyright', 'https://protomaps.com/', 'https://overturemaps.org/'];

export interface ExternalLinkProps {
  readonly href: string;
  readonly target: '_blank';
  readonly rel: 'noopener noreferrer';
}

export function externalLink(url: string): ExternalLinkProps {
  if (!ALLOWED_LINKS.includes(url)) throw new Error(`external link not on the allowlist: ${url}`);
  return { href: url, target: '_blank', rel: 'noopener noreferrer' };
}

/** The files this build ships beside itself that a page may open: the font's licence and the packages' (LICENSE-DATA.md). */
export const OWN_FILES: readonly string[] = ['fonts/OFL.txt', 'THIRD_PARTY_NOTICES.txt'];

/**
 * One of this build's own files, opened in a tab of its own as an external link is, never in place of the game: its href is
 * relative, so it resolves under /interbus/ and, in the desktop build, under app://, which will need a route of its own there,
 * since the system browser, where the allowlist's links go, cannot open an app:// file.
 */
export function ownFile(path: string): ExternalLinkProps {
  if (!OWN_FILES.includes(path)) throw new Error(`own file not on the list: ${path}`);
  return { href: path, target: '_blank', rel: 'noopener noreferrer' };
}
