// Measures the built preview (DECISIONS.md "Measurements to record"): gzip size of every chunk,
// the menu's critical path (index.html, the entry script and stylesheet, and both interface fonts,
// D13) and the board (every other script and stylesheet, all loaded when the map opens: MapLibre,
// its worker, PMTiles and the style). Budgets (PLAN I14): menu ≤200 KiB gzip, board ≤520 KiB. The
// week-5 model chunk loads only at the first tilted mesh switch and gets its own 200 KiB budget.
//
//   npm run build && node scripts/measure/bundle.mjs [dist]
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const dist = resolve(process.argv[2] ?? 'dist');
const gz = (file) => gzipSync(readFileSync(file), { level: 9 }).length;
const kib = (n) => `${(n / 1024).toFixed(1)} KiB`;

const html = readFileSync(join(dist, 'index.html'), 'utf8');
const entry = [...html.matchAll(/(?:src|href)="\.\/(assets\/[^"]+\.(?:js|css))"/g)].map((m) => m[1]);
const fonts = ['fonts/afacad-flux-400.woff2', 'fonts/afacad-flux-600.woff2'];

console.log('chunks (gzip):');
for (const f of readdirSync(join(dist, 'assets')).filter((f) => /\.(js|css)$/.test(f)).sort()) {
  console.log(`  ${f.padEnd(34)} ${kib(gz(join(dist, 'assets', f)))}`);
}
let critical = gz(join(dist, 'index.html'));
for (const f of entry) critical += gz(join(dist, f));
for (const f of fonts) critical += statSync(join(dist, f)).size; // woff2 is already compressed
console.log(`menu critical path: ${kib(critical)} (index.html, ${entry.join(', ')}, ${fonts.length} fonts); budget 200 KiB`);

const lazy = readdirSync(join(dist, 'assets')).filter((f) => /\.(js|css)$/.test(f) && !entry.includes(`assets/${f}`));
const board = lazy.reduce((sum, f) => sum + gz(join(dist, 'assets', f)), 0);
console.log(`board: ${kib(board)} (${lazy.length} lazy chunks); budget 520 KiB`);

const over = [critical > 200 * 1024 && 'menu', board > 520 * 1024 && 'board'].filter(Boolean);
if (over.length) console.error(`over budget: ${over.join(', ')}`);
process.exitCode = over.length ? 1 : 0;
