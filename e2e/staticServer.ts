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

export interface StaticSite {
  readonly url: string;
  /** From now on, answer 404 for this path (relative to the root), as a file gone from the site would. */
  hide(path: string): void;
  close(): Promise<void>;
}

/**
 * Serves a directory the way Pages does for these tests: files or 404, and single byte ranges
 * (206), which the city file is read by. Paths in `hidden` answer 404 from the start.
 */
export async function serve(root: string, hidden: readonly string[] = []): Promise<StaticSite> {
  const gone = new Set(hidden.map((p) => normalize(join(root, p))));
  const server: Server = createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
    const file = normalize(join(root, path.endsWith('/') ? `${path}index.html` : path));
    if (!file.startsWith(root)) return void res.writeHead(403).end();
    if (gone.has(file)) return void res.writeHead(404).end('not found');
    let body: Buffer;
    try {
      body = await readFile(file);
    } catch {
      return void res.writeHead(404).end('not found');
    }
    const type = TYPES[extname(file)] ?? 'application/octet-stream';
    const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range ?? '');
    if (range) {
      const start = Number(range[1]);
      const end = Math.min(range[2] ? Number(range[2]) : body.length - 1, body.length - 1);
      if (start > end) return void res.writeHead(416, { 'content-range': `bytes */${body.length}` }).end();
      res.writeHead(206, { 'content-type': type, 'content-range': `bytes ${start}-${end}/${body.length}`, 'accept-ranges': 'bytes' });
      return void res.end(body.subarray(start, end + 1));
    }
    res.writeHead(200, { 'content-type': type, 'accept-ranges': 'bytes' }).end(body);
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('no port');
  return {
    url: `http://127.0.0.1:${address.port}`,
    hide: (path) => void gone.add(normalize(join(root, path))),
    close: () => new Promise((done) => server.close(() => done())),
  };
}
