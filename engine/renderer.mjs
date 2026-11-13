import { escapeHtml, renderMarkdown } from './markdown.mjs';
import { generateThemeCss } from './theme.mjs';

const STATUS_LABELS = {
  active: '进行中',
  completed: '已完成',
  archived: '已归档',
};

function devAttrs(isDev, str) {
  return isDev ? ` ${str}` : '';
}

function safeJsonForHtml(obj) {
  return JSON.stringify(obj).replace(/</g, '\\u003c');
}

function formatCode(prefix, index) {
  if (!prefix) return '';
  return `${prefix}-${String(index + 1).padStart(2, '0')}`;
}

function renderItemCard(item, collectionMeta, index, { view = 'grid', relatedCount = 0, isDev = false } = {}) {
  const code = formatCode(collectionMeta?.itemPrefix, index);
  const statusLabel = item.data.status ? STATUS_LABELS[item.data.status] || item.data.status : '';
  const tags = Array.isArray(item.data.tags) ? item.data.tags : [];
  const tagsAttr = escapeHtml(tags.join(','));
  const dateStr = item.data.date ? escapeHtml(item.data.date) : '';
  const itemAttrs = isDev
    ? ` data-item-slug="${escapeHtml(item.slug)}" data-item-collection="${escapeHtml(item.collection)}"${item.data.draft ? ' data-item-draft="true"' : ''}`
    : '';

  if (view === 'list') {
    return `<article class="list-row" data-tags="${tagsAttr}"${itemAttrs}>
      <div>
        <div class="card-kicker" style="justify-content:flex-start; gap:10px;">
          ${code ? `<span>${escapeHtml(code)}</span>` : ''}
          ${dateStr ? `<time>${dateStr}</time>` : ''}
          ${statusLabel ? `<span class="pill pill-accent">${escapeHtml(statusLabel)}</span>` : ''}
          ${relatedCount > 0 ? `<span>· ${relatedCount} 篇关联</span>` : ''}
        </div>
        <h3 class="card-title"><a href="${escapeHtml(item.route)}">${escapeHtml(item.title)}</a></h3>
        ${item.summary ? `<p class="card-desc">${escapeHtml(item.summary)}</p>` : ''}
        ${
          tags.length > 0
            ? `<div class="tag-row">${tags.map((t) => `<span class="pill">#${escapeHtml(t)}</span>`).join('')}</div>`
            : ''
        }
      </div>
      <a class="more-link" style="white-space:nowrap;" href="${escapeHtml(item.route)}">阅读 →</a>
    </article>`;
  }

  if (view === 'timeline') {
    return `<article class="timeline-item" data-tags="${tagsAttr}"${itemAttrs}>
      <div class="card-kicker">
        <span>${dateStr || code || collectionMeta?.title || ''}</span>
        ${statusLabel ? `<span class="pill pill-accent">${escapeHtml(statusLabel)}</span>` : ''}
      </div>
      <h3 class="card-title"><a href="${escapeHtml(item.route)}">${escapeHtml(item.title)}</a></h3>
      ${item.summary ? `<p class="card-desc">${escapeHtml(item.summary)}</p>` : ''}
      ${
        tags.length > 0
          ? `<div class="tag-row">${tags.map((t) => `<span class="pill">#${escapeHtml(t)}</span>`).join('')}</div>`
          : ''
      }
    </article>`;
  }

  // Default: grid card
  return `<article class="card" data-tags="${tagsAttr}"${itemAttrs}>
    <div>
      <div class="card-kicker">
        <span>${escapeHtml(code || dateStr || collectionMeta?.title || '')}</span>
        ${
          statusLabel
            ? `<span class="pill pill-accent">${escapeHtml(statusLabel)}</span>`
            : relatedCount > 0
              ? `<span>${relatedCount} 篇关联</span>`
              : dateStr && code
                ? `<time>${dateStr}</time>`
                : ''
        }
      </div>
      <h3 class="card-title"><a href="${escapeHtml(item.route)}">${escapeHtml(item.title)}</a></h3>
      ${item.summary ? `<p class="card-desc">${escapeHtml(item.summary)}</p>` : ''}
    </div>
    <div class="tag-row" style="justify-content:space-between; align-items:center;">
      <div style="display:flex; gap:6px; flex-wrap:wrap;">
        ${tags.slice(0, 4).map((t) => `<span class="pill">#${escapeHtml(t)}</span>`).join('')}
      </div>
      <a class="more-link" href="${escapeHtml(item.route)}">详情 →</a>
    </div>
  </article>`;
}

function renderCollectionItems(items, collectionMeta, view, relatedCountMap, isDev = false, gridCols = 2) {
  if (!items.length) {
    return `<p style="color:var(--muted); font-size:14px;">该栏目暂无内容，开启编辑模式即可直接新建条目。</p>`;
  }
  const htmlItems = items.map((item, idx) =>
    renderItemCard(item, collectionMeta, idx, {
      view,
      relatedCount: relatedCountMap.get(item.ref) ?? 0,
      isDev,
    })
  );
  if (view === 'list') return `<div class="list-stack">${htmlItems.join('\n')}</div>`;
  if (view === 'timeline') return `<div class="timeline">${htmlItems.join('\n')}</div>`;
  const cols = [2, 3].includes(Number(gridCols)) ? Number(gridCols) : 2;
  return `<div class="grid-${cols}">${htmlItems.join('\n')}</div>`;
}

function buildRelatedCountMap(collections) {
  const counts = new Map();
  for (const col of collections) {
    for (const item of col.items) {
      const refs = Array.isArray(item.data.related) ? item.data.related : [];
      for (const targetRef of refs) {
        counts.set(targetRef, (counts.get(targetRef) ?? 0) + 1);
      }
    }
  }
  return counts;
}

function blockStyleClasses(style = {}) {
  const span = [4, 6, 8, 12].includes(Number(style.span)) ? Number(style.span) : 12;
  const classes = ['block-section', `blk-span-${span}`];
  if (span === 12) {
    if (style.width === 'compact') classes.push('blk-w-compact');
    else if (style.width === 'wide') classes.push('blk-w-wide');
  }
  if (style.spacing === 'tight') classes.push('blk-sp-tight');
  else if (style.spacing === 'spacious') classes.push('blk-sp-spacious');
  if (['surface', 'subtle', 'accent', 'outline'].includes(style.surface)) classes.push(`blk-bg-${style.surface}`);
  if (style.align === 'center') classes.push('blk-align-center');
  if (['sm', 'lg'].includes(style.scale)) classes.push(`blk-scale-${style.scale}`);
  return classes.join(' ');
}

function resolveBlockAnim(block, site) {
  const a = block.style?.anim;
  if (a === 'none') return '';
  if (a && a !== 'inherit') return a;
  const siteMotion = site?.theme?.motion;
  return siteMotion && siteMotion !== 'none' ? siteMotion : '';
}

function renderBlock(block, workspace, relatedCountMap, blockIndex = 0, isDev = false) {
  if (block.hidden && !isDev) return '';
  const data = block.data || {};
  const secClass = blockStyleClasses(block.style);
  const anim = resolveBlockAnim(block, workspace.site);
  const animAttr = anim ? ` data-anim="${escapeHtml(anim)}"` : '';
  const secAttrs = `${animAttr}${
    isDev
      ? ` data-block-idx="${blockIndex}" data-block-type="${escapeHtml(block.type)}"${block.hidden ? ' data-block-hidden="true"' : ''}`
      : ''
  }`;
  switch (block.type) {
    case 'hero': {
      const p = data.primaryBtn;
      const s = data.secondaryBtn;
      const align = data.align === 'center' ? 'text-align:center;' : '';
      return `<section class="${secClass}"${secAttrs}>
        <div class="hero-box" style="${align}">
          ${
            data.badge || isDev
              ? `<div class="hero-badge"${!data.badge && isDev ? ' data-empty-placeholder="true"' : ''}><span class="hero-dot"></span><span${devAttrs(isDev, 'data-editable="badge"')}>${escapeHtml(data.badge || '')}</span></div>`
              : ''
          }
          <h1 class="hero-title"${devAttrs(isDev, 'data-editable="title"')}>${escapeHtml(data.title || '')}</h1>
          ${
            data.subtitle || isDev
              ? `<p class="hero-sub" style="${data.align === 'center' ? 'margin-left:auto;margin-right:auto;' : ''}"${devAttrs(isDev, 'data-editable="subtitle"')}${!data.subtitle && isDev ? ' data-empty-placeholder="true"' : ''}>${escapeHtml(data.subtitle || '')}</p>`
              : ''
          }
          ${
            p?.label || s?.label || isDev
              ? `<div class="hero-actions" style="${data.align === 'center' ? 'justify-content:center;' : ''}">
                  ${p?.label ? `<a class="btn btn-primary" href="${escapeHtml(p.href || '#')}"${devAttrs(isDev, 'data-editable-btn="primaryBtn"')}>${escapeHtml(p.label)} →</a>` : ''}
                  ${s?.label ? `<a class="btn" href="${escapeHtml(s.href || '#')}"${devAttrs(isDev, 'data-editable-btn="secondaryBtn"')}>${escapeHtml(s.label)}</a>` : ''}
                </div>`
              : ''
          }
        </div>
      </section>`;
    }

    case 'bento': {
      const cols = [2, 3, 4].includes(Number(data.columns)) ? Number(data.columns) : 3;
      const cards = Array.isArray(data.cards) ? data.cards : [];
      return `<section class="${secClass}"${secAttrs}>
        ${
          data.title || isDev
            ? `<div class="section-head"><div><h2 class="section-title"${devAttrs(isDev, 'data-editable="title"')}${!data.title && isDev ? ' data-empty-placeholder="true"' : ''}>${escapeHtml(data.title || '')}</h2></div></div>`
            : ''
        }
        <div class="grid-${cols}"${devAttrs(isDev, 'data-sub-container="cards"')}>
          ${cards
            .map((card, idx) => {
              const cardClasses = ['card'];
              if (Number(card.colSpan) === 2) cardClasses.push('card-span-2');
              if (card.highlight) cardClasses.push('card-highlight');
              const inner = `
                <div>
                  ${card.label || isDev ? `<div class="card-kicker"><span${devAttrs(isDev, 'data-card-field="label"')}>${escapeHtml(card.label || '')}</span></div>` : ''}
                  ${card.value || isDev ? `<div class="bento-value"${devAttrs(isDev, 'data-card-field="value"')}>${escapeHtml(card.value || '')}</div>` : ''}
                  ${card.note || isDev ? `<p class="card-desc"${devAttrs(isDev, 'data-card-field="note"')}>${escapeHtml(card.note || '')}</p>` : ''}
                </div>`;
              const subAttr = isDev ? ` data-sub-kind="bento-card" data-sub-idx="${idx}" data-sub-href="${escapeHtml(card.href || '')}"` : '';
              if (card.href) {
                return `<a class="${cardClasses.join(' ')}" href="${escapeHtml(card.href)}"${subAttr}>${inner}</a>`;
              }
              return `<div class="${cardClasses.join(' ')}"${subAttr}>${inner}</div>`;
            })
            .join('\n')}
        </div>
      </section>`;
    }

    case 'collection-feed': {
      const col = workspace.collections.find((c) => c.id === data.collection);
      if (!col) {
        return isDev
          ? `<section class="${secClass}"${secAttrs}><div class="card"><p class="card-desc">未找到栏目 “${escapeHtml(data.collection || '')}”，请在模块栏重新选择栏目。</p></div></section>`
          : '';
      }
      let items = col.items.filter((i) => !i.data.draft);
      if (data.featuredOnly) items = items.filter((i) => Boolean(i.data.featured));
      if (data.tagFilter) items = items.filter((i) => (i.data.tags || []).includes(data.tagFilter));
      const limit = Number(data.limit) > 0 ? Number(data.limit) : 6;
      items = items.slice(0, limit);
      const view = ['grid', 'list', 'timeline'].includes(data.view) ? data.view : col.defaultView;

      return `<section class="${secClass}"${secAttrs}>
        <div class="section-head">
          <div>
            <h2 class="section-title"${devAttrs(isDev, 'data-editable="title"')}>${escapeHtml(data.title || col.title)}</h2>
            ${data.subtitle || isDev ? `<p class="section-sub"${devAttrs(isDev, 'data-editable="subtitle"')}${!data.subtitle && isDev ? ' data-empty-placeholder="true"' : ''}>${escapeHtml(data.subtitle || '')}</p>` : ''}
          </div>
          ${
            data.moreHref
              ? `<a class="more-link" href="${escapeHtml(data.moreHref)}"${devAttrs(isDev, 'data-editable-link="more"')}>${escapeHtml(data.moreLabel || '查看全部')} →</a>`
              : ''
          }
        </div>
        ${renderCollectionItems(items, col, view, relatedCountMap, isDev, data.columns)}
      </section>`;
    }

    case 'markdown': {
      const rendered = renderMarkdown(data.body || '');
      return `<section class="${secClass}"${secAttrs}>
        ${
          data.title || isDev
            ? `<div class="section-head"><div><h2 class="section-title"${devAttrs(isDev, 'data-editable="title"')}${!data.title && isDev ? ' data-empty-placeholder="true"' : ''}>${escapeHtml(data.title || '')}</h2></div></div>`
            : ''
        }
        <div class="prose"${devAttrs(isDev, 'data-inline-prose="block"')}>${rendered.html}</div>
      </section>`;
    }

    case 'timeline': {
      const items = Array.isArray(data.items) ? data.items : [];
      return `<section class="${secClass}"${secAttrs}>
        ${
          data.title || isDev
            ? `<div class="section-head"><div><h2 class="section-title"${devAttrs(isDev, 'data-editable="title"')}${!data.title && isDev ? ' data-empty-placeholder="true"' : ''}>${escapeHtml(data.title || '')}</h2>${data.subtitle || isDev ? `<p class="section-sub"${devAttrs(isDev, 'data-editable="subtitle"')}${!data.subtitle && isDev ? ' data-empty-placeholder="true"' : ''}>${escapeHtml(data.subtitle || '')}</p>` : ''}</div></div>`
            : ''
        }
        <div class="timeline"${devAttrs(isDev, 'data-sub-container="items"')}>
          ${items
            .map(
              (item, idx) => `<div class="timeline-item"${devAttrs(isDev, `data-sub-kind="timeline-item" data-sub-idx="${idx}"`)}>
                <div class="card-kicker">
                  <span${devAttrs(isDev, 'data-card-field="date"')}>${escapeHtml(item.date || '')}</span>
                  ${item.tag || isDev ? `<span class="pill pill-accent"${devAttrs(isDev, 'data-card-field="tag"')}${!item.tag && isDev ? ' data-empty-placeholder="true"' : ''}>${escapeHtml(item.tag || '')}</span>` : ''}
                </div>
                <h3 class="card-title"${devAttrs(isDev, 'data-card-field="title"')}>${escapeHtml(item.title || '')}</h3>
                ${item.detail || isDev ? `<p class="card-desc"${devAttrs(isDev, 'data-card-field="detail"')}${!item.detail && isDev ? ' data-empty-placeholder="true"' : ''}>${escapeHtml(item.detail || '')}</p>` : ''}
              </div>`
            )
            .join('\n')}
        </div>
      </section>`;
    }

    case 'links': {
      const items = Array.isArray(data.items) ? data.items : [];
      const cols = [2, 3, 4].includes(Number(data.columns)) ? Number(data.columns) : 3;
      return `<section class="${secClass}"${secAttrs}>
        ${
          data.title || isDev
            ? `<div class="section-head"><div><h2 class="section-title"${devAttrs(isDev, 'data-editable="title"')}${!data.title && isDev ? ' data-empty-placeholder="true"' : ''}>${escapeHtml(data.title || '')}</h2></div></div>`
            : ''
        }
        <div class="grid-${cols}"${devAttrs(isDev, 'data-sub-container="items"')}>
          ${items
            .map(
              (item, idx) => `<a class="card" href="${escapeHtml(item.url || '#')}" target="_blank" rel="noreferrer"${devAttrs(isDev, `data-sub-kind="link-item" data-sub-idx="${idx}" data-sub-href="${escapeHtml(item.url || '')}"`)}>
                <div class="card-kicker">
                  <span${devAttrs(isDev, 'data-card-field="badge"')}>${escapeHtml(item.badge || 'LINK')}</span>
                  <span>↗</span>
                </div>
                <h3 class="card-title"${devAttrs(isDev, 'data-card-field="name"')}>${escapeHtml(item.name || '')}</h3>
                ${item.desc || isDev ? `<p class="card-desc"${devAttrs(isDev, 'data-card-field="desc"')}${!item.desc && isDev ? ' data-empty-placeholder="true"' : ''}>${escapeHtml(item.desc || '')}</p>` : ''}
              </a>`
            )
            .join('\n')}
        </div>
      </section>`;
    }

    case 'stats': {
      const items = Array.isArray(data.items) ? data.items : [];
      const cols = [2, 3, 4].includes(Number(data.columns)) ? Number(data.columns) : 4;
      return `<section class="${secClass}"${secAttrs}>
        ${
          data.title || isDev
            ? `<div class="section-head"><div><h2 class="section-title"${devAttrs(isDev, 'data-editable="title"')}${!data.title && isDev ? ' data-empty-placeholder="true"' : ''}>${escapeHtml(data.title || '')}</h2></div></div>`
            : ''
        }
        <div class="grid-${cols}"${devAttrs(isDev, 'data-sub-container="items"')}>
          ${items
            .map(
              (item, idx) => `<div class="card"${devAttrs(isDev, `data-sub-kind="stat-item" data-sub-idx="${idx}"`)}>
                <div class="card-kicker"><span${devAttrs(isDev, 'data-card-field="label"')}>${escapeHtml(item.label || '')}</span></div>
                <div class="stat-value" style="margin-top:8px;"${devAttrs(isDev, 'data-card-field="value"')}>${escapeHtml(item.value || '')}</div>
                ${item.note || isDev ? `<p class="card-desc"${devAttrs(isDev, 'data-card-field="note"')}${!item.note && isDev ? ' data-empty-placeholder="true"' : ''}>${escapeHtml(item.note || '')}</p>` : ''}
              </div>`
            )
            .join('\n')}
        </div>
      </section>`;
    }

    case 'gallery': {
      const items = Array.isArray(data.items) ? data.items : [];
      const cols = [2, 3].includes(Number(data.columns)) ? Number(data.columns) : 2;
      return `<section class="${secClass}"${secAttrs}>
        ${
          data.title || isDev
            ? `<div class="section-head"><div><h2 class="section-title"${devAttrs(isDev, 'data-editable="title"')}${!data.title && isDev ? ' data-empty-placeholder="true"' : ''}>${escapeHtml(data.title || '')}</h2>${data.subtitle || isDev ? `<p class="section-sub"${devAttrs(isDev, 'data-editable="subtitle"')}${!data.subtitle && isDev ? ' data-empty-placeholder="true"' : ''}>${escapeHtml(data.subtitle || '')}</p>` : ''}</div></div>`
            : ''
        }
        <div class="grid-${cols}"${devAttrs(isDev, 'data-sub-container="items"')}>
          ${items
            .map((item, idx) => {
              const cardBody = `
                ${item.image ? `<img class="gallery-img" src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title || '')}" />` : isDev ? '<div class="gallery-img-empty">点击卡片设置图片</div>' : ''}
                ${item.tag || isDev ? `<div class="card-kicker"><span${devAttrs(isDev, 'data-card-field="tag"')}${!item.tag && isDev ? ' data-empty-placeholder="true"' : ''}>${escapeHtml(item.tag || '')}</span></div>` : ''}
                ${item.title || isDev ? `<h3 class="card-title"${devAttrs(isDev, 'data-card-field="title"')}>${escapeHtml(item.title || '')}</h3>` : ''}
                ${item.desc || isDev ? `<p class="card-desc"${devAttrs(isDev, 'data-card-field="desc"')}${!item.desc && isDev ? ' data-empty-placeholder="true"' : ''}>${escapeHtml(item.desc || '')}</p>` : ''}`;
              const subAttr = isDev
                ? ` data-sub-kind="gallery-item" data-sub-idx="${idx}" data-sub-image="${escapeHtml(item.image || '')}" data-sub-href="${escapeHtml(item.href || '')}"`
                : '';
              return item.href
                ? `<a class="card" href="${escapeHtml(item.href)}"${subAttr}>${cardBody}</a>`
                : `<div class="card"${subAttr}>${cardBody}</div>`;
            })
            .join('\n')}
        </div>
      </section>`;
    }

    case 'divider': {
      return `<section class="${secClass}"${secAttrs}>
        <div class="blk-divider">
          <span class="blk-divider-line"></span>
          ${data.label || isDev ? `<span${devAttrs(isDev, 'data-editable="label"')}${!data.label && isDev ? ' data-empty-placeholder="true"' : ''}>${escapeHtml(data.label || '')}</span><span class="blk-divider-line"></span>` : ''}
        </div>
      </section>`;
    }

    default:
      return '';
  }
}

