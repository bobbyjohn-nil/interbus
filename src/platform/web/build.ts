export interface BuildInfo {
  /** Full commit SHA; test reports and playtest notes cite it (CLAUDE.md, "The build chip"). */
  readonly sha: string;
  /** The first 7 characters, as shown on the chip. */
  readonly shortSha: string;
  /** Newest version the owner has shipped with /ship, or 0.0.0. */
  readonly version: string;
}

export function makeBuildInfo(sha: string, version: string): BuildInfo {
  return { sha, shortSha: sha.slice(0, 7), version };
}

export const build: BuildInfo = makeBuildInfo(__BUILD_SHA__, __BUILD_VERSION__);
