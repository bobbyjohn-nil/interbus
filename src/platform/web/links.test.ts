import { describe, expect, it } from 'vitest';
import { ALLOWED_LINKS, externalLink } from './links';

describe('external links', () => {
  it('opens allowlisted links in a new tab without an opener', () => {
    for (const url of ALLOWED_LINKS) expect(externalLink(url)).toEqual({ href: url, target: '_blank', rel: 'noopener noreferrer' });
  });
  it('refuses anything else', () => {
    expect(() => externalLink('https://example.com/')).toThrow(/allowlist/);
  });
});
