import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.pbf': 'application/x-protobuf',
};

/**
 * Serves a directory the way Pages does for these tests: files or 404, nothing else. Paths in
 * `hidden` (relative to the root, e.g. "cities/boston.pmtiles") answer 404, as a file gone from the
 * site would.
 */
export async function serve(
  root: string,
  hidden: readonly string[] = [],
): Promise<{ url: string; close: () => Promise<void> }> {
  const gone = new Set(hidden.map((p) => normalize(join(root, p))));
  const server: Server = createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
    const file = normalize(join(root, path.endsWith('/') ? `${path}index.html` : path));
    if (!file.startsWith(root)) return void res.writeHead(403).end();
    if (gone.has(file)) return void res.writeHead(404).end('not found');
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('no port');
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((done) => server.close(() => done())),
  };
}
