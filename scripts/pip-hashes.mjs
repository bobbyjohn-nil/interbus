// Prints a pip requirement with the SHA-256 of every wheel PyPI lists for that release, so
// `pip install --require-hashes --only-binary=:all:` works on Linux, macOS and Windows alike.
// Used when re-pinning scripts/fonts/requirements.txt and tools/bake/requirements.txt.
//
//   node scripts/pip-hashes.mjs fonttools==4.66.0 brotli==1.2.0
const specs = process.argv.slice(2);
if (!specs.length || specs.some((s) => !/^[\w.-]+==[\w.]+$/.test(s))) {
  console.error('usage: node scripts/pip-hashes.mjs <name>==<version> ...');
  process.exit(2);
}
for (const spec of specs) {
  const [name, version] = spec.split('==');
  const res = await fetch(`https://pypi.org/pypi/${name}/${version}/json`);
  if (!res.ok) throw new Error(`pip-hashes: HTTP ${res.status} for ${spec}`);
  const { urls } = await res.json();
  const wheels = urls.filter((f) => f.packagetype === 'bdist_wheel');
  if (!wheels.length) throw new Error(`pip-hashes: ${spec} has no wheels`);
  const uploaded = wheels.map((f) => f.upload_time_iso_8601.slice(0, 10)).sort()[0];
  console.log(`# ${spec}: ${wheels.length} wheels, uploaded ${uploaded}`);
  const hashes = [...new Set(wheels.map((f) => f.digests.sha256))].sort();
  console.log(`${spec} \\\n${hashes.map((h) => `    --hash=sha256:${h}`).join(' \\\n')}`);
}
