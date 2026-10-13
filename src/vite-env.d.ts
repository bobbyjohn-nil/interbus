/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 'fixture' in the e2e tests' build (.env.fixture), which plays mini-Boston. */
  readonly VITE_SIM?: string;
}

/** Full commit SHA of this build, injected by vite.config.ts. */
declare const __BUILD_SHA__: string;
/** Newest version in CHANGELOG.md at this commit, or 0.0.0 before the first /ship. */
declare const __BUILD_VERSION__: string;
