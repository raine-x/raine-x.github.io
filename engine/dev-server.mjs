import { spawn } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ASSETS_DIR,
  CONTENT_DIR,
  deleteCollection,
  deleteCollectionItem,
  deletePage,
  loadWorkspace,
  saveAssetBase64,
  saveCollectionItem,
  saveCollectionMeta,
  savePage,
  writeSite,
} from './store.mjs';
import { generateThemeCss } from './theme.mjs';
import { renderMarkdown } from './markdown.mjs';
import {
  buildRssXml,
  buildSearchIndex,
  renderCollectionIndex,
  renderCollectionItem,
  renderNotFound,
  renderPage,
} from './renderer.mjs';
import { buildSite } from './builder.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STUDIO_DIR = path.join(__dirname, 'studio');

const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT || 4321);

const MIME_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

const sseClients = new Set();
let reloadTimer = null;

function notifyReload() {
  if (reloadTimer) clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => {
    for (const res of sseClients) {
      res.write('data: reload\n\n');
    }
  }, 80);
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req, maxBytes = 10 * 1024 * 1024) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes) {
      throw new Error('请求体过大');
    }
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
}

function openBrowser(url) {
  if (process.platform === 'win32') {
    spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
  } else if (process.platform === 'darwin') {
    spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
  } else {
    spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
  }
}

async function handleApi(req, res, pathname) {
  try {
    if (req.method === 'GET' && pathname === '/api/studio/state') {
      const workspace = await loadWorkspace();
      return sendJson(res, 200, workspace);
    }

    if (req.method === 'PUT' && pathname === '/api/studio/site') {
      const body = await readJsonBody(req);
      const saved = await writeSite(body);
      notifyReload();
      return sendJson(res, 200, { ok: true, site: saved });
    }

    if (req.method === 'POST' && pathname === '/api/studio/preview-md') {
      const body = await readJsonBody(req);
      const rendered = renderMarkdown(body.markdown || '');
      return sendJson(res, 200, rendered);
    }

    if (req.method === 'POST' && pathname === '/api/studio/upload') {
      const body = await readJsonBody(req);
      const saved = await saveAssetBase64(body.filename, body.data);
      return sendJson(res, 200, { ok: true, asset: saved });
    }

    if (req.method === 'POST' && pathname === '/api/studio/build') {
      const result = await buildSite();
      return sendJson(res, 200, { ok: true, ...result });
    }

    // Pages CRUD: /api/studio/pages/:slug
    if (pathname.startsWith('/api/studio/pages/')) {
      const slug = decodeURIComponent(pathname.slice('/api/studio/pages/'.length));
      if (req.method === 'PUT') {
        const body = await readJsonBody(req);
        const page = await savePage(slug, body);
        notifyReload();
        return sendJson(res, 200, { ok: true, page });
      }
      if (req.method === 'DELETE') {
        await deletePage(slug);
        notifyReload();
        return sendJson(res, 200, { ok: true });
      }
    }

    // Collections CRUD: /api/studio/collections/:id
    if (pathname.startsWith('/api/studio/collections/')) {
      const id = decodeURIComponent(pathname.slice('/api/studio/collections/'.length));
      if (req.method === 'PUT') {
        const body = await readJsonBody(req);
        const meta = await saveCollectionMeta(id, body);
        notifyReload();
        return sendJson(res, 200, { ok: true, collection: meta });
      }
      if (req.method === 'DELETE') {
        await deleteCollection(id);
        notifyReload();
        return sendJson(res, 200, { ok: true });
      }
    }

    // Items CRUD: /api/studio/items/:collection/:slug
    if (pathname.startsWith('/api/studio/items/')) {
      const parts = pathname.slice('/api/studio/items/'.length).split('/').map(decodeURIComponent);
      if (parts.length === 2) {
        const [collectionId, slug] = parts;
        if (req.method === 'PUT') {
          const body = await readJsonBody(req);
          const item = await saveCollectionItem(collectionId, slug, body);
          notifyReload();
          return sendJson(res, 200, { ok: true, item });
        }
        if (req.method === 'DELETE') {
          await deleteCollectionItem(collectionId, slug);
          notifyReload();
          return sendJson(res, 200, { ok: true });
        }
      }
    }

    return sendJson(res, 404, { error: 'API route not found' });
  } catch (err) {
    return sendJson(res, 400, { error: err?.message || '请求处理失败' });
  }
}

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url || '/', `http://${HOST}:${PORT}`);
  const pathname = decodeURIComponent(urlObj.pathname).replace(/\/+$/, '') || '/';

  // Live reload SSE endpoint
  if (pathname === '/__livereload') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write('retry: 1000\n\n');
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  // Studio API
  if (pathname.startsWith('/api/studio/')) {
    await handleApi(req, res, pathname);
    return;
  }

  // Assets from content/assets
  if (pathname.startsWith('/assets/')) {
    const filename = path.basename(pathname);
    const filePath = path.join(ASSETS_DIR, filename);
    try {
      const data = await fsp.readFile(filePath);
      const ext = path.extname(filename).toLowerCase();
      res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream');
      res.end(data);
    } catch {
      res.statusCode = 404;
      res.end('Asset not found');
    }
    return;
  }

  const workspace = await loadWorkspace();

  if (pathname === '/styles.css') {
    res.setHeader('Content-Type', 'text/css; charset=utf-8');
    res.end(generateThemeCss(workspace.site.theme));
    return;
  }

  if (pathname === '/search.json') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(buildSearchIndex(workspace)));
    return;
  }

  if (pathname === '/rss.xml') {
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.end(buildRssXml(workspace));
    return;
  }

  // Inline editor assets (dev-only)
  if (pathname === '/__inline-editor.css' || pathname === '/__inline-editor.js') {
    const file = path.join(STUDIO_DIR, pathname.slice(3));
    const content = await fsp.readFile(file, 'utf8');
    res.setHeader(
      'Content-Type',
      pathname.endsWith('.css') ? 'text/css; charset=utf-8' : 'application/javascript; charset=utf-8'
    );
    res.end(content);
    return;
  }

  // Redirect legacy /studio URL directly to homepage
  if (pathname === '/studio') {
    res.statusCode = 302;
    res.setHeader('Location', '/');
    res.end();
    return;
  }

  // Render actual site route directly with inline editor support in dev mode
  const matchedPage = workspace.pages.find((p) => p.route === pathname);
  if (matchedPage) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(renderPage(matchedPage, workspace, { isDev: true }));
    return;
  }

  for (const col of workspace.collections) {
    if (col.route === pathname) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(renderCollectionIndex(col, workspace, { isDev: true }));
      return;
    }
    const matchedItem = col.items.find((i) => i.route === pathname);
    if (matchedItem) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(renderCollectionItem(matchedItem, col, workspace, { isDev: true }));
      return;
    }
  }

  res.statusCode = 404;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(renderNotFound(workspace, { isDev: true, notFoundPath: pathname }));
});

// Watch content/ for external editor changes (Obsidian/Typora/VS Code)
try {
  fs.watch(CONTENT_DIR, { recursive: true }, () => {
    notifyReload();
  });
} catch {
  // Ignore watch failures on platforms without recursive fs.watch
}

server.listen(PORT, HOST, () => {
  const baseUrl = `http://${HOST}:${PORT}`;
  console.log('');
  console.log(`  Local Site (Preview & Inline Edit): ${baseUrl}/`);
  console.log('');
  if (process.argv.includes('--open')) {
    openBrowser(`${baseUrl}/`);
  }
});
