import { build, externalLink } from '../platform';

/** OSM attribution and the build chip share the bottom-right corner (CLAUDE.md "The build chip"). */
export function Corner() {
  return (
    <footer className="corner" data-chrome="rest">
      <a {...externalLink('https://www.openstreetmap.org/copyright')}>© OpenStreetMap contributors</a>
      <span aria-hidden="true">·</span>
      <a {...externalLink('https://protomaps.com/')}>Protomaps</a>
      <span aria-hidden="true">·</span>
      {/* Building heights (PLAN §5): Overture's buildings are ODbL, credited as below (DECISIONS, 2026-10-13). */}
      <a
        {...externalLink('https://overturemaps.org/')}
        title="Building heights from Overture Maps (ODbL): © OpenStreetMap contributors, Microsoft, Esri Community Maps contributors, Google Open Buildings"
      >
        Overture Maps
      </a>
      <span
        className="build-chip"
        data-testid="build-chip"
        data-sha={build.sha}
        title={`Build ${build.sha}, version ${build.version}`}
      >
        Build {build.shortSha}
      </span>
    </footer>
  );
}
