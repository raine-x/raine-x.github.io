import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(__dirname, '..');
export const CONTENT_DIR = path.join(ROOT_DIR, 'content');
export const SITE_FILE = path.join(CONTENT_DIR, 'site.json');
export const PAGES_DIR = path.join(CONTENT_DIR, 'pages');
export const COLLECTIONS_DIR = path.join(CONTENT_DIR, 'collections');
export const ASSETS_DIR = path.join(CONTENT_DIR, 'assets');
export const DIST_DIR = path.join(ROOT_DIR, 'dist');

export function sanitizeSlug(input, fallback = 'untitled') {
  const cleaned = String(input ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || fallback;
}

export function assertSafeName(name, label = 'name') {
  if (!name || typeof name !== 'string' || /[\\/:*?"<>|]/.test(name) || name.includes('..')) {
    throw new Error(`无效的 ${label}: ${name}`);
  }
  return name;
}

function normalizeDate(value) {
  if (!value) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).trim();
}

function normalizeFrontmatter(data = {}) {
  const out = { ...data };
  if (out.date !== undefined) out.date = normalizeDate(out.date);
  if (out.updated !== undefined) out.updated = normalizeDate(out.updated);
  if (Array.isArray(out.tags)) out.tags = out.tags.map(String).filter(Boolean);
  if (Array.isArray(out.related)) out.related = out.related.map(String).filter(Boolean);
  return out;
}

export async function ensureDirs() {
  await Promise.all([
    fs.mkdir(CONTENT_DIR, { recursive: true }),
    fs.mkdir(PAGES_DIR, { recursive: true }),
    fs.mkdir(COLLECTIONS_DIR, { recursive: true }),
    fs.mkdir(ASSETS_DIR, { recursive: true }),
  ]);
}

export async function readSite() {
  await ensureDirs();
  try {
    const raw = await fs.readFile(SITE_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {
      title: 'Canvas · 个人空间',
      brandMark: 'C',
      brandName: '你的名字',
      tagline: '独立思考与创作空间',
      siteUrl: 'https://example.com',
      footerText: 'Built with Custom Site Engine',
      theme: {
        preset: 'lab',
        colorMode: 'auto',
        accent: '#ea580c',
        font: 'sans',
        maxWidth: '960px',
        radius: '10px',
      },
      nav: [{ label: '首页', href: '/' }],
      socials: [],
    };
  }
}

export async function writeSite(siteData) {
  await ensureDirs();
  await fs.writeFile(SITE_FILE, JSON.stringify(siteData, null, 2) + '\n', 'utf8');
  return siteData;
}

export async function listPages() {
  await ensureDirs();
  const entries = await fs.readdir(PAGES_DIR, { withFileTypes: true });
  const pages = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name);
    const slug = path.basename(entry.name, ext);
    const fullPath = path.join(PAGES_DIR, entry.name);

    if (ext === '.json') {
      const raw = await fs.readFile(fullPath, 'utf8');
      const parsed = JSON.parse(raw);
      pages.push({
        slug: parsed.slug || slug,
        kind: 'blocks',
        title: parsed.title || slug,
        description: parsed.description || '',
        blocks: Array.isArray(parsed.blocks) ? parsed.blocks : [],
        route: (parsed.slug || slug) === 'home' ? '/' : `/${parsed.slug || slug}`,
      });
    } else if (ext === '.md') {
      const raw = await fs.readFile(fullPath, 'utf8');
      const parsed = matter(raw);
      const data = normalizeFrontmatter(parsed.data);
      pages.push({
        slug,
        kind: 'markdown',
        title: data.title || slug,
        description: data.description || '',
        data,
        body: parsed.content.trimStart(),
        route: slug === 'home' ? '/' : `/${slug}`,
      });
    }
  }

  return pages.sort((a, b) => {
    if (a.slug === 'home') return -1;
    if (b.slug === 'home') return 1;
    return a.slug.localeCompare(b.slug, 'zh-CN');
  });
}

