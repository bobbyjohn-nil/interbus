import { build, externalLink } from '../platform';

/** OSM attribution and the build chip share the bottom-right corner (CLAUDE.md "The build chip"). */
export function Corner() {
  return (
    <footer className="corner" data-chrome="rest">
      <a {...externalLink('https://www.openstreetmap.org/copyright')}>© OpenStreetMap contributors</a>
      <span aria-hidden="true">·</span>
      <a {...externalLink('https://protomaps.com/')}>Protomaps</a>
      <span
        className="build-chip"
        data-testid="build-chip"
        data-sha={build.sha}
        title={`Build ${build.sha}, version ${build.version}`}
      >
        build {build.shortSha}
      </span>
    </footer>
  );
}