export function renderShell({ site, pageTitle, description, currentRoute, bodyHtml, isDev = false, inlineCss = '', pageContext = null }) {
  const fullTitle = pageTitle ? `${pageTitle} · ${site.title}` : site.title;
  const colorMode = site.theme?.colorMode || 'auto';
  const nav = Array.isArray(site.nav) ? site.nav : [];
  const socials = Array.isArray(site.socials) ? site.socials : [];

  const isNavActive = (href) => {
    if (href === '/') return currentRoute === '/';
    return currentRoute === href || currentRoute.startsWith(`${href}/`);
  };

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(fullTitle)}</title>
  <meta name="description" content="${escapeHtml(description || site.tagline || '')}" />
  <link rel="alternate" type="application/rss+xml" title="${escapeHtml(site.title)}" href="/rss.xml" />
  ${inlineCss ? `<style>${inlineCss}</style>` : `<link rel="stylesheet" href="/styles.css" />`}
  ${isDev ? `<link rel="stylesheet" href="/__inline-editor.css" />` : ''}
  <script>
    (() => {
      const mode = localStorage.getItem('site-theme-mode') || ${JSON.stringify(colorMode)};
      const dark = mode === 'dark' || (mode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      if (dark) document.documentElement.classList.add('dark');
    })();
  </script>
</head>
<body>
  <header class="site-header">
    <div class="container header-inner">
      <a class="brand" href="/">
        <span class="brand-mark"${devAttrs(isDev, 'data-inline-brand-mark')}>${escapeHtml(site.brandMark || 'C')}</span>
        <span${devAttrs(isDev, 'data-inline-brand')}>${escapeHtml(site.brandName || site.title)}</span>
      </a>
      <div class="header-right">
        <nav class="nav-links" aria-label="主导航"${devAttrs(isDev, 'data-inline-nav')}>
          ${nav
            .map(
              (item, idx) =>
                `<a class="nav-link ${isNavActive(item.href) ? 'active' : ''}" href="${escapeHtml(item.href)}"${devAttrs(isDev, `data-inline-nav-idx="${idx}"`)}>${escapeHtml(item.label)}</a>`
            )
            .join('')}
        </nav>
        ${
          site.theme?.showSearch !== false
            ? `<button id="open-cmd" type="button" class="icon-btn" title="全站搜索 (Ctrl+K)">
          <span>搜索</span>
          <span style="opacity:0.65;font-family:var(--font-mono);">⌘K</span>
        </button>`
            : ''
        }
        ${site.theme?.showThemeToggle !== false ? `<button id="toggle-theme" type="button" class="icon-btn" title="切换深浅色">◐</button>` : ''}
      </div>
    </div>
  </header>

  <main class="site-main">
    <div class="container">
      ${bodyHtml}
    </div>
  </main>

  <footer class="site-footer">
    <div class="container footer-inner">
      <span>© ${new Date().getFullYear()} <span${devAttrs(isDev, 'data-inline-brand-copy')}>${escapeHtml(site.brandName || '')}</span> · <span${devAttrs(isDev, 'data-inline-footer')}>${escapeHtml(site.footerText || '')}</span></span>
      <div class="footer-links"${devAttrs(isDev, 'data-inline-socials')}>
        ${socials
          .map((s, idx) => {
            const external = /^https?:\/\//i.test(s.url || '');
            return `<a href="${escapeHtml(s.url || '#')}" ${external ? 'target="_blank" rel="noreferrer"' : ''}${devAttrs(isDev, `data-inline-social-idx="${idx}"`)}>${escapeHtml(s.label)}</a>`;
          })
          .join('')}
      </div>
    </div>
  </footer>

  <div id="cmd-backdrop" class="cmd-backdrop" aria-hidden="true">
    <div class="cmd-dialog" role="dialog" aria-label="全站搜索">
      <input id="cmd-input" class="cmd-input" type="text" placeholder="搜索文章、作品或页面…" autocomplete="off" />
      <div id="cmd-results" class="cmd-results"></div>
    </div>
  </div>

  <script>
    (() => {
      document.getElementById('toggle-theme')?.addEventListener('click', () => {
        const isDark = document.documentElement.classList.toggle('dark');
        localStorage.setItem('site-theme-mode', isDark ? 'dark' : 'light');
      });

      document.querySelectorAll('.copy-code-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const code = btn.closest('.code-block')?.querySelector('code')?.innerText || '';
          await navigator.clipboard.writeText(code);
          const old = btn.textContent;
          btn.textContent = '已复制';
          setTimeout(() => { btn.textContent = old; }, 1400);
        });
      });

      const backdrop = document.getElementById('cmd-backdrop');
      const input = document.getElementById('cmd-input');
      const results = document.getElementById('cmd-results');
      let searchItems = null;

      function renderResults(q = '') {
        if (!results || !searchItems) return;
        const term = q.trim().toLowerCase();
        const matched = searchItems.filter((item) =>
          !term ||
          item.title.toLowerCase().includes(term) ||
          (item.summary || '').toLowerCase().includes(term) ||
          (item.tags || []).some((t) => t.toLowerCase().includes(term))
        ).slice(0, 12);

        results.innerHTML = matched.length
          ? matched.map((item) =>
              '<a class="cmd-item" href="' + item.route + '"><span>' +
              item.title.replace(/</g, '&lt;') +
              '</span><span class="cmd-meta">' +
              (item.group || '').replace(/</g, '&lt;') +
              '</span></a>'
            ).join('')
          : '<div style="padding:14px;font-size:13px;color:var(--muted);">没有找到匹配内容</div>';
      }

      async function openSearch() {
        backdrop?.classList.add('open');
        if (!searchItems) {
          try {
            const res = await fetch('/search.json');
            searchItems = await res.json();
          } catch { searchItems = []; }
        }
        renderResults(input?.value || '');
        setTimeout(() => input?.focus(), 20);
      }

      function closeSearch() {
        backdrop?.classList.remove('open');
      }

      document.getElementById('open-cmd')?.addEventListener('click', openSearch);
      backdrop?.addEventListener('click', (e) => { if (e.target === backdrop) closeSearch(); });
      input?.addEventListener('input', (e) => renderResults(e.target.value));
      window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
          e.preventDefault();
          backdrop?.classList.contains('open') ? closeSearch() : openSearch();
        } else if (e.key === 'Escape') {
          closeSearch();
        }
      });

      // Scroll-reveal entrance animation observer
      const animEls = document.querySelectorAll('[data-anim]');
      if (animEls.length) {
        document.documentElement.classList.add('js-anim');
        if ('IntersectionObserver' in window) {
          const io = new IntersectionObserver(
            (entries) => {
              entries.forEach((entry) => {
                if (entry.isIntersecting) {
                  entry.target.classList.add('is-visible');
                  io.unobserve(entry.target);
                }
              });
            },
            { threshold: 0.08, rootMargin: '0px 0px -20px 0px' }
          );
          animEls.forEach((el) => io.observe(el));
        } else {
          animEls.forEach((el) => el.classList.add('is-visible'));
        }
      }
    })();
  </script>
  ${
    isDev
      ? `<script id="__page-context" type="application/json">${safeJsonForHtml(pageContext || { kind: 'other', route: currentRoute })}</script>
  <script src="/__inline-editor.js" defer></script>
  <script>
    (() => {
      const es = new EventSource('/__livereload');
      es.onmessage = (e) => {
        if (e.data === 'reload' && !(window.__INLINE_SKIP_RELOAD_UNTIL__ && Date.now() < window.__INLINE_SKIP_RELOAD_UNTIL__)) {
          location.reload();
        }
      };
    })();
  </script>`
      : ''
  }
