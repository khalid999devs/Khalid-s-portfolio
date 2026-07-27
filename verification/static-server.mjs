/**
 * Minimal static server with SPA fallback, used to serve a built `dist/`.
 *
 * Deliberately first-party rather than `vite preview`: the harness has to serve
 * the baseline and the candidate identically, and `vite preview` is itself one
 * of the things under upgrade. A fixed server keeps the delivery layer constant
 * so any pixel difference is attributable to the build, not the previewer.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, normalize, sep, extname } from 'node:path';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.mp4': 'video/mp4',
  '.pdf': 'application/pdf',
};

export const serveDist = (root, port) =>
  new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      const { pathname } = new URL(req.url, `http://localhost:${port}`);
      const relative = decodeURIComponent(pathname).replace(/^\/+/, '');
      let file = normalize(join(root, relative));

      if (!file.startsWith(root)) {
        res.writeHead(403).end('forbidden');
        return;
      }

      // SPA fallback: any path without a file extension is a client route.
      if (!existsSync(file) || (await stat(file)).isDirectory()) {
        file = join(root, 'index.html');
      }

      try {
        const body = await readFile(file);
        res.writeHead(200, {
          'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
          // Never cache: a warm cache across the two capture passes would make
          // the comparison meaningless.
          'Cache-Control': 'no-store',
        });
        res.end(body);
      } catch {
        res.writeHead(404).end('not found');
      }
    });
    server.listen(port, '127.0.0.1', () => resolve(server));
  });

// Allow standalone use: node static-server.mjs <dist-dir> <port>
if (process.argv[1]?.endsWith('static-server.mjs')) {
  const [, , root, port] = process.argv;
  await serveDist(normalize(root.endsWith(sep) ? root.slice(0, -1) : root), Number(port));
  process.stdout.write(`static-server serving ${root} on ${port}\n`);
}
