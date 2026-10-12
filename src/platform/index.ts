// The only module that touches the browser's storage, reloads, fullscreen and build files (CLAUDE.md).
// Week 8 adds a desktop/ flavour behind a build alias; until then this is the web preview.
export { build, makeBuildInfo, type BuildInfo } from './web/build';
export { onReplaced, reportReplaced, watchChunkFailures, reload, type ReplacedReason } from './web/replaced';
export { assetUrl, assetBase } from './web/assets';
export { openCityFile, type CityFile } from './web/cityFile';
