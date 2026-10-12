// Measures the built preview (DECISIONS.md "Measurements to record"): gzip size of every chunk and
// the menu's critical path, meaning index.html, the entry script and stylesheet, and both interface
// fonts (D13). Budget: the critical path stays at or under 200 KiB gzip (PLAN I14).
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
process.exitCode = critical <= 200 * 1024 ? 0 : 1;
