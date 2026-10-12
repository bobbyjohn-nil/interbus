import { build } from '../platform';

/** OSM attribution and the build chip share the bottom-right corner (CLAUDE.md "The build chip"). */
export function Corner() {
  return (
    <footer className="corner">
      <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
        © OpenStreetMap contributors
      </a>
      <span aria-hidden="true">·</span>
      <a href="https://protomaps.com" target="_blank" rel="noopener noreferrer">
        Protomaps
      </a>
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
