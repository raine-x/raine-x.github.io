import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ASSETS_DIR, DIST_DIR, loadWorkspace } from './store.mjs';
import { generateThemeCss } from './theme.mjs';
import {
  buildRssXml,
  buildSearchIndex,
  renderCollectionIndex,
  renderCollectionItem,
  renderNotFound,
  renderPage,
} from './renderer.mjs';

async function writeRouteHtml(route, html) {
  const cleanRoute = route.replace(/^\/+|\/+$/g, '');
  const outDir = cleanRoute ? path.join(DIST_DIR, cleanRoute) : DIST_DIR;
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(path.join(outDir, 'index.html'), html, 'utf8');
}

export async function buildSite() {
  const start = performance.now();
  const workspace = await loadWorkspace();

  await fs.rm(DIST_DIR, { recursive: true, force: true });
  await fs.mkdir(DIST_DIR, { recursive: true });

  // Styles, search index, RSS, 404
  const css = generateThemeCss(workspace.site.theme);
  await Promise.all([
    fs.writeFile(path.join(DIST_DIR, 'styles.css'), css, 'utf8'),
    fs.writeFile(
      path.join(DIST_DIR, 'search.json'),
      JSON.stringify(buildSearchIndex(workspace)),
      'utf8'
    ),
    fs.writeFile(path.join(DIST_DIR, 'rss.xml'), buildRssXml(workspace), 'utf8'),
    fs.writeFile(
      path.join(DIST_DIR, '404.html'),
      renderNotFound(workspace, { isDev: false, inlineCss: css }),
      'utf8'
    ),
  ]);

  // Copy assets (exclude dotfiles like .gitkeep)
  try {
    const assetEntries = await fs.readdir(ASSETS_DIR, { withFileTypes: true });
    const distAssets = path.join(DIST_DIR, 'assets');
    await fs.mkdir(distAssets, { recursive: true });
    for (const entry of assetEntries) {
      if (!entry.isFile() || entry.name.startsWith('.')) continue;
      await fs.copyFile(path.join(ASSETS_DIR, entry.name), path.join(distAssets, entry.name));
    }
  } catch {
    // No assets to copy
  }

  let pageCount = 0;

  // Render pages
  for (const page of workspace.pages) {
    const html = renderPage(page, workspace, { isDev: false });
    await writeRouteHtml(page.route, html);
    pageCount += 1;
  }

  // Render collections & items
  for (const col of workspace.collections) {
    await writeRouteHtml(col.route, renderCollectionIndex(col, workspace, { isDev: false }));
    pageCount += 1;

    for (const item of col.items) {
      if (item.data.draft) continue;
      await writeRouteHtml(
        item.route,
        renderCollectionItem(item, col, workspace, { isDev: false })
      );
      pageCount += 1;
    }
  }

  const durationMs = Math.round(performance.now() - start);
  return { pageCount, durationMs, outDir: DIST_DIR };
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectRun) {
  const result = await buildSite();
  console.log(`Built ${result.pageCount} static pages in ${result.durationMs}ms -> ${result.outDir}`);
}