export async function savePage(slug, payload) {
  await ensureDirs();
  const safeSlug = assertSafeName(sanitizeSlug(slug), 'page slug');
  const jsonPath = path.join(PAGES_DIR, `${safeSlug}.json`);
  const mdPath = path.join(PAGES_DIR, `${safeSlug}.md`);

  if (payload.kind === 'blocks') {
    await fs.rm(mdPath, { force: true });
    const doc = {
      slug: safeSlug,
      title: payload.title || safeSlug,
      description: payload.description || '',
      blocks: Array.isArray(payload.blocks) ? payload.blocks : [],
    };
    await fs.writeFile(jsonPath, JSON.stringify(doc, null, 2) + '\n', 'utf8');
    return { ...doc, kind: 'blocks', route: safeSlug === 'home' ? '/' : `/${safeSlug}` };
  }

  await fs.rm(jsonPath, { force: true });
  const frontmatter = {
    title: payload.title || safeSlug,
    description: payload.description || '',
    ...(payload.data || {}),
  };
  const fileContent = matter.stringify(String(payload.body ?? ''), frontmatter);
  await fs.writeFile(mdPath, fileContent, 'utf8');
  return {
    slug: safeSlug,
    kind: 'markdown',
    title: frontmatter.title,
    description: frontmatter.description,
    data: frontmatter,
    body: String(payload.body ?? ''),
    route: safeSlug === 'home' ? '/' : `/${safeSlug}`,
  };
}

export async function deletePage(slug) {
  const safeSlug = assertSafeName(slug, 'page slug');
  if (safeSlug === 'home') {
    throw new Error('首页（home）不可删除，你可以直接在后台编辑它的积木或切换为 Markdown 模式。');
  }
  await Promise.all([
    fs.rm(path.join(PAGES_DIR, `${safeSlug}.json`), { force: true }),
    fs.rm(path.join(PAGES_DIR, `${safeSlug}.md`), { force: true }),
  ]);
}

function sortItems(items, sortBy = 'date') {
  return [...items].sort((a, b) => {
    if (sortBy === 'order') {
      const oa = Number(a.data.order ?? 999);
      const ob = Number(b.data.order ?? 999);
      if (oa !== ob) return oa - ob;
    }
    const da = String(a.data.date || '');
    const db = String(b.data.date || '');
    if (da !== db) return db.localeCompare(da);
    return a.title.localeCompare(b.title, 'zh-CN');
  });
}

export async function listCollections() {
  await ensureDirs();
  const dirs = await fs.readdir(COLLECTIONS_DIR, { withFileTypes: true });
  const collections = [];

  for (const dir of dirs) {
    if (!dir.isDirectory()) continue;
    const id = dir.name;
    const colDir = path.join(COLLECTIONS_DIR, id);
    const metaPath = path.join(colDir, '_collection.json');

    let meta = {
      id,
      title: id,
      description: '',
      route: `/${id}`,
      defaultView: 'list',
      itemPrefix: '',
      sortBy: 'date',
    };

    try {
      const rawMeta = await fs.readFile(metaPath, 'utf8');
      meta = { ...meta, ...JSON.parse(rawMeta), id };
    } catch {
      // Fall back to default metadata when _collection.json is absent
    }

    if (!meta.route.startsWith('/')) meta.route = `/${meta.route}`;

    const files = await fs.readdir(colDir, { withFileTypes: true });
    const items = [];
    for (const file of files) {
      if (!file.isFile() || !file.name.endsWith('.md')) continue;
      const slug = path.basename(file.name, '.md');
      const raw = await fs.readFile(path.join(colDir, file.name), 'utf8');
      const parsed = matter(raw);
      const data = normalizeFrontmatter(parsed.data);
      items.push({
        collection: id,
        slug,
        ref: `${id}/${slug}`,
        route: `${meta.route.replace(/\/$/, '')}/${slug}`,
        title: String(data.title || slug),
        summary: String(data.summary || data.description || ''),
        data,
        body: parsed.content.trimStart(),
      });
    }

    collections.push({
      ...meta,
      items: sortItems(items, meta.sortBy),
    });
  }

  return collections.sort((a, b) => a.id.localeCompare(b.id, 'zh-CN'));
}

