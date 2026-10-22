// The only module that touches the browser's storage, reloads, fullscreen and build files (CLAUDE.md).
// From Feb 8 (D18) a desktop/ flavour joins behind a build alias; until then this is the web preview.
export { build, makeBuildInfo, type BuildInfo } from './web/build';
export { onReplaced, reportReplaced, watchChunkFailures, reload, type ReplacedReason } from './web/replaced';
export { assetUrl, assetBase, assetGone } from './web/assets';
export { openCityFile, type CityFile } from './web/cityFile';
export { externalLink, ownFile, ALLOWED_LINKS, OWN_FILES, type ExternalLinkProps } from './web/links';
export { createWebSaveStore, onOtherTabWrites, storeRefusal } from './web/saveStore';
export { createMemorySaveStore } from './memory/saveStore';
export { applyEffects, type SaveStore, type StoreEffect, type StoreRefusal } from './types';
export { readSimFile, startSimWorker } from './web/simFile';
export { downloadText, pickTextFile } from './web/files';
export { fpsSwitch, gpuSwitch, type GpuSwitch } from './web/switches';
export { readDotPrefs, writeDotPrefs, type DotPrefs } from './web/prefs';
