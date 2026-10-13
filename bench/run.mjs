// `npm run bench [name]`: bundles bench/<name>.ts (default `recompute`) with Vite, as the game's
// build bundles the sim, and runs it in Node. Timing the sim through vitest measured its module
// transform instead: every imported constant became a getter call in the hot loop.
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'vite';

const name = process.argv[2] ?? 'recompute';
const outDir = '.cache/bench/dist';
await build({
  configFile: false,
  logLevel: 'warn',
  ssr: { noExternal: true },
  plugins: [
    {
      // The bake scripts find the repository from their own location, so they run where they are.
      name: 'bake-in-place',
      enforce: 'pre',
      resolveId(source, importer) {
        if (importer && source.includes('tools/bake/')) return { id: pathToFileURL(resolve(dirname(importer), source)).href, external: true };
        return null;
      },
    },
  ],
  build: {
    ssr: `bench/${name}.ts`,
    outDir,
    emptyOutDir: true,
    minify: false,
    rollupOptions: { output: { entryFileNames: '[name].mjs' } },
  },
});
await import(pathToFileURL(`${outDir}/${name}.mjs`).href);
