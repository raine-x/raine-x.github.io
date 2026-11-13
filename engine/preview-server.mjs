import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { DIST_DIR } from './store.mjs';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

const port = Number(process.env.PORT || 4321);
const host = '127.0.0.1';

const server = http.createServer(async (req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  const safePath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
  let target = path.join(DIST_DIR, safePath);

  try {
    const stat = await fs.stat(target).catch(() => null);
    if (!stat) {
      target = path.join(DIST_DIR, '404.html');
      res.statusCode = 404;
    } else if (stat.isDirectory()) {
      target = path.join(target, 'index.html');
    }

    const data = await fs.readFile(target);
    const ext = path.extname(target).toLowerCase();
    res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream');
    res.end(data);
  } catch {
    res.statusCode = 404;
    res.end('Not found. Run "pnpm build" first.');
  }
});

server.listen(port, host, () => {
  console.log(`Static preview running at http://${host}:${port}/`);
});