</body>
</html>`;
}

export function renderPage(page, workspace, options = {}) {
  const isDev = Boolean(options.isDev);
  const relatedCountMap = buildRelatedCountMap(workspace.collections);
  let bodyHtml = '';

  if (page.kind === 'blocks') {
    const blocksHtml = (page.blocks || [])
      .map((block, idx) => renderBlock(block, workspace, relatedCountMap, idx, isDev))
      .join('\n');
    bodyHtml = `<div class="blocks-canvas"${devAttrs(isDev, 'data-blocks-canvas')}>${blocksHtml}</div>`;
  } else {
    const rendered = renderMarkdown(page.body || '');
    bodyHtml = `<article>
      <header class="page-header">
        <h1 class="hero-title" style="margin-top:0;"${devAttrs(isDev, 'data-inline-page-title')}>${escapeHtml(page.title)}</h1>
        ${page.description || isDev ? `<p class="hero-sub"${devAttrs(isDev, 'data-inline-page-desc')}${!page.description && isDev ? ' data-empty-placeholder="true"' : ''}>${escapeHtml(page.description || '')}</p>` : ''}
      </header>
      <div class="prose"${devAttrs(isDev, 'data-inline-prose="page"')}>${rendered.html}</div>
    </article>`;
  }

  return renderShell({
    site: workspace.site,
    pageTitle: page.slug === 'home' ? '' : page.title,
    description: page.description || workspace.site.tagline,
    currentRoute: page.route,
    bodyHtml,
    pageContext: {
      kind: 'page',
      slug: page.slug,
      pageKind: page.kind,
      route: page.route,
    },
    ...options,
  });
}

export function renderCollectionIndex(collection, workspace, options = {}) {
  const isDev = Boolean(options.isDev);
  const relatedCountMap = buildRelatedCountMap(workspace.collections);
  const items = isDev ? collection.items : collection.items.filter((i) => !i.data.draft);
  const visibleCount = collection.items.filter((i) => !i.data.draft).length;
  const allTags = Array.from(new Set(items.flatMap((i) => i.data.tags || []))).sort((a, b) =>
    a.localeCompare(b, 'zh-CN')
  );

  const views = {
    grid: renderCollectionItems(items, collection, 'grid', relatedCountMap, isDev),
    list: renderCollectionItems(items, collection, 'list', relatedCountMap, isDev),
    timeline: renderCollectionItems(items, collection, 'timeline', relatedCountMap, isDev),
  };

  const bodyHtml = `
    <header class="page-header">
      <h1 class="hero-title" style="margin-top:0;"${devAttrs(isDev, 'data-inline-col-title')}>${escapeHtml(collection.title)}</h1>
      ${collection.description || isDev ? `<p class="hero-sub"${devAttrs(isDev, 'data-inline-col-desc')}${!collection.description && isDev ? ' data-empty-placeholder="true"' : ''}>${escapeHtml(collection.description || '')}</p>` : ''}
      <div class="toolbar-row">
        <div class="filter-pills" id="tag-filters">
          <button type="button" class="filter-btn active" data-tag="all">全部 (${visibleCount})</button>
          ${allTags
            .map((t) => `<button type="button" class="filter-btn" data-tag="${escapeHtml(t)}">#${escapeHtml(t)}</button>`)
            .join('')}
        </div>
        <div class="filter-pills" id="view-switcher">
          <button type="button" class="filter-btn ${collection.defaultView === 'grid' ? 'active' : ''}" data-view="grid">网格</button>
          <button type="button" class="filter-btn ${collection.defaultView === 'list' ? 'active' : ''}" data-view="list">列表</button>
          <button type="button" class="filter-btn ${collection.defaultView === 'timeline' ? 'active' : ''}" data-view="timeline">时间轴</button>
        </div>
      </div>
    </header>

    <div id="view-grid" class="${collection.defaultView === 'grid' ? '' : 'hidden'}">${views.grid}</div>
    <div id="view-list" class="${collection.defaultView === 'list' ? '' : 'hidden'}">${views.list}</div>
    <div id="view-timeline" class="${collection.defaultView === 'timeline' ? '' : 'hidden'}">${views.timeline}</div>

    <script>
      (() => {
        const tagBtns = document.querySelectorAll('#tag-filters .filter-btn');
        const viewBtns = document.querySelectorAll('#view-switcher .filter-btn');
        const views = {
          grid: document.getElementById('view-grid'),
          list: document.getElementById('view-list'),
          timeline: document.getElementById('view-timeline'),
        };

        tagBtns.forEach((btn) => {
          btn.addEventListener('click', () => {
            const tag = btn.getAttribute('data-tag');
            tagBtns.forEach((b) => b.classList.toggle('active', b === btn));
            document.querySelectorAll('[data-tags]').forEach((el) => {
              const tags = (el.getAttribute('data-tags') || '').split(',').filter(Boolean);
              el.classList.toggle('hidden', tag !== 'all' && !tags.includes(tag));
            });
          });
        });

        viewBtns.forEach((btn) => {
          btn.addEventListener('click', () => {
            const target = btn.getAttribute('data-view');
            viewBtns.forEach((b) => b.classList.toggle('active', b === btn));
            Object.entries(views).forEach(([name, el]) => {
              el?.classList.toggle('hidden', name !== target);
            });
          });
        });
      })();
    </script>`;

  return renderShell({
    site: workspace.site,
    pageTitle: collection.title,
    description: collection.description,
    currentRoute: collection.route,
    bodyHtml,
    pageContext: {
      kind: 'collection',
      id: collection.id,
      route: collection.route,
    },
    ...options,
  });
}

export function renderCollectionItem(item, collection, workspace, options = {}) {
  const isDev = Boolean(options.isDev);
  const items = collection.items.filter((i) => !i.data.draft);
  const idx = items.findIndex((i) => i.slug === item.slug);
  const prevItem = idx >= 0 ? items[idx + 1] : null;
  const nextItem = idx > 0 ? items[idx - 1] : null;
  const rendered = renderMarkdown(item.body || '');

  // Bidirectional cross-collection references
  const allItemsByRef = new Map();
  for (const col of workspace.collections) {
    for (const entry of col.items) {
      if (!entry.data.draft) allItemsByRef.set(entry.ref, entry);
    }
  }

  const relatedRefs = new Set(Array.isArray(item.data.related) ? item.data.related : []);
  for (const entry of allItemsByRef.values()) {
    if ((entry.data.related || []).includes(item.ref)) {
      relatedRefs.add(entry.ref);
    }
  }
  relatedRefs.delete(item.ref);
  const relatedItems = Array.from(relatedRefs)
    .map((ref) => allItemsByRef.get(ref))
    .filter(Boolean);

  const statusLabel = item.data.status ? STATUS_LABELS[item.data.status] || item.data.status : '';
  const tags = Array.isArray(item.data.tags) ? item.data.tags : [];
  const SYSTEM_KEYS = new Set([
    'title',
    'summary',
    'description',
    'date',
    'updated',
    'status',
    'tags',
    'related',
    'repoUrl',
    'demoUrl',
    'order',
    'featured',
    'draft',
  ]);
  const customEntries = Object.entries(item.data || {}).filter(
    ([k, v]) => !SYSTEM_KEYS.has(k) && v !== undefined && v !== null && v !== ''
  );

  const bodyHtml = `<article>
    <a class="back-link" href="${escapeHtml(collection.route)}">← 返回 ${escapeHtml(collection.title)}</a>

    <header class="page-header">
      <div class="card-kicker" style="justify-content:flex-start; gap:10px; flex-wrap:wrap;">
        ${item.data.date ? `<time>${escapeHtml(item.data.date)}</time>` : ''}
        <span>约 ${rendered.readingMinutes} 分钟阅读</span>
        ${statusLabel ? `<span class="pill pill-accent">${escapeHtml(statusLabel)}</span>` : ''}
      </div>
      <h1 class="hero-title"${devAttrs(isDev, 'data-inline-item-title')}>${escapeHtml(item.title)}</h1>
      ${item.summary || isDev ? `<p class="hero-sub"${devAttrs(isDev, 'data-inline-item-summary')}${!item.summary && isDev ? ' data-empty-placeholder="true"' : ''}>${escapeHtml(item.summary || '')}</p>` : ''}
      ${
        tags.length > 0 || isDev
          ? `<div class="tag-row"${devAttrs(isDev, 'data-inline-tags')}>${tags.map((t) => `<span class="pill">#${escapeHtml(t)}</span>`).join('')}</div>`
          : ''
      }
      ${
        customEntries.length > 0
          ? `<div class="meta-kv-grid">${customEntries
              .map(
                ([k, v]) =>
                  `<div class="meta-kv-item"><span>${escapeHtml(k)}</span><strong>${escapeHtml(Array.isArray(v) ? v.join(' / ') : String(v))}</strong></div>`
              )
              .join('')}</div>`
          : ''
      }
      ${
        item.data.repoUrl || item.data.demoUrl
          ? `<div class="hero-actions" style="margin-top:18px;">
              ${item.data.demoUrl ? `<a class="btn btn-primary" href="${escapeHtml(item.data.demoUrl)}" target="_blank" rel="noreferrer">在线演示 ↗</a>` : ''}
              ${item.data.repoUrl ? `<a class="btn" href="${escapeHtml(item.data.repoUrl)}" target="_blank" rel="noreferrer">源码仓库 ↗</a>` : ''}
            </div>`
          : ''
      }
    </header>

    ${
      rendered.headings.length > 1
        ? `<details open class="toc-box">
            <summary>目录大纲</summary>
            <ul class="toc-list">
              ${rendered.headings
                .map(
                  (h) =>
                    `<li class="depth-${h.depth}"><a href="#${escapeHtml(h.slug)}">${escapeHtml(h.text)}</a></li>`
                )
                .join('')}
            </ul>
          </details>`
        : ''
    }

    <div class="prose"${devAttrs(isDev, 'data-inline-prose="item"')}>${rendered.html}</div>

    ${
      relatedItems.length > 0
        ? `<section class="block-section" style="margin-top:48px; padding-top:28px; border-top:1px solid var(--border);">
            <div class="section-head">
              <div>
                <h2 class="section-title">关联内容</h2>
                <p class="section-sub">与本条目双向关联的项目或文章</p>
              </div>
            </div>
            <div class="grid-2">
              ${relatedItems
                .map(
                  (rel) => `<a class="card" href="${escapeHtml(rel.route)}">
                    <div class="card-kicker"><span>${escapeHtml(rel.collection)}</span><span>→</span></div>
                    <h3 class="card-title">${escapeHtml(rel.title)}</h3>
                    ${rel.summary ? `<p class="card-desc">${escapeHtml(rel.summary)}</p>` : ''}
                  </a>`
                )
                .join('')}
            </div>
          </section>`
        : ''
    }

    ${
      prevItem || nextItem
        ? `<nav class="grid-2" style="margin-top:44px; padding-top:24px; border-top:1px solid var(--border);" aria-label="上下篇">
            <div>${
              prevItem
                ? `<a class="card" href="${escapeHtml(prevItem.route)}"><div class="card-kicker"><span>← 上一条</span></div><div style="margin-top:6px;font-weight:700;">${escapeHtml(prevItem.title)}</div></a>`
                : ''
            }</div>
            <div>${
              nextItem
                ? `<a class="card" style="text-align:right;" href="${escapeHtml(nextItem.route)}"><div class="card-kicker" style="justify-content:flex-end;"><span>下一条 →</span></div><div style="margin-top:6px;font-weight:700;">${escapeHtml(nextItem.title)}</div></a>`
                : ''
            }</div>
          </nav>`
        : ''
    }
  </article>`;

  return renderShell({
    site: workspace.site,
    pageTitle: item.title,
    description: item.summary,
    currentRoute: item.route,
    bodyHtml,
    pageContext: {
      kind: 'item',
      collection: collection.id,
      slug: item.slug,
      route: item.route,
    },
    ...options,
  });
}

export function renderNotFound(workspace, options = {}) {
  const { notFoundPath = '', inlineCss, ...shellOptions } = options;
  const displayPath = notFoundPath || '/404';

  const pageDestinations = (workspace.pages || []).map((p) => ({
    title: p.title || p.slug,
    sub: p.route,
    href: p.route,
  }));
  const colDestinations = (workspace.collections || []).map((c) => {
    const count = (c.items || []).filter((i) => !i.data.draft).length;
    return {
      title: c.title || c.id,
      sub: `${c.route} · ${count} 篇`,
      href: c.route,
    };
  });
  const destinations = [...pageDestinations, ...colDestinations];

  const recentItems = (workspace.collections || [])
    .flatMap((c) =>
      (c.items || [])
        .filter((i) => !i.data.draft)
        .map((i) => ({ ...i, collectionTitle: c.title || c.id }))
    )
    .sort((a, b) => String(b.data.date || '').localeCompare(String(a.data.date || '')))
    .slice(0, 4);

  const searchBtnHtml =
    workspace.site?.theme?.showSearch !== false
      ? `<button type="button" class="btn btn-ghost" onclick="document.getElementById('open-cmd')?.click()">全站搜索 ⌘K</button>`
      : '';

  const directoryHtml = destinations.length
    ? `<section class="not-found-directory">
        <div class="not-found-dir-head"><span>站内直达</span></div>
        <div class="not-found-grid">
          ${destinations
            .map(
              (d) => `<a class="not-found-link-card" href="${escapeHtml(d.href)}">
              <div class="nf-card-main">
                <span class="nf-card-title">${escapeHtml(d.title)}</span>
                <span class="nf-card-sub">${escapeHtml(d.sub)}</span>
              </div>
              <span class="nf-card-arrow">→</span>
            </a>`
            )
            .join('\n          ')}
        </div>
      </section>`
    : '';

  const recentHtml = recentItems.length
    ? `<section class="not-found-directory">
        <div class="not-found-dir-head"><span>最近发布</span></div>
        <div class="not-found-recent">
          ${recentItems
            .map(
              (item) => `<a class="not-found-recent-row" href="${escapeHtml(item.route)}">
              <span class="nf-recent-title">${escapeHtml(item.title)}</span>
              <span class="nf-recent-meta">${escapeHtml(item.collectionTitle)}${item.data.date ? ` · ${escapeHtml(item.data.date)}` : ''}</span>
            </a>`
            )
            .join('\n          ')}
        </div>
      </section>`
    : '';

  const bodyHtml = `<div class="not-found-wrap">
    <section class="not-found-hero">
      <div class="hero-badge"><span class="hero-dot"></span><span>HTTP 404 · Not Found</span></div>
      <div class="not-found-code" aria-hidden="true">404</div>
      <h1 class="not-found-title">哎呀，这页走丢了</h1>
      <p class="not-found-desc">当前路径不存在、已被移动或尚未发布。你可以返回上一页，或从下方入口继续浏览。</p>
      <div class="not-found-path" title="请求路径">
        <span>路径</span>
        <code id="nf-path">${escapeHtml(displayPath)}</code>
      </div>
      <div class="not-found-actions">
        <a class="btn btn-primary" href="/">返回首页</a>
        <button type="button" class="btn btn-ghost" onclick="if(history.length>1){history.back();}else{location.href='/';}">← 返回上一页</button>
        ${searchBtnHtml}
      </div>
    </section>
    ${directoryHtml}
    ${recentHtml}
    ${
      notFoundPath
        ? ''
        : `<script>
      (() => {
        const el = document.getElementById('nf-path');
        if (el && location.pathname && location.pathname !== '/404.html') {
          el.textContent = location.pathname;
        }
      })();
    </script>`
    }
  </div>`;

  return renderShell({
    site: workspace.site,
    pageTitle: '404 · 页面未找到',
    description: '页面未找到',
    currentRoute: '/404',
    bodyHtml,
    inlineCss: inlineCss ?? generateThemeCss(workspace.site.theme),
    pageContext: {
      kind: 'not-found',
      route: displayPath,
    },
    ...shellOptions,
  });
}

export function buildSearchIndex(workspace) {
  const records = [];
  for (const page of workspace.pages) {
    records.push({
      title: page.title,
      summary: page.description || '',
      route: page.route,
      group: '页面',
      tags: [],
    });
  }
  for (const col of workspace.collections) {
    records.push({
      title: col.title,
      summary: col.description || '',
      route: col.route,
      group: '栏目',
      tags: [],
    });
    for (const item of col.items) {
      if (item.data.draft) continue;
      records.push({
        title: item.title,
        summary: item.summary,
        route: item.route,
        group: col.title,
        tags: item.data.tags || [],
      });
    }
  }
  return records;
}

export function buildRssXml(workspace) {
  const baseUrl = String(workspace.site.siteUrl || 'https://example.com').replace(/\/+$/, '');
  const datedItems = [];
  for (const col of workspace.collections) {
    for (const item of col.items) {
      if (item.data.draft || !item.data.date) continue;
      datedItems.push(item);
    }
  }
  datedItems.sort((a, b) => String(b.data.date).localeCompare(String(a.data.date)));

  const xmlItems = datedItems
    .slice(0, 30)
    .map(
      (item) => `<item>
      <title>${escapeHtml(item.title)}</title>
      <link>${escapeHtml(baseUrl + item.route)}</link>
      <guid>${escapeHtml(baseUrl + item.route)}</guid>
      <pubDate>${new Date(item.data.date).toUTCString()}</pubDate>
      <description>${escapeHtml(item.summary || item.title)}</description>
    </item>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
  <channel>
    <title>${escapeHtml(workspace.site.title)}</title>
    <link>${escapeHtml(baseUrl)}</link>
    <description>${escapeHtml(workspace.site.tagline || '')}</description>
    ${xmlItems}
  </channel>
</rss>\n`;
}