export async function saveCollectionMeta(id, payload) {
  await ensureDirs();
  const safeId = assertSafeName(sanitizeSlug(id), 'collection id');
  if (['studio', 'api', 'assets'].includes(safeId)) {
    throw new Error(`"${safeId}" 是系统保留路径，请换一个合集 ID。`);
  }
  const colDir = path.join(COLLECTIONS_DIR, safeId);
  await fs.mkdir(colDir, { recursive: true });

  const routeRaw = String(payload.route || `/${safeId}`).trim();
  const route = routeRaw.startsWith('/') ? routeRaw : `/${routeRaw}`;
  if (['/studio', '/api', '/assets'].some((r) => route === r || route.startsWith(`${r}/`))) {
    throw new Error(`路由 "${route}" 与系统保留路径冲突。`);
  }

  const meta = {
    id: safeId,
    title: String(payload.title || safeId).trim(),
    description: String(payload.description || '').trim(),
    route: route === '/' ? `/${safeId}` : route.replace(/\/+$/, ''),
    defaultView: ['grid', 'list', 'timeline'].includes(payload.defaultView)
      ? payload.defaultView
      : 'list',
    itemPrefix: String(payload.itemPrefix ?? '').trim(),
    sortBy: payload.sortBy === 'order' ? 'order' : 'date',
  };

  await fs.writeFile(
    path.join(colDir, '_collection.json'),
    JSON.stringify(meta, null, 2) + '\n',
    'utf8'
  );
  return meta;
}

export async function deleteCollection(id) {
  const safeId = assertSafeName(id, 'collection id');
  await fs.rm(path.join(COLLECTIONS_DIR, safeId), { recursive: true, force: true });
}

export async function saveCollectionItem(collectionId, slug, payload) {
  const safeCol = assertSafeName(collectionId, 'collection id');
  const safeSlug = assertSafeName(sanitizeSlug(slug), 'item slug');
  const colDir = path.join(COLLECTIONS_DIR, safeCol);
  await fs.mkdir(colDir, { recursive: true });

  const cleanData = {};
  const sourceData = payload.data && typeof payload.data === 'object' ? payload.data : {};
  for (const [key, val] of Object.entries(sourceData)) {
    if (val === undefined || val === null || val === '') continue;
    cleanData[key] = val;
  }
  cleanData.title = String(cleanData.title || payload.title || safeSlug);
  if (payload.summary !== undefined && payload.summary !== '') {
    cleanData.summary = String(payload.summary);
  }

  const fileContent = matter.stringify(String(payload.body ?? ''), cleanData);
  await fs.writeFile(path.join(colDir, `${safeSlug}.md`), fileContent, 'utf8');
  return { collection: safeCol, slug: safeSlug };
}

export async function deleteCollectionItem(collectionId, slug) {
  const safeCol = assertSafeName(collectionId, 'collection id');
  const safeSlug = assertSafeName(slug, 'item slug');
  await fs.rm(path.join(COLLECTIONS_DIR, safeCol, `${safeSlug}.md`), { force: true });
}

export async function listAssets() {
  await ensureDirs();
  const entries = await fs.readdir(ASSETS_DIR, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && !e.name.startsWith('.'))
    .map((e) => ({ name: e.name, url: `/assets/${e.name}` }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function saveAssetBase64(filename, base64Data) {
  await ensureDirs();
  const ext = path.extname(filename || '').toLowerCase() || '.png';
  const allowedExts = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg']);
  const finalExt = allowedExts.has(ext) ? ext : '.png';
  const base = sanitizeSlug(path.basename(filename || 'image', ext), 'img');
  const stamp = Date.now().toString(36);
  const finalName = `${base}-${stamp}${finalExt}`;
  const cleanBase64 = String(base64Data).replace(/^data:[^;]+;base64,/, '');
  const buffer = Buffer.from(cleanBase64, 'base64');
  await fs.writeFile(path.join(ASSETS_DIR, finalName), buffer);
  return { name: finalName, url: `/assets/${finalName}` };
}

export async function loadWorkspace() {
  const [site, pages, collections, assets] = await Promise.all([
    readSite(),
    listPages(),
    listCollections(),
    listAssets(),
  ]);
  return { site, pages, collections, assets };
}
