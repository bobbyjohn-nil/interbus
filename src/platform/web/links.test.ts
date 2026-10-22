import { describe, expect, it } from 'vitest';
import { ALLOWED_LINKS, externalLink, OWN_FILES, ownFile } from './links';

describe('external links', () => {
  it('opens allowlisted links in a new tab without an opener', () => {
    for (const url of ALLOWED_LINKS) expect(externalLink(url)).toEqual({ href: url, target: '_blank', rel: 'noopener noreferrer' });
  });
  it('refuses anything else', () => {
    expect(() => externalLink('https://example.com/')).toThrow(/allowlist/);
  });
  it('opens the files the build ships beside itself, relative to the page, and no others', () => {
    for (const path of OWN_FILES) expect(ownFile(path)).toEqual({ href: path, target: '_blank', rel: 'noopener noreferrer' });
    expect(() => ownFile('index.html')).toThrow(/own file/);
  });
});
