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
