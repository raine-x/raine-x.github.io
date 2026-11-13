(() => {
  if (window.__INLINE_EDITOR_BOOTSTRAPPED__) return;
  window.__INLINE_EDITOR_BOOTSTRAPPED__ = true;

  const BLOCK_CATALOG = [
    {
      type: 'hero',
      title: 'Hero 主视觉',
      desc: '顶部标题、副标题、徽章与双行动按钮',
      create: () => ({
        id: uid('hero'),
        type: 'hero',
        data: {
          badge: 'NEW SECTION',
          title: '在这里写下你的核心标题',
          subtitle: '一段简洁清晰的介绍文字，点击即可直接编辑。',
          align: 'left',
          primaryBtn: { label: '了解更多', href: '/about' },
          secondaryBtn: { label: '', href: '' },
        },
      }),
    },
    {
      type: 'bento',
      title: 'Bento 卡片网格',
      desc: '可调 2 / 3 / 4 列自由卡片、双倍宽跨列与链接',
      create: () => ({
        id: uid('bento'),
        type: 'bento',
        data: {
          title: '核心亮点',
          columns: 3,
          cards: [
            { label: '01', value: '轻量高自由', note: '点开卡片就能改文字和链接', href: '' },
            { label: '02', value: '纯静态导出', note: '构建产物零编辑器脚本', href: '' },
            { label: '03', value: '任意扩展', note: '支持拖拽排序与增删改', href: '' },
          ],
        },
      }),
    },
    {
      type: 'collection-feed',
      title: '栏目内容流',
      desc: '自动抓取某个栏目的文章或作品列表',
      create: (ws) => {
        const firstCol = ws.collections[0];
        return {
          id: uid('feed'),
          type: 'collection-feed',
          data: {
            title: firstCol ? firstCol.title : '最新内容',
            subtitle: '按当前栏目自动汇总展示',
            collection: firstCol ? firstCol.id : 'posts',
            view: firstCol ? firstCol.defaultView : 'grid',
            columns: 2,
            limit: 4,
            featuredOnly: false,
            tagFilter: '',
            moreLabel: '查看全部',
            moreHref: firstCol ? firstCol.route : '/',
          },
        };
      },
    },
    {
      type: 'markdown',
      title: 'Markdown 文档块',
      desc: '自由排版文本、代码高亮、Callout 与截图',
      create: () => ({
        id: uid('md'),
        type: 'markdown',
        data: {
          title: '图文随笔',
          body: '双击或点击右上角按钮即可就地编辑 **Markdown**，支持同步滚动预览与 `Ctrl+V` 粘贴截图。\n\n> [!TIP]\n> 这里是任意自由组合的内容块。',
        },
      }),
    },
    {
      type: 'timeline',
      title: '时间轴节点',
      desc: '展示里程碑、更新日志或个人经历',
      create: () => ({
        id: uid('timeline'),
        type: 'timeline',
        data: {
          title: '阶段历程',
          subtitle: '',
          items: [
            { date: '2026-11', tag: '上线', title: '新节点标题', detail: '点击可以直接修改详细描述。' },
          ],
        },
      }),
    },
    {
      type: 'links',
      title: '常用链接墙',
      desc: '聚合友链、常用工具或项目入口（2-4列可调）',
      create: () => ({
        id: uid('links'),
        type: 'links',
        data: {
          title: '常用导航',
          columns: 3,
          items: [
            { badge: 'SITE', name: '示例链接', desc: '点击右上角🔗编辑网址', url: 'https://example.com' },
          ],
        },
      }),
    },
    {
      type: 'stats',
      title: '数据指标卡',
      desc: '2-4 列数字概览，适合状态或统计信息',
      create: () => ({
        id: uid('stats'),
        type: 'stats',
        data: {
          title: '关键指标',
          columns: 4,
          items: [
            { label: '文章', value: '12', note: '持续更新中' },
            { label: '作品', value: '04', note: '开源与实验' },
          ],
        },
      }),
    },
    {
      type: 'gallery',
      title: '图片画廊',
      desc: '支持上传本地图片或填写网络图链接',
      create: () => ({
        id: uid('gallery'),
        type: 'gallery',
        data: {
          title: '视觉画廊',
          subtitle: '',
          columns: 2,
          items: [
            { tag: 'SHOT', title: '作品截图', desc: '点击卡片右上角🖼设置图片', image: '', href: '' },
          ],
        },
      }),
    },
    {
      type: 'divider',
      title: '分割线 / 留白',
      desc: '分隔内容章节或调整页面节奏，支持可选文字',
      create: () => ({
        id: uid('div'),
        type: 'divider',
        data: { label: 'SECTION' },
      }),
    },
  ];

  const TYPE_LABELS = Object.fromEntries(BLOCK_CATALOG.map((b) => [b.type, b.title]));
  const ACCENT_SWATCHES = ['#ea580c', '#2563eb', '#059669', '#7c3aed', '#db2777', '#d97706', '#0891b2', '#18181b'];
  const SPAN_LABELS = { 12: '全宽', 8: '2/3宽', 6: '1/2并排', 4: '1/3并排' };

  let workspace = null;
  let pageContext = readPageContext();
  let editMode = sessionStorage.getItem('inline-edit-mode') === '1';
  let dirty = false;
  let activeDrawer = null; // 'left' | 'theme' | 'nav' | null
  let dragSourceIdx = null;
  let activePopover = null;
  let activeModal = null;
  let activeMdCleanup = null;
  let editAbort = null;

  function uid(prefix) {
    return `${prefix}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function editSignal() {
    if (!editAbort) editAbort = new AbortController();
    return editAbort.signal;
  }

  function readPageContext() {
    try {
      const el = document.getElementById('__page-context');
      return el ? JSON.parse(el.textContent || '{}') : { kind: 'other', route: location.pathname };
    } catch {
      return { kind: 'other', route: location.pathname };
    }
  }

  function escHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function toast(msg) {
    document.querySelectorAll('.ie-toast').forEach((n) => n.remove());
    const el = document.createElement('div');
    el.className = 'ie-toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }

  function closePopover() {
    if (activePopover) {
      activePopover.remove();
      activePopover = null;
    }
  }

  function closeModal() {
    if (activeModal) {
      activeModal.remove();
      activeModal = null;
    }
  }

  async function api(url, method = 'GET', body = null) {
    window.__INLINE_SKIP_RELOAD_UNTIL__ = Date.now() + 2600;
    const opts = { method, headers: {} };
    if (body !== null) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(url, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `请求失败 (${res.status})`);
    return data;
  }

  async function loadState() {
    workspace = await api('/api/studio/state');
    return workspace;
  }

  function getCurrentPageModel() {
    if (!workspace || pageContext.kind !== 'page') return null;
    return workspace.pages.find((p) => p.slug === pageContext.slug) || null;
  }

  function getCurrentCollectionModel() {
    if (!workspace || pageContext.kind !== 'collection') return null;
    return workspace.collections.find((c) => c.id === pageContext.id) || null;
  }

  function getCurrentItemModel() {
    if (!workspace || pageContext.kind !== 'item') return null;
    const col = workspace.collections.find((c) => c.id === pageContext.collection);
    if (!col) return null;
    return col.items.find((i) => i.slug === pageContext.slug) || null;
  }

  function setDirty(val) {
    dirty = val;
    const dot = document.getElementById('ie-status-dot');
    const txt = document.getElementById('ie-status-text');
    if (dot) dot.classList.toggle('dirty', dirty);
    if (txt) txt.textContent = dirty ? '未保存' : '已保存';
  }

  async function saveCurrentEntity({ refreshAfter = false, silent = false } = {}) {
    if (!workspace) return;
    if (pageContext.kind === 'page') {
      const page = getCurrentPageModel();
      if (page) {
        await api(`/api/studio/pages/${encodeURIComponent(page.slug)}`, 'PUT', {
          kind: page.kind,
          title: page.title,
          description: page.description,
          blocks: page.blocks,
          data: page.data,
          body: page.body,
        });
      }
    } else if (pageContext.kind === 'collection') {
      const col = getCurrentCollectionModel();
      if (col) {
        await api(`/api/studio/collections/${encodeURIComponent(col.id)}`, 'PUT', {
          title: col.title,
          description: col.description,
          defaultView: col.defaultView,
          itemPrefix: col.itemPrefix,
          sortBy: col.sortBy,
        });
      }
    } else if (pageContext.kind === 'item') {
      const item = getCurrentItemModel();
      if (item) {
        await api(
          `/api/studio/items/${encodeURIComponent(item.collection)}/${encodeURIComponent(item.slug)}`,
          'PUT',
          { data: item.data, body: item.body }
        );
      }
    }
    setDirty(false);
    if (!silent) toast('已保存到本地文件');
    if (refreshAfter) {
      await refreshMainFromServer();
    } else if (activeDrawer === 'left') {
      renderDrawers();
    }
  }

  async function saveSite({ refreshCss = false, refreshChrome = false, silent = true } = {}) {
    if (!workspace) return;
    await api('/api/studio/site', 'PUT', workspace.site);
    if (refreshCss) {
      const link = document.querySelector('link[href^="/styles.css"]');
      if (link) link.href = `/styles.css?t=${Date.now()}`;
    }
    if (refreshChrome) {
      await refreshMainFromServer();
    }
    setDirty(false);
    if (!silent) toast('站点设置已保存');
  }

  function applyBlockClassesToDom(secEl, block) {
    if (!secEl || !block) return;
    const st = block.style || {};
    const span = [4, 6, 8, 12].includes(Number(st.span)) ? Number(st.span) : 12;
    const classes = ['block-section', `blk-span-${span}`];
    if (span === 12) {
      if (st.width === 'compact') classes.push('blk-w-compact');
      else if (st.width === 'wide') classes.push('blk-w-wide');
    }
    if (st.spacing === 'tight') classes.push('blk-sp-tight');
    else if (st.spacing === 'spacious') classes.push('blk-sp-spacious');
    if (['surface', 'subtle', 'accent', 'outline'].includes(st.surface)) classes.push(`blk-bg-${st.surface}`);
    if (st.align === 'center') classes.push('blk-align-center');
    if (['sm', 'lg'].includes(st.scale)) classes.push(`blk-scale-${st.scale}`);
    if (secEl.classList.contains('ie-block-selected')) classes.push('ie-block-selected');
    secEl.className = classes.join(' ');
  }

  function replayBlockAnimation(secEl, animName) {
    if (!secEl) return;
    const resolved = animName === 'inherit'
      ? (workspace?.site?.theme?.motion && workspace.site.theme.motion !== 'none' ? workspace.site.theme.motion : '')
      : (animName && animName !== 'none' ? animName : '');
    secEl.removeAttribute('data-anim');
    secEl.classList.remove('is-visible');
    if (!resolved) return;
    void secEl.offsetWidth;
    secEl.setAttribute('data-anim', resolved);
    secEl.classList.add('is-visible');
  }

  async function refreshMainFromServer() {
    closePopover();
    if (activeMdCleanup) {
      activeMdCleanup();
      activeMdCleanup = null;
    }
    teardownEditMode();

    const res = await fetch(location.href, { cache: 'no-store' });
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');

    const newMain = doc.querySelector('main.site-main');
    const curMain = document.querySelector('main.site-main');
    if (newMain && curMain) {
      curMain.innerHTML = newMain.innerHTML;
      curMain.querySelectorAll('script').forEach((oldScript) => {
        const s = document.createElement('script');
        s.textContent = oldScript.textContent;
        oldScript.replaceWith(s);
      });
    }

    const newHeader = doc.querySelector('header.site-header');
    const curHeader = document.querySelector('header.site-header');
    if (newHeader && curHeader) curHeader.innerHTML = newHeader.innerHTML;

    const newFooter = doc.querySelector('footer.site-footer');
    const curFooter = document.querySelector('footer.site-footer');
    if (newFooter && curFooter) curFooter.innerHTML = newFooter.innerHTML;

    const newCtxEl = doc.getElementById('__page-context');
    const curCtxEl = document.getElementById('__page-context');
    if (newCtxEl && curCtxEl) curCtxEl.textContent = newCtxEl.textContent;
    pageContext = readPageContext();

    // Ensure revealed animations trigger on freshly swapped DOM in Preview Mode
    document.querySelectorAll('[data-anim]').forEach((el) => el.classList.add('is-visible'));

    document.querySelectorAll('.copy-code-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const code = btn.closest('.code-block')?.querySelector('code')?.innerText || '';
        await navigator.clipboard.writeText(code);
        btn.textContent = '已复制';
        setTimeout(() => { btn.textContent = '复制'; }, 1400);
      });
    });
    document.getElementById('toggle-theme')?.addEventListener('click', () => {
      const isDark = document.documentElement.classList.toggle('dark');
      localStorage.setItem('site-theme-mode', isDark ? 'dark' : 'light');
    });
    document.getElementById('open-cmd')?.addEventListener('click', () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
    });

    await loadState();
    renderDrawers();
    if (editMode) {
      decorateEditMode();
    }
  }

  // ---------- Persistent Bottom Capsule Dock & 3 Split Drawers ----------
  let dockEl = null;
  let leftDrawerEl = null;
  let rightDrawerEl = null;

  function buildChrome() {
    dockEl = document.createElement('div');
    dockEl.className = 'ie-dock';
    document.body.appendChild(dockEl);

    leftDrawerEl = document.createElement('aside');
    leftDrawerEl.className = 'ie-drawer left hidden-drawer';
    document.body.appendChild(leftDrawerEl);

    rightDrawerEl = document.createElement('aside');
    rightDrawerEl.className = 'ie-drawer right hidden-drawer';
    document.body.appendChild(rightDrawerEl);

    renderDock();
  }

  function renderDock() {
    if (!dockEl) return;
    if (!editMode) {
      dockEl.innerHTML = `
        <button type="button" class="ie-dock-btn primary" id="ie-toggle-mode" title="Ctrl+E 切换编辑模式">
          <span>✏️</span>
          <span>编辑此页</span>
        </button>
      `;
    } else {
      const page = getCurrentPageModel();
      const canAddBlock = page && page.kind === 'blocks';
      const isCollection = pageContext.kind === 'collection';
      dockEl.innerHTML = `
        <button type="button" class="ie-dock-btn primary" id="ie-toggle-mode" title="Ctrl+E 保存并回到纯预览模式">
          <span>👁</span>
          <span>退出编辑 (预览)</span>
        </button>
        <div class="ie-dock-sep"></div>
        <button type="button" class="ie-dock-btn ${activeDrawer === 'left' ? 'active' : ''}" id="ie-btn-dir">
          <span>📁</span>
          <span>页面与模块</span>
        </button>
        <button type="button" class="ie-dock-btn ${activeDrawer === 'theme' ? 'active' : ''}" id="ie-btn-theme">
          <span>🎨</span>
          <span>外观与动效</span>
        </button>
        <button type="button" class="ie-dock-btn ${activeDrawer === 'nav' ? 'active' : ''}" id="ie-btn-nav">
          <span>🧭</span>
          <span>导航与页脚</span>
        </button>
        ${
          canAddBlock
            ? `<button type="button" class="ie-dock-btn" id="ie-btn-add-block"><span>＋</span><span>添加模块</span></button>`
            : ''
        }
        ${
          isCollection
            ? `<button type="button" class="ie-dock-btn" id="ie-btn-new-item"><span>＋</span><span>新建条目</span></button>`
            : ''
        }
        <div class="ie-dock-sep"></div>
        <button type="button" class="ie-dock-btn" id="ie-btn-save" title="Ctrl+S 立即保存">
          <span class="ie-status-dot ${dirty ? 'dirty' : ''}" id="ie-status-dot"></span>
          <span id="ie-status-text">${dirty ? '未保存' : '已保存'}</span>
        </button>
        <button type="button" class="ie-dock-btn" id="ie-btn-build" title="导出纯静态站点到 dist/">
          <span>📦</span>
          <span>导出</span>
        </button>
      `;
    }

    document.getElementById('ie-toggle-mode')?.addEventListener('click', () => setEditMode(!editMode));
    document.getElementById('ie-btn-dir')?.addEventListener('click', () => toggleDrawer('left'));
    document.getElementById('ie-btn-theme')?.addEventListener('click', () => toggleDrawer('theme'));
    document.getElementById('ie-btn-nav')?.addEventListener('click', () => toggleDrawer('nav'));
    document.getElementById('ie-btn-add-block')?.addEventListener('click', () => {
      const page = getCurrentPageModel();
      if (page) openBlockPickerModal((page.blocks || []).length);
    });
    document.getElementById('ie-btn-new-item')?.addEventListener('click', () => {
      openNewItemModal(pageContext.id);
    });
    document.getElementById('ie-btn-save')?.addEventListener('click', async () => {
      try {
        await saveCurrentEntity();
        await saveSite({ silent: true });
      } catch (err) {
        toast(err.message);
      }
    });
    document.getElementById('ie-btn-build')?.addEventListener('click', async () => {
      try {
        if (dirty) await saveCurrentEntity({ silent: true });
        const res = await api('/api/studio/build', 'POST', {});
        toast(`静态构建完成：${res.pageCount} 个页面（${res.durationMs}ms）-> dist/`);
      } catch (err) {
        toast(err.message);
      }
    });
  }

  function toggleDrawer(name) {
    activeDrawer = activeDrawer === name ? null : name;
    renderDrawers();
    renderDock();
  }

  async function setEditMode(next) {
    if (!next) {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      if (dirty) {
        try {
          await saveCurrentEntity({ silent: true });
          await saveSite({ silent: true });
        } catch (err) {
          toast(err.message);
        }
      }
    }

    editMode = next;
    sessionStorage.setItem('inline-edit-mode', editMode ? '1' : '0');
    document.body.classList.toggle('inline-edit-active', editMode);

    if (!editMode) {
      activeDrawer = null;
      teardownEditMode();
      renderDrawers();
      renderDock();
      await refreshMainFromServer();
    } else {
      await loadState();
      decorateEditMode();
      renderDrawers();
      renderDock();
    }
  }

  // ---------- 3 Separated Drawers: [📁 页面与模块] / [🎨 外观与动效] / [🧭 导航与页脚] ----------
  function renderDrawers() {
    if (!leftDrawerEl || !rightDrawerEl || !workspace) return;
    leftDrawerEl.classList.toggle('hidden-drawer', !editMode || activeDrawer !== 'left');
    rightDrawerEl.classList.toggle('hidden-drawer', !editMode || (activeDrawer !== 'theme' && activeDrawer !== 'nav'));

    if (!editMode) return;

    if (activeDrawer === 'left') {
      renderLeftDrawer();
    } else if (activeDrawer === 'theme') {
      renderThemeDrawer();
    } else if (activeDrawer === 'nav') {
      renderNavDrawer();
    }
  }

  function renderLeftDrawer() {
    const curPage = getCurrentPageModel();
    const curCol = getCurrentCollectionModel();
    let currentSectionHtml = '';

    if (curPage && curPage.kind === 'blocks') {
      const blocks = curPage.blocks || [];
      currentSectionHtml = `
        <div style="border:1px solid var(--ie-border); border-radius:12px; padding:10px; background:var(--ie-surface-soft);">
          <div class="ie-group-title" style="margin-bottom:8px;">
            <span>🧩 本页模块管理 (${blocks.length})</span>
            <button type="button" class="ie-mini-btn active" id="ie-cur-add-blk">＋ 添加</button>
          </div>
          ${
            blocks.length === 0
              ? `<div style="font-size:12px; color:var(--ie-muted); padding:8px 4px;">当前页面还没有模块，点击右上角「＋ 添加」开始排版。</div>`
              : `<div style="display:flex; flex-direction:column; gap:6px;">
                  ${blocks
                    .map((b, i) => {
                      const title = b.data?.title || b.data?.label || TYPE_LABELS[b.type] || b.type;
                      const span = [4, 6, 8, 12].includes(Number(b.style?.span)) ? Number(b.style.span) : 12;
                      return `<div style="border:1px solid var(--ie-border); border-radius:9px; padding:7px 8px; background:var(--ie-surface-solid); display:flex; flex-direction:column; gap:5px;">
                        <div style="display:flex; align-items:center; justify-content:space-between; gap:4px;">
                          <button type="button" data-focus-blk="${i}" style="border:none;background:none;padding:0;text-align:left;cursor:pointer;color:var(--ie-text);font-size:12px;font-weight:600;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                            ${b.hidden ? '🙈 ' : ''}${escHtml(TYPE_LABELS[b.type] || b.type)} · ${escHtml(title)}
                          </button>
                          <span class="ie-badge ie-badge-muted" style="font-size:10px;padding:2px 5px;">${SPAN_LABELS[span]}</span>
                        </div>
                        <div style="display:flex; align-items:center; gap:4px;">
                          <select class="ie-mini-select" data-tree-span="${i}" style="font-size:11px;padding:2px 5px;" title="布局宽度">
                            <option value="12" ${span === 12 ? 'selected' : ''}>全宽 1/1</option>
                            <option value="6" ${span === 6 ? 'selected' : ''}>并排 1/2</option>
                            <option value="4" ${span === 4 ? 'selected' : ''}>并排 1/3</option>
                            <option value="8" ${span === 8 ? 'selected' : ''}>占 2/3</option>
                          </select>
                          <div class="ie-spacer"></div>
                          <button type="button" class="ie-mini-btn" data-tree-up="${i}" ${i === 0 ? 'disabled' : ''}>↑</button>
                          <button type="button" class="ie-mini-btn" data-tree-dn="${i}" ${i === blocks.length - 1 ? 'disabled' : ''}>↓</button>
                          <button type="button" class="ie-mini-btn" data-tree-hide="${i}">${b.hidden ? '显' : '隐'}</button>
                          <button type="button" class="ie-mini-btn danger" data-tree-del="${i}">✕</button>
                        </div>
                      </div>`;
                    })
                    .join('')}
                </div>`
          }
        </div>
      `;
    } else if (curCol) {
      currentSectionHtml = `
        <div style="border:1px solid var(--ie-border); border-radius:12px; padding:10px; background:var(--ie-surface-soft);">
          <div class="ie-group-title" style="margin-bottom:6px;">
            <span>🗂 本栏目条目 (${curCol.items.length})</span>
            <button type="button" class="ie-mini-btn active" data-add-in-col="${escHtml(curCol.id)}">＋ 新建</button>
          </div>
          <div style="font-size:12px; color:var(--ie-muted);">可在网页顶栏直接修改视图（网格/列表/时间轴）或删除条目。</div>
        </div>
      `;
    }

    leftDrawerEl.innerHTML = `
      <div class="ie-drawer-head">
        <span>📁 页面与模块</span>
        <button type="button" class="ie-mini-btn" id="ie-close-left">✕</button>
      </div>
      <div class="ie-drawer-body">
        ${currentSectionHtml}
        <div>
          <div class="ie-group-title">
            <span>独立页面 (${workspace.pages.length})</span>
            <button type="button" class="ie-mini-btn" id="ie-new-page">+ 新页面</button>
          </div>
          <div style="display:flex; flex-direction:column; gap:4px;">
            ${workspace.pages
              .map(
                (p) => `<div style="display:flex; align-items:center; gap:4px;">
                  <a class="ie-tree-item ${location.pathname === p.route ? 'current' : ''}" style="flex:1;" href="${escHtml(p.route)}">
                    <span>${p.kind === 'blocks' ? '🧱' : '📄'} ${escHtml(p.title)}</span>
                    <span style="font-size:11px; color:var(--ie-muted);">${escHtml(p.route)}</span>
                  </a>
                  ${
                    p.slug !== 'home'
                      ? `<button type="button" class="ie-mini-btn danger" data-del-page="${escHtml(p.slug)}" title="删除页面">✕</button>`
                      : ''
                  }
                </div>`
              )
              .join('')}
          </div>
        </div>

        <div>
          <div class="ie-group-title">
            <span>自定义栏目 (${workspace.collections.length})</span>
            <button type="button" class="ie-mini-btn" id="ie-new-col">+ 新栏目</button>
          </div>
          <div style="display:flex; flex-direction:column; gap:8px;">
            ${workspace.collections
              .map(
                (c) => `<div style="border:1px solid var(--ie-border); border-radius:10px; padding:8px;">
                  <div style="display:flex; align-items:center; gap:4px;">
                    <a class="ie-tree-item ${location.pathname === c.route ? 'current' : ''}" style="flex:1; font-weight:600;" href="${escHtml(c.route)}">
                      <span>🗂 ${escHtml(c.title)} (${c.items.length})</span>
                    </a>
                    <button type="button" class="ie-mini-btn" data-add-in-col="${escHtml(c.id)}" title="新建条目">＋</button>
                    <button type="button" class="ie-mini-btn danger" data-del-col="${escHtml(c.id)}" title="删除栏目">✕</button>
                  </div>
                  <div style="display:flex; flex-direction:column; gap:2px; margin-top:4px; padding-left:8px;">
                    ${c.items
                      .map(
                        (item) => `<a class="ie-tree-item ${location.pathname === item.route ? 'current' : ''}" href="${escHtml(item.route)}" style="padding:5px 8px; font-size:12px;">
                          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${item.data.draft ? '[草稿] ' : ''}${escHtml(item.title)}</span>
                        </a>`
                      )
                      .join('')}
                  </div>
                </div>`
              )
              .join('')}
          </div>
        </div>
      </div>
    `;

    leftDrawerEl.querySelector('#ie-close-left')?.addEventListener('click', () => toggleDrawer('left'));
    leftDrawerEl.querySelector('#ie-cur-add-blk')?.addEventListener('click', () => {
      if (curPage) openBlockPickerModal((curPage.blocks || []).length);
    });
    leftDrawerEl.querySelector('#ie-new-page')?.addEventListener('click', openNewPageModal);
    leftDrawerEl.querySelector('#ie-new-col')?.addEventListener('click', openNewCollectionModal);

    // Block quick controls inside current page list
    if (curPage && curPage.kind === 'blocks') {
      const blocks = curPage.blocks;
      leftDrawerEl.querySelectorAll('[data-focus-blk]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const i = Number(btn.getAttribute('data-focus-blk'));
          const secEl = document.querySelector(`[data-block-idx="${i}"]`);
          if (secEl) {
            secEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            secEl.classList.add('ie-block-pulse');
            setTimeout(() => secEl.classList.remove('ie-block-pulse'), 1400);
          }
        });
      });
      leftDrawerEl.querySelectorAll('[data-tree-span]').forEach((sel) => {
        sel.addEventListener('change', async () => {
          const i = Number(sel.getAttribute('data-tree-span'));
          blocks[i].style = blocks[i].style || {};
          blocks[i].style.span = Number(sel.value);
          const secEl = document.querySelector(`[data-block-idx="${i}"]`);
          applyBlockClassesToDom(secEl, blocks[i]);
          await saveCurrentEntity({ silent: true });
          renderDrawers();
        });
      });
      leftDrawerEl.querySelectorAll('[data-tree-up]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const i = Number(btn.getAttribute('data-tree-up'));
          if (i <= 0) return;
          [blocks[i - 1], blocks[i]] = [blocks[i], blocks[i - 1]];
          await saveCurrentEntity({ refreshAfter: true });
        });
      });
      leftDrawerEl.querySelectorAll('[data-tree-dn]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const i = Number(btn.getAttribute('data-tree-dn'));
          if (i >= blocks.length - 1) return;
          [blocks[i], blocks[i + 1]] = [blocks[i + 1], blocks[i]];
          await saveCurrentEntity({ refreshAfter: true });
        });
      });
      leftDrawerEl.querySelectorAll('[data-tree-hide]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const i = Number(btn.getAttribute('data-tree-hide'));
          blocks[i].hidden = !blocks[i].hidden;
          await saveCurrentEntity({ refreshAfter: true });
        });
      });
      leftDrawerEl.querySelectorAll('[data-tree-del]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const i = Number(btn.getAttribute('data-tree-del'));
          if (!confirm('确定移除此模块吗？')) return;
          blocks.splice(i, 1);
          await saveCurrentEntity({ refreshAfter: true });
        });
      });
    }

    leftDrawerEl.querySelectorAll('[data-add-in-col]').forEach((btn) => {
      btn.addEventListener('click', () => openNewItemModal(btn.getAttribute('data-add-in-col')));
    });
    leftDrawerEl.querySelectorAll('[data-del-page]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const slug = btn.getAttribute('data-del-page');
        if (!confirm(`确定删除页面 "${slug}" 吗？`)) return;
        await api(`/api/studio/pages/${encodeURIComponent(slug)}`, 'DELETE');
        toast(`已删除页面 ${slug}`);
        if (location.pathname === `/${slug}`) location.href = '/';
        else {
          await loadState();
          renderDrawers();
        }
      });
    });
    leftDrawerEl.querySelectorAll('[data-del-col]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-del-col');
        if (!confirm(`确定删除栏目 "${id}" 及其全部内容吗？`)) return;
        await api(`/api/studio/collections/${encodeURIComponent(id)}`, 'DELETE');
        toast(`已删除栏目 ${id}`);
        if (location.pathname.startsWith(`/${id}`)) location.href = '/';
        else {
          await loadState();
          renderDrawers();
        }
      });
    });
  }

  function renderThemeDrawer() {
    const site = workspace.site;
    const theme = site.theme || (site.theme = {});
    const customColors = theme.customColors || (theme.customColors = {});
    const curWidth = parseInt(String(theme.maxWidth || '960px'), 10) || 960;
    const curRadius = parseInt(String(theme.radius ?? '10px'), 10) || 0;
    const curFontSize = parseInt(String(theme.fontSize || '16px'), 10) || 16;

    const presets = [
      { id: 'lab', name: 'Lab 实验研报', desc: '方正硬朗 · 等宽细节' },
      { id: 'paper', name: 'Paper 杂志阅读', desc: '暖白衬线 · 长文舒适' },
      { id: 'bento', name: 'Bento 圆润卡片', desc: '轻量通透 · 现代网格' },
      { id: 'mono', name: 'Mono 极简黑白', desc: '冷静克制 · 高对比' },
    ];

    rightDrawerEl.innerHTML = `
      <div class="ie-drawer-head">
        <span>🎨 外观、配色与动效</span>
        <button type="button" class="ie-mini-btn" id="ie-close-right">✕</button>
      </div>
      <div class="ie-drawer-body">
        <div>
          <div class="ie-group-title"><span>视觉预设</span></div>
          <div class="ie-preset-grid">
            ${presets
              .map(
                (pr) => `<button type="button" class="ie-preset-card ${theme.preset === pr.id ? 'active' : ''}" data-preset="${pr.id}">
                  <div>${pr.name}</div>
                  <div style="font-size:11px; color:var(--ie-muted); margin-top:2px;">${pr.desc}</div>
                </button>`
              )
              .join('')}
          </div>
        </div>

        <div>
          <div class="ie-group-title"><span>强调色</span></div>
          <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
            ${ACCENT_SWATCHES.map(
              (hex) => `<button type="button" data-swatch="${hex}" title="${hex}" style="width:22px;height:22px;border-radius:999px;border:${theme.accent === hex ? '2px solid var(--ie-text)' : '1px solid var(--ie-border)'};background:${hex};cursor:pointer;padding:0;"></button>`
            ).join('')}
            <input type="color" class="ie-input" id="ie-theme-accent" value="${escHtml(theme.accent || '#ea580c')}" style="width:36px;height:26px;padding:2px;" title="自定义任意颜色" />
          </div>
        </div>

        <div class="ie-inline-grid" style="grid-template-columns:1fr 1fr;">
          <div class="ie-field">
            <label>默认明暗</label>
            <select class="ie-select" id="ie-theme-mode">
              <option value="auto" ${theme.colorMode === 'auto' ? 'selected' : ''}>跟随系统</option>
              <option value="light" ${theme.colorMode === 'light' ? 'selected' : ''}>明亮</option>
              <option value="dark" ${theme.colorMode === 'dark' ? 'selected' : ''}>深色</option>
            </select>
          </div>
          <div class="ie-field">
            <label>字体族</label>
            <select class="ie-select" id="ie-theme-font">
              <option value="sans" ${theme.font === 'sans' ? 'selected' : ''}>现代无衬线</option>
              <option value="serif" ${theme.font === 'serif' ? 'selected' : ''}>人文衬线</option>
              <option value="mono" ${theme.font === 'mono' ? 'selected' : ''}>等宽极客</option>
            </select>
          </div>
          <div class="ie-field">
            <label>页面宽度 (<span id="ie-lbl-w">${curWidth}px</span>)</label>
            <input type="range" id="ie-theme-width" min="720" max="1400" step="20" value="${curWidth}" />
          </div>
          <div class="ie-field">
            <label>圆角大小 (<span id="ie-lbl-r">${curRadius}px</span>)</label>
            <input type="range" id="ie-theme-radius" min="0" max="28" step="2" value="${curRadius}" />
          </div>
          <div class="ie-field">
            <label>基础字号 (<span id="ie-lbl-fs">${curFontSize}px</span>)</label>
            <input type="range" id="ie-theme-fsize" min="14" max="20" step="1" value="${curFontSize}" />
          </div>
          <div class="ie-field">
            <label>背景底纹</label>
            <select class="ie-select" id="ie-theme-bg">
              <option value="none" ${theme.bgPattern === 'none' ? 'selected' : ''}>纯净空白</option>
              <option value="dots" ${theme.bgPattern === 'dots' ? 'selected' : ''}>细腻点阵</option>
              <option value="grid" ${theme.bgPattern === 'grid' ? 'selected' : ''}>工程网格</option>
              <option value="gradient" ${theme.bgPattern === 'gradient' ? 'selected' : ''}>柔和极光</option>
            </select>
          </div>
          <div class="ie-field">
            <label>卡片样式</label>
            <select class="ie-select" id="ie-theme-card">
              <option value="border" ${theme.cardStyle === 'border' ? 'selected' : ''}>细描边</option>
              <option value="shadow" ${theme.cardStyle === 'shadow' ? 'selected' : ''}>柔和阴影</option>
              <option value="glass" ${theme.cardStyle === 'glass' ? 'selected' : ''}>毛玻璃</option>
              <option value="flat" ${theme.cardStyle === 'flat' ? 'selected' : ''}>极简底色</option>
            </select>
          </div>
          <div class="ie-field">
            <label>卡片悬停反馈</label>
            <select class="ie-select" id="ie-theme-lift">
              <option value="1" ${theme.hoverLift !== false ? 'selected' : ''}>轻盈上浮</option>
              <option value="0" ${theme.hoverLift === false ? 'selected' : ''}>静态保持</option>
            </select>
          </div>
        </div>

        <div style="border:1px solid var(--ie-border); border-radius:10px; padding:10px; background:var(--ie-surface-soft);">
          <div class="ie-group-title" style="margin-bottom:6px;">
            <span>✨ 全站入场动效</span>
            <button type="button" class="ie-mini-btn" id="ie-replay-all-anim">▶ 预览动效</button>
          </div>
          <select class="ie-select" id="ie-theme-motion">
            <option value="none" ${!theme.motion || theme.motion === 'none' ? 'selected' : ''}>无入场动画（瞬间出现）</option>
            <option value="fade-up" ${theme.motion === 'fade-up' ? 'selected' : ''}>柔和上浮淡入 (Fade Up)</option>
            <option value="fade-in" ${theme.motion === 'fade-in' ? 'selected' : ''}>平滑渐显 (Fade In)</option>
            <option value="scale-in" ${theme.motion === 'scale-in' ? 'selected' : ''}>轻盈缩放进入 (Scale In)</option>
            <option value="slide-left" ${theme.motion === 'slide-left' ? 'selected' : ''}>右侧滑入 (Slide Left)</option>
            <option value="blur-in" ${theme.motion === 'blur-in' ? 'selected' : ''}>景深聚焦渐清 (Blur In)</option>
          </select>
        </div>

        <details style="border:1px solid var(--ie-border); border-radius:10px; padding:10px;">
          <summary style="cursor:pointer; font-size:12px; font-weight:600;">自定义色板 & 全局 CSS</summary>
          <div class="ie-inline-grid" style="grid-template-columns:1fr 1fr; margin-top:10px;">
            <div class="ie-field"><label>浅色背景</label><input type="text" class="ie-input" id="ie-cc-bg" placeholder="预设" value="${escHtml(customColors.bg || customColors.lightBg || '')}" /></div>
            <div class="ie-field"><label>浅色卡片</label><input type="text" class="ie-input" id="ie-cc-surface" placeholder="预设" value="${escHtml(customColors.surface || '')}" /></div>
            <div class="ie-field"><label>浅色文字</label><input type="text" class="ie-input" id="ie-cc-text" placeholder="预设" value="${escHtml(customColors.text || customColors.lightFg || '')}" /></div>
            <div class="ie-field"><label>浅色边框</label><input type="text" class="ie-input" id="ie-cc-border" placeholder="预设" value="${escHtml(customColors.border || '')}" /></div>
            <div class="ie-field"><label>深色背景</label><input type="text" class="ie-input" id="ie-cc-dbg" placeholder="预设" value="${escHtml(customColors.darkBg || '')}" /></div>
            <div class="ie-field"><label>深色卡片</label><input type="text" class="ie-input" id="ie-cc-dsurf" placeholder="预设" value="${escHtml(customColors.darkSurface || '')}" /></div>
            <div class="ie-field"><label>深色文字</label><input type="text" class="ie-input" id="ie-cc-dtext" placeholder="预设" value="${escHtml(customColors.darkText || customColors.darkFg || '')}" /></div>
            <div class="ie-field"><label>深色边框</label><input type="text" class="ie-input" id="ie-cc-dbord" placeholder="预设" value="${escHtml(customColors.darkBorder || '')}" /></div>
          </div>
          <div style="margin-top:8px; display:flex; justify-content:flex-end;">
            <button type="button" class="ie-mini-btn" id="ie-cc-reset">重置为预设颜色</button>
          </div>
          <div class="ie-field" style="margin-top:8px;">
            <label>自定义全局 CSS</label>
            <textarea class="ie-textarea" rows="3" id="ie-custom-css" placeholder=".hero-title { letter-spacing: -0.02em; }">${escHtml(theme.customCss || '')}</textarea>
          </div>
        </details>
      </div>
    `;

    rightDrawerEl.querySelector('#ie-close-right')?.addEventListener('click', () => toggleDrawer('theme'));

    const applyThemeChange = async (reRender = false) => {
      await saveSite({ refreshCss: true, silent: true });
      if (reRender) renderThemeDrawer();
    };

    rightDrawerEl.querySelectorAll('[data-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        theme.preset = btn.getAttribute('data-preset');
        applyThemeChange(true);
      });
    });

    rightDrawerEl.querySelectorAll('[data-swatch]').forEach((btn) => {
      btn.addEventListener('click', () => {
        theme.accent = btn.getAttribute('data-swatch');
        document.documentElement.style.setProperty('--accent', theme.accent);
        applyThemeChange(true);
      });
    });

    // Live CSS-var preview on slider drag + save on change
    const wireRange = (id, lblId, cssVar, setter) => {
      const inp = rightDrawerEl.querySelector(id);
      const lbl = rightDrawerEl.querySelector(lblId);
      inp?.addEventListener('input', (e) => {
        const val = `${e.target.value}px`;
        if (lbl) lbl.textContent = val;
        document.documentElement.style.setProperty(cssVar, val);
      });
      inp?.addEventListener('change', (e) => {
        setter(`${e.target.value}px`);
        applyThemeChange(false);
      });
    };
    wireRange('#ie-theme-width', '#ie-lbl-w', '--max-width', (v) => { theme.maxWidth = v; });
    wireRange('#ie-theme-radius', '#ie-lbl-r', '--radius', (v) => { theme.radius = v; });
    wireRange('#ie-theme-fsize', '#ie-lbl-fs', '--font-size', (v) => { theme.fontSize = v; });

    rightDrawerEl.querySelector('#ie-theme-accent')?.addEventListener('input', (e) => {
      document.documentElement.style.setProperty('--accent', e.target.value);
    });
    rightDrawerEl.querySelector('#ie-theme-accent')?.addEventListener('change', (e) => {
      theme.accent = e.target.value;
      applyThemeChange(true);
    });

    const bindSel = (id, setter) => {
      rightDrawerEl.querySelector(id)?.addEventListener('change', (e) => {
        setter(e.target.value);
        applyThemeChange(false);
      });
    };
    bindSel('#ie-theme-mode', (v) => {
      theme.colorMode = v;
      if (v === 'dark') document.documentElement.classList.add('dark');
      else if (v === 'light') document.documentElement.classList.remove('dark');
    });
    bindSel('#ie-theme-font', (v) => { theme.font = v; });
    bindSel('#ie-theme-bg', (v) => { theme.bgPattern = v; });
    bindSel('#ie-theme-card', (v) => { theme.cardStyle = v; });
    bindSel('#ie-theme-lift', (v) => { theme.hoverLift = v !== '0'; });

    rightDrawerEl.querySelector('#ie-theme-motion')?.addEventListener('change', async (e) => {
      theme.motion = e.target.value;
      await applyThemeChange(false);
      document.querySelectorAll('[data-block-idx]').forEach((el) => replayBlockAnimation(el, theme.motion));
    });
    rightDrawerEl.querySelector('#ie-replay-all-anim')?.addEventListener('click', () => {
      document.querySelectorAll('[data-block-idx]').forEach((el, i) => {
        setTimeout(() => replayBlockAnimation(el, theme.motion || 'fade-up'), i * 60);
      });
    });

    bindSel('#ie-cc-bg', (v) => { customColors.bg = v.trim(); delete customColors.lightBg; });
    bindSel('#ie-cc-surface', (v) => { customColors.surface = v.trim(); });
    bindSel('#ie-cc-text', (v) => { customColors.text = v.trim(); delete customColors.lightFg; });
    bindSel('#ie-cc-border', (v) => { customColors.border = v.trim(); });
    bindSel('#ie-cc-dbg', (v) => { customColors.darkBg = v.trim(); });
    bindSel('#ie-cc-dsurf', (v) => { customColors.darkSurface = v.trim(); });
    bindSel('#ie-cc-dtext', (v) => { customColors.darkText = v.trim(); delete customColors.darkFg; });
    bindSel('#ie-cc-dbord', (v) => { customColors.darkBorder = v.trim(); });
    rightDrawerEl.querySelector('#ie-cc-reset')?.addEventListener('click', () => {
      theme.customColors = {};
      applyThemeChange(true);
    });
    bindSel('#ie-custom-css', (v) => { theme.customCss = v; });
  }

  function renderNavDrawer() {
    const site = workspace.site;
    const theme = site.theme || (site.theme = {});
    const routeOptions = [
      ...workspace.pages.map((p) => ({ label: p.title, href: p.route })),
      ...workspace.collections.map((c) => ({ label: c.title, href: c.route })),
    ];

    rightDrawerEl.innerHTML = `
      <div class="ie-drawer-head">
        <span>🧭 导航、品牌与页脚</span>
        <button type="button" class="ie-mini-btn" id="ie-close-nav">✕</button>
      </div>
      <div class="ie-drawer-body">
        <div class="ie-inline-grid" style="grid-template-columns:1fr 2fr;">
          <div class="ie-field">
            <label>Logo 字符</label>
            <input type="text" class="ie-input" id="ie-brand-mark" value="${escHtml(site.brandMark || 'C')}" maxlength="4" />
          </div>
          <div class="ie-field">
            <label>个人名 / 品牌名</label>
            <input type="text" class="ie-input" id="ie-brand-name" value="${escHtml(site.brandName || '')}" />
          </div>
        </div>
        <div class="ie-field">
          <label>站点标题 (浏览器标签)</label>
          <input type="text" class="ie-input" id="ie-site-title" value="${escHtml(site.title || '')}" />
        </div>

        <div class="ie-field">
          <label>顶栏布局风格</label>
          <select class="ie-select" id="ie-theme-hstyle">
            <option value="split" ${theme.headerStyle !== 'centered' && theme.headerStyle !== 'minimal' ? 'selected' : ''}>左右两端对齐</option>
            <option value="centered" ${theme.headerStyle === 'centered' ? 'selected' : ''}>居中堆叠</option>
            <option value="minimal" ${theme.headerStyle === 'minimal' ? 'selected' : ''}>极简无边框</option>
          </select>
        </div>

        <div style="display:flex; flex-wrap:wrap; gap:12px; font-size:12px;">
          <label style="display:inline-flex; gap:5px; align-items:center; cursor:pointer;">
            <input type="checkbox" id="ie-theme-sticky" ${theme.headerSticky !== false ? 'checked' : ''} /> 顶栏吸顶
          </label>
          <label style="display:inline-flex; gap:5px; align-items:center; cursor:pointer;">
            <input type="checkbox" id="ie-theme-search" ${theme.showSearch !== false ? 'checked' : ''} /> 显示搜索
          </label>
          <label style="display:inline-flex; gap:5px; align-items:center; cursor:pointer;">
            <input type="checkbox" id="ie-theme-toggle" ${theme.showThemeToggle !== false ? 'checked' : ''} /> 深浅按钮
          </label>
        </div>

        <div>
          <div class="ie-group-title">
            <span>顶部导航菜单</span>
            <button type="button" class="ie-mini-btn" id="ie-add-nav">+ 自定义项</button>
          </div>
          <div style="display:flex; gap:6px; margin-bottom:8px;">
            <select class="ie-select" id="ie-nav-quick-pick" style="font-size:12px;">
              <option value="">快速加入已有页面/栏目…</option>
              ${routeOptions.map((r) => `<option value="${escHtml(r.href)}|${escHtml(r.label)}">${escHtml(r.label)} (${escHtml(r.href)})</option>`).join('')}
            </select>
          </div>
          <div style="display:flex; flex-direction:column; gap:6px;">
            ${(site.nav || [])
              .map(
                (item, idx) => `<div style="display:flex; gap:4px; align-items:center;">
                  <input type="text" class="ie-input" style="flex:1;" data-nav-label="${idx}" value="${escHtml(item.label)}" placeholder="名称" />
                  <input type="text" class="ie-input" style="flex:1.1;" data-nav-href="${idx}" value="${escHtml(item.href)}" placeholder="/path" />
                  <button type="button" class="ie-mini-btn" data-nav-up="${idx}" ${idx === 0 ? 'disabled' : ''}>↑</button>
                  <button type="button" class="ie-mini-btn danger" data-nav-del="${idx}">✕</button>
                </div>`
              )
              .join('')}
          </div>
        </div>

        <div>
          <div class="ie-group-title">
            <span>页脚链接（也可直接点击页脚 GitHub/Email 修改）</span>
            <button type="button" class="ie-mini-btn" id="ie-add-social">+ 添加</button>
          </div>
          <div style="display:flex; flex-direction:column; gap:6px;">
            ${(site.socials || [])
              .map(
                (s, idx) => `<div style="display:flex; gap:4px; align-items:center;">
                  <input type="text" class="ie-input" style="flex:1;" data-soc-label="${idx}" value="${escHtml(s.label)}" placeholder="名称" />
                  <input type="text" class="ie-input" style="flex:1.3;" data-soc-url="${idx}" value="${escHtml(s.url)}" placeholder="https://..." />
                  <button type="button" class="ie-mini-btn danger" data-soc-del="${idx}">✕</button>
                </div>`
              )
              .join('')}
          </div>
        </div>

        <div class="ie-field">
          <label>页脚版权说明 (footerText)</label>
          <input type="text" class="ie-input" id="ie-site-footer" value="${escHtml(site.footerText || '')}" />
        </div>
      </div>
    `;

    rightDrawerEl.querySelector('#ie-close-nav')?.addEventListener('click', () => toggleDrawer('nav'));

    const applyNavChange = async (needCss = false) => {
      await saveSite({ refreshCss: needCss, refreshChrome: true, silent: true });
      renderNavDrawer();
    };

    rightDrawerEl.querySelector('#ie-theme-hstyle')?.addEventListener('change', (e) => {
      theme.headerStyle = e.target.value;
      applyNavChange(true);
    });
    rightDrawerEl.querySelector('#ie-theme-sticky')?.addEventListener('change', (e) => {
      theme.headerSticky = e.target.checked;
      applyNavChange(true);
    });
    rightDrawerEl.querySelector('#ie-theme-search')?.addEventListener('change', (e) => {
      theme.showSearch = e.target.checked;
      applyNavChange(false);
    });
    rightDrawerEl.querySelector('#ie-theme-toggle')?.addEventListener('change', (e) => {
      theme.showThemeToggle = e.target.checked;
      applyNavChange(false);
    });

    rightDrawerEl.querySelector('#ie-brand-mark')?.addEventListener('change', (e) => {
      site.brandMark = e.target.value;
      applyNavChange(false);
    });
    rightDrawerEl.querySelector('#ie-brand-name')?.addEventListener('change', (e) => {
      site.brandName = e.target.value;
      applyNavChange(false);
    });
    rightDrawerEl.querySelector('#ie-site-title')?.addEventListener('change', (e) => {
      site.title = e.target.value;
      applyNavChange(false);
    });
    rightDrawerEl.querySelector('#ie-site-footer')?.addEventListener('change', (e) => {
      site.footerText = e.target.value;
      applyNavChange(false);
    });

    rightDrawerEl.querySelector('#ie-nav-quick-pick')?.addEventListener('change', (e) => {
      const val = e.target.value;
      if (!val) return;
      const [href, label] = val.split('|');
      site.nav = site.nav || [];
      site.nav.push({ label, href });
      applyNavChange(false);
    });
    rightDrawerEl.querySelector('#ie-add-nav')?.addEventListener('click', () => {
      site.nav = site.nav || [];
      site.nav.push({ label: '新链接', href: '/' });
      applyNavChange(false);
    });
    rightDrawerEl.querySelectorAll('[data-nav-label]').forEach((inp) => {
      inp.addEventListener('change', (e) => {
        site.nav[Number(inp.getAttribute('data-nav-label'))].label = e.target.value;
        applyNavChange(false);
      });
    });
    rightDrawerEl.querySelectorAll('[data-nav-href]').forEach((inp) => {
      inp.addEventListener('change', (e) => {
        site.nav[Number(inp.getAttribute('data-nav-href'))].href = e.target.value;
        applyNavChange(false);
      });
    });
    rightDrawerEl.querySelectorAll('[data-nav-up]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-nav-up'));
        if (idx > 0) {
          [site.nav[idx - 1], site.nav[idx]] = [site.nav[idx], site.nav[idx - 1]];
          applyNavChange(false);
        }
      });
    });
    rightDrawerEl.querySelectorAll('[data-nav-del]').forEach((btn) => {
      btn.addEventListener('click', () => {
        site.nav.splice(Number(btn.getAttribute('data-nav-del')), 1);
        applyNavChange(false);
      });
    });

    rightDrawerEl.querySelector('#ie-add-social')?.addEventListener('click', () => {
      site.socials = site.socials || [];
      site.socials.push({ label: 'Link', url: 'https://' });
      applyNavChange(false);
    });
    rightDrawerEl.querySelectorAll('[data-soc-label]').forEach((inp) => {
      inp.addEventListener('change', (e) => {
        site.socials[Number(inp.getAttribute('data-soc-label'))].label = e.target.value;
        applyNavChange(false);
      });
    });
    rightDrawerEl.querySelectorAll('[data-soc-url]').forEach((inp) => {
      inp.addEventListener('change', (e) => {
        site.socials[Number(inp.getAttribute('data-soc-url'))].url = e.target.value;
        applyNavChange(false);
      });
    });
    rightDrawerEl.querySelectorAll('[data-soc-del]').forEach((btn) => {
      btn.addEventListener('click', () => {
        site.socials.splice(Number(btn.getAttribute('data-soc-del')), 1);
        applyNavChange(false);
      });
    });
  }

  // ---------- Clean up Edit Decorations when exiting Edit Mode ----------
  function teardownEditMode() {
    closePopover();
    closeModal();
    if (activeMdCleanup) {
      activeMdCleanup();
      activeMdCleanup = null;
    }
    if (editAbort) {
      editAbort.abort();
      editAbort = null;
    }
    document.querySelectorAll('[data-ie-orig-href]').forEach((aEl) => {
      const orig = aEl.getAttribute('data-ie-orig-href');
      aEl.setAttribute('href', orig || '#');
      aEl.removeAttribute('data-ie-orig-href');
    });

    document
      .querySelectorAll('.ie-block-bar, .ie-inserter, .ie-sub-controls, .ie-add-card-tile, .ie-prose-edit-btn, .ie-inline-panel, .ie-hero-empty-btn, .ie-footer-add-btn')
      .forEach((el) => el.remove());

    document.querySelectorAll('[contenteditable="true"]').forEach((el) => {
      el.removeAttribute('contenteditable');
    });
    document.querySelectorAll('[data-block-idx]').forEach((el) => {
      el.classList.remove('ie-block-selected', 'ie-block-pulse', 'ie-dragging', 'ie-drag-over');
      el.removeAttribute('draggable');
    });
  }

  function stashHrefForEditing(aEl) {
    if (!aEl || aEl.tagName !== 'A') return;
    if (!aEl.hasAttribute('data-ie-orig-href') && aEl.hasAttribute('href')) {
      aEl.setAttribute('data-ie-orig-href', aEl.getAttribute('href') || '');
      aEl.removeAttribute('href');
    }
  }

  // ---------- Decorate Current Live Page for Direct In-Place Editing ----------
  function decorateEditMode() {
    teardownEditMode();
    if (!editMode || !workspace) return;
    editAbort = new AbortController();
    const signal = editSignal();

    // 1. Header Brand Name & Mark directly editable
    const brandAnchor = document.querySelector('header.site-header a.brand');
    if (brandAnchor) {
      stashHrefForEditing(brandAnchor);
      brandAnchor.addEventListener(
        'click',
        (e) => {
          if (e.target === brandAnchor) {
            brandAnchor.querySelector('[data-inline-brand]')?.focus();
          }
        },
        { signal }
      );
    }

    const brandMarkEl = document.querySelector('[data-inline-brand-mark]');
    if (brandMarkEl) {
      bindEditableText(
        brandMarkEl,
        () => workspace.site.brandMark || '',
        async (val) => {
          workspace.site.brandMark = val.slice(0, 4) || 'C';
          brandMarkEl.textContent = workspace.site.brandMark;
          await saveSite();
          renderDrawers();
        }
      );
    }

    const brandEl = document.querySelector('[data-inline-brand]');
    if (brandEl) {
      bindEditableText(
        brandEl,
        () => workspace.site.brandName || '',
        async (val) => {
          workspace.site.brandName = val;
          const copy = document.querySelector('[data-inline-brand-copy]');
          if (copy) copy.textContent = val;
          await saveSite();
          renderDrawers();
        }
      );
    }

    // 2. Top Nav links: Alt+click edits link inline, normal click navigates
    document.querySelectorAll('[data-inline-nav-idx]').forEach((navEl) => {
      const idx = Number(navEl.getAttribute('data-inline-nav-idx'));
      navEl.title = '点击跳转页面 · Alt+点击可就地编辑导航链接';
      navEl.addEventListener(
        'click',
        (e) => {
          if (!e.altKey) return;
          e.preventDefault();
          const cur = workspace.site.nav[idx];
          if (!cur) return;
          openLinkPopover(navEl, {
            title: '编辑顶部导航链接',
            label: cur.label,
            href: cur.href,
            onSave: async ({ label, href }) => {
              if (!label) workspace.site.nav.splice(idx, 1);
              else workspace.site.nav[idx] = { label, href: href || '/' };
              await saveSite({ refreshChrome: true });
            },
          });
        },
        { signal }
      );
    });

    // 3. Footer copyright text & Footer social links (GitHub / Email / RSS) directly editable!
    const footerEl = document.querySelector('[data-inline-footer]');
    if (footerEl) {
      bindEditableText(
        footerEl,
        () => workspace.site.footerText || '',
        async (val) => {
          workspace.site.footerText = val;
          await saveSite();
          renderDrawers();
        }
      );
    }

    const socialsBox = document.querySelector('[data-inline-socials]');
    if (socialsBox) {
      socialsBox.querySelectorAll('[data-inline-social-idx]').forEach((aEl) => {
        stashHrefForEditing(aEl);
        const idx = Number(aEl.getAttribute('data-inline-social-idx'));
        aEl.title = '点击编辑文字或链接';
        aEl.addEventListener(
          'click',
          (e) => {
            e.preventDefault();
            const cur = workspace.site.socials[idx] || { label: '', url: '' };
            openLinkPopover(aEl, {
              title: '编辑页脚链接',
              label: cur.label,
              href: cur.url,
              onSave: async ({ label, href }) => {
                if (!label) workspace.site.socials.splice(idx, 1);
                else workspace.site.socials[idx] = { label, url: href || '#' };
                await saveSite({ refreshChrome: true });
              },
            });
          },
          { signal }
        );
      });

      const addSocBtn = document.createElement('button');
      addSocBtn.type = 'button';
      addSocBtn.className = 'ie-mini-btn ie-footer-add-btn';
      addSocBtn.textContent = '＋ 链接';
      addSocBtn.addEventListener(
        'click',
        (e) => {
          openLinkPopover(e.currentTarget, {
            title: '新增页脚链接',
            label: '新链接',
            href: 'https://',
            onSave: async ({ label, href }) => {
              if (!label) return;
              workspace.site.socials = workspace.site.socials || [];
              workspace.site.socials.push({ label, url: href || '#' });
              await saveSite({ refreshChrome: true });
            },
          });
        },
        { signal }
      );
      socialsBox.appendChild(addSocBtn);
    }

    // 4. Page kind specific decoration
    if (pageContext.kind === 'page') {
      const page = getCurrentPageModel();
      if (!page) return;
      if (page.kind === 'blocks') {
        decorateBlockPage(page);
      } else {
        decorateMarkdownPage(page);
      }
    } else if (pageContext.kind === 'collection') {
      const col = getCurrentCollectionModel();
      if (col) decorateCollectionPage(col);
    } else if (pageContext.kind === 'item') {
      const item = getCurrentItemModel();
      if (item) decorateItemPage(item);
    }
  }

  function bindEditableText(el, getter, onCommit) {
    const signal = editSignal();
    el.setAttribute('contenteditable', 'true');
    el.addEventListener(
      'keydown',
      (e) => {
        if (e.key === 'Enter' && !e.shiftKey && el.tagName !== 'P') {
          e.preventDefault();
          el.blur();
        }
      },
      { signal }
    );
    el.addEventListener('input', () => setDirty(true), { signal });
    el.addEventListener(
      'blur',
      async () => {
        if (!editMode) return;
        const next = el.innerText.replace(/\r?\n/g, ' ').trim();
        const prev = String(getter() ?? '').trim();
        if (next !== prev) {
          try {
            await onCommit(next);
          } catch (err) {
            toast(err.message);
          }
        } else {
          setDirty(false);
        }
      },
      { signal }
    );
  }

  // ---------- Block Page Decoration ----------
  function decorateBlockPage(page) {
    const signal = editSignal();
    const canvas = document.querySelector('[data-blocks-canvas]') || document.querySelector('main.site-main > .container');
    if (!canvas) return;
    const blocks = page.blocks || (page.blocks = []);
    const blockEls = Array.from(canvas.querySelectorAll(':scope > [data-block-idx]'));

    const makeEndInserter = (insertIndex, text = '＋ 添加模块到页面末尾') => {
      const wrap = document.createElement('div');
      wrap.className = 'ie-inserter';
      wrap.innerHTML = `<button type="button" class="ie-inserter-btn">${text}</button>`;
      wrap.querySelector('button').addEventListener('click', () => openBlockPickerModal(insertIndex), { signal });
      return wrap;
    };

    if (blockEls.length === 0) {
      canvas.appendChild(makeEndInserter(0, '＋ 添加第一个模块'));
      return;
    }

    canvas.prepend(makeEndInserter(0, '＋ 在顶部插入模块'));
    canvas.appendChild(makeEndInserter(blocks.length));

    blockEls.forEach((secEl, idx) => {
      const block = blocks[idx];
      if (!block) return;

      const bar = document.createElement('div');
      bar.className = 'ie-block-bar';
      bar.innerHTML = buildBlockBarHtml(block, idx, blocks.length);
      secEl.prepend(bar);
      wireBlockBar(bar, secEl, page, block, idx);

      // Drag & Drop block reordering
      const handle = bar.querySelector('[data-drag-handle]');
      handle?.addEventListener('mousedown', () => secEl.setAttribute('draggable', 'true'), { signal });
      window.addEventListener('mouseup', () => secEl.removeAttribute('draggable'), { signal });
      secEl.addEventListener(
        'dragstart',
        (e) => {
          if (dragSourceIdx !== null) return;
          dragSourceIdx = idx;
          secEl.classList.add('ie-dragging');
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', String(idx));
        },
        { signal }
      );
      secEl.addEventListener(
        'dragend',
        () => {
          dragSourceIdx = null;
          secEl.removeAttribute('draggable');
          document.querySelectorAll('.ie-dragging, .ie-drag-over').forEach((n) => n.classList.remove('ie-dragging', 'ie-drag-over'));
        },
        { signal }
      );
      secEl.addEventListener(
        'dragover',
        (e) => {
          if (dragSourceIdx === null || dragSourceIdx === idx) return;
          e.preventDefault();
          secEl.classList.add('ie-drag-over');
        },
        { signal }
      );
      secEl.addEventListener('dragleave', () => secEl.classList.remove('ie-drag-over'), { signal });
      secEl.addEventListener(
        'drop',
        async (e) => {
          e.preventDefault();
          if (dragSourceIdx === null || dragSourceIdx === idx) return;
          const from = dragSourceIdx;
          dragSourceIdx = null;
          const [moved] = blocks.splice(from, 1);
          blocks.splice(idx, 0, moved);
          await saveCurrentEntity({ refreshAfter: true });
        },
        { signal }
      );

      secEl.querySelectorAll('[data-editable]').forEach((el) => {
        const key = el.getAttribute('data-editable');
        bindEditableText(el, () => block.data?.[key] || '', async (val) => {
          block.data = block.data || {};
          block.data[key] = val;
          await saveCurrentEntity();
        });
      });

      if (block.type === 'hero') {
        decorateHeroBlock(secEl, block);
      } else if (block.type === 'collection-feed') {
        const moreEl = secEl.querySelector('[data-editable-link="more"]');
        if (moreEl) {
          stashHrefForEditing(moreEl);
          moreEl.addEventListener(
            'click',
            (e) => {
              e.preventDefault();
              openLinkPopover(moreEl, {
                title: '编辑“查看更多”链接',
                label: block.data.moreLabel || '查看全部',
                href: block.data.moreHref || '',
                onSave: async ({ label, href }) => {
                  block.data.moreLabel = label;
                  block.data.moreHref = href;
                  await saveCurrentEntity({ refreshAfter: true });
                },
              });
            },
            { signal }
          );
        }
      } else if (block.type === 'markdown') {
        const proseEl = secEl.querySelector('[data-inline-prose="block"]');
        if (proseEl) {
          attachMarkdownTrigger(proseEl, () => block.data.body || '', async (nextMd) => {
            block.data.body = nextMd;
            await saveCurrentEntity({ refreshAfter: true });
          });
        }
      } else if (block.type !== 'divider') {
        decorateSubCardsBlock(secEl, block);
      }
    });
  }

  function buildBlockBarHtml(block, idx, total) {
    const typeName = TYPE_LABELS[block.type] || block.type;
    const curSpan = [4, 6, 8, 12].includes(Number(block.style?.span)) ? Number(block.style.span) : 12;
    let controls = '';

    if (block.type === 'hero') {
      const align = block.data?.align === 'center' ? 'center' : 'left';
      controls = `
        <button type="button" class="ie-mini-btn ${align === 'left' ? 'active' : ''}" data-act="hero-align" data-val="left">左</button>
        <button type="button" class="ie-mini-btn ${align === 'center' ? 'active' : ''}" data-act="hero-align" data-val="center">中</button>
        <button type="button" class="ie-mini-btn" data-act="hero-btns">按钮</button>
      `;
    } else if (block.type === 'bento' || block.type === 'links' || block.type === 'stats') {
      const defaultCol = block.type === 'stats' ? 4 : 3;
      const cols = Number(block.data?.columns) || defaultCol;
      controls = [2, 3, 4]
        .map((c) => `<button type="button" class="ie-mini-btn ${cols === c ? 'active' : ''}" data-act="cols" data-val="${c}">${c}列</button>`)
        .join('');
    } else if (block.type === 'gallery') {
      const cols = Number(block.data?.columns) || 2;
      controls = [2, 3]
        .map((c) => `<button type="button" class="ie-mini-btn ${cols === c ? 'active' : ''}" data-act="cols" data-val="${c}">${c}列</button>`)
        .join('');
    } else if (block.type === 'collection-feed') {
      const d = block.data || {};
      const selCol = workspace.collections.find((c) => c.id === d.collection);
      const colTags = selCol ? Array.from(new Set(selCol.items.flatMap((i) => i.data.tags || []))) : [];
      controls = `
        <select class="ie-mini-select" data-act="feed-col" title="来源栏目">
          ${workspace.collections
            .map((c) => `<option value="${escHtml(c.id)}" ${d.collection === c.id ? 'selected' : ''}>${escHtml(c.title)}</option>`)
            .join('')}
        </select>
        <select class="ie-mini-select" data-act="feed-view" title="布局视图">
          <option value="grid" ${d.view === 'grid' ? 'selected' : ''}>网格</option>
          <option value="list" ${d.view === 'list' ? 'selected' : ''}>列表</option>
          <option value="timeline" ${d.view === 'timeline' ? 'selected' : ''}>时间轴</option>
        </select>
        ${
          (d.view || 'grid') === 'grid'
            ? `<select class="ie-mini-select" data-act="feed-cols" title="网格列数">
                <option value="2" ${Number(d.columns || 2) === 2 ? 'selected' : ''}>2列</option>
                <option value="3" ${Number(d.columns) === 3 ? 'selected' : ''}>3列</option>
              </select>`
            : ''
        }
        <select class="ie-mini-select" data-act="feed-limit" title="显示条数">
          ${[2, 3, 4, 5, 6, 9, 12]
            .map((n) => `<option value="${n}" ${Number(d.limit || 6) === n ? 'selected' : ''}>${n}条</option>`)
            .join('')}
        </select>
        ${
          colTags.length
            ? `<select class="ie-mini-select" data-act="feed-tag" title="按标签过滤">
                <option value="">全标签</option>
                ${colTags.map((t) => `<option value="${escHtml(t)}" ${d.tagFilter === t ? 'selected' : ''}>#${escHtml(t)}</option>`).join('')}
              </select>`
            : ''
        }
        <button type="button" class="ie-mini-btn ${d.featuredOnly ? 'active' : ''}" data-act="feed-featured">精选</button>
      `;
    }

    return `
      <span class="ie-badge" data-drag-handle title="按住拖放排序">${escHtml(typeName)}</span>
      ${block.hidden ? `<span class="ie-badge ie-badge-muted">已隐藏</span>` : ''}
      ${controls}
      <select class="ie-mini-select" data-act="span" title="设置模块占位宽度（两个 1/2 模块可自动并排！）">
        <option value="12" ${curSpan === 12 ? 'selected' : ''}>全宽 1/1</option>
        <option value="6" ${curSpan === 6 ? 'selected' : ''}>并排 1/2</option>
        <option value="4" ${curSpan === 4 ? 'selected' : ''}>并排 1/3</option>
        <option value="8" ${curSpan === 8 ? 'selected' : ''}>宽栏 2/3</option>
      </select>
      <button type="button" class="ie-mini-btn" data-act="style" title="样式与入场动效（可拖拽面板，实时生效）">🎨 样式/动效</button>
      <div class="ie-spacer"></div>
      <button type="button" class="ie-mini-btn" data-act="insert-after" title="在此模块后插入新模块">＋后插</button>
      <button type="button" class="ie-mini-btn" data-act="up" ${idx === 0 ? 'disabled' : ''} title="上移">↑</button>
      <button type="button" class="ie-mini-btn" data-act="down" ${idx === total - 1 ? 'disabled' : ''} title="下移">↓</button>
      <button type="button" class="ie-mini-btn" data-act="dup" title="复制模块">复制</button>
      <button type="button" class="ie-mini-btn" data-act="hide" title="显示/隐藏">${block.hidden ? '显' : '隐'}</button>
      <button type="button" class="ie-mini-btn danger" data-act="del" title="删除模块">删</button>
    `;
  }

  function wireBlockBar(bar, secEl, page, block, idx) {
    const signal = editSignal();
    const blocks = page.blocks;

    bar.querySelector('[data-act="insert-after"]')?.addEventListener('click', () => openBlockPickerModal(idx + 1), { signal });

    bar.querySelector('[data-act="span"]')?.addEventListener(
      'change',
      async (e) => {
        block.style = block.style || {};
        block.style.span = Number(e.target.value);
        applyBlockClassesToDom(secEl, block);
        await saveCurrentEntity({ silent: true });
        if (activeDrawer === 'left') renderDrawers();
      },
      { signal }
    );

    bar.querySelector('[data-act="up"]')?.addEventListener(
      'click',
      async () => {
        if (idx <= 0) return;
        [blocks[idx - 1], blocks[idx]] = [blocks[idx], blocks[idx - 1]];
        await saveCurrentEntity({ refreshAfter: true });
      },
      { signal }
    );

    bar.querySelector('[data-act="down"]')?.addEventListener(
      'click',
      async () => {
        if (idx >= blocks.length - 1) return;
        [blocks[idx], blocks[idx + 1]] = [blocks[idx + 1], blocks[idx]];
        await saveCurrentEntity({ refreshAfter: true });
      },
      { signal }
    );

    bar.querySelector('[data-act="dup"]')?.addEventListener(
      'click',
      async () => {
        const copy = JSON.parse(JSON.stringify(block));
        copy.id = uid(block.type);
        blocks.splice(idx + 1, 0, copy);
        await saveCurrentEntity({ refreshAfter: true });
      },
      { signal }
    );

    bar.querySelector('[data-act="hide"]')?.addEventListener(
      'click',
      async () => {
        block.hidden = !block.hidden;
        await saveCurrentEntity({ refreshAfter: true });
      },
      { signal }
    );

    bar.querySelector('[data-act="del"]')?.addEventListener(
      'click',
      async () => {
        if (!confirm(`确定删除模块“${TYPE_LABELS[block.type] || block.type}”吗？`)) return;
        blocks.splice(idx, 1);
        await saveCurrentEntity({ refreshAfter: true });
      },
      { signal }
    );

    bar.querySelector('[data-act="style"]')?.addEventListener(
      'click',
      (e) => {
        openBlockStylePopover(e.currentTarget, secEl, block);
      },
      { signal }
    );

    bar.querySelectorAll('[data-act="hero-align"]').forEach((btn) => {
      btn.addEventListener(
        'click',
        async () => {
          block.data.align = btn.getAttribute('data-val');
          await saveCurrentEntity({ refreshAfter: true });
        },
        { signal }
      );
    });

    bar.querySelector('[data-act="hero-btns"]')?.addEventListener(
      'click',
      (e) => {
        openHeroButtonsPopover(e.currentTarget, block);
      },
      { signal }
    );

    bar.querySelectorAll('[data-act="cols"]').forEach((btn) => {
      btn.addEventListener(
        'click',
        async () => {
          block.data.columns = Number(btn.getAttribute('data-val'));
          await saveCurrentEntity({ refreshAfter: true });
        },
        { signal }
      );
    });

    bar.querySelector('[data-act="feed-col"]')?.addEventListener(
      'change',
      async (e) => {
        block.data.collection = e.target.value;
        block.data.tagFilter = '';
        const targetCol = workspace.collections.find((c) => c.id === e.target.value);
        if (targetCol) block.data.moreHref = targetCol.route;
        await saveCurrentEntity({ refreshAfter: true });
      },
      { signal }
    );
    bar.querySelector('[data-act="feed-view"]')?.addEventListener(
      'change',
      async (e) => {
        block.data.view = e.target.value;
        await saveCurrentEntity({ refreshAfter: true });
      },
      { signal }
    );
    bar.querySelector('[data-act="feed-cols"]')?.addEventListener(
      'change',
      async (e) => {
        block.data.columns = Number(e.target.value);
        await saveCurrentEntity({ refreshAfter: true });
      },
      { signal }
    );
    bar.querySelector('[data-act="feed-limit"]')?.addEventListener(
      'change',
      async (e) => {
        block.data.limit = Number(e.target.value);
        await saveCurrentEntity({ refreshAfter: true });
      },
      { signal }
    );
    bar.querySelector('[data-act="feed-tag"]')?.addEventListener(
      'change',
      async (e) => {
        block.data.tagFilter = e.target.value;
        await saveCurrentEntity({ refreshAfter: true });
      },
      { signal }
    );
    bar.querySelector('[data-act="feed-featured"]')?.addEventListener(
      'click',
      async () => {
        block.data.featuredOnly = !block.data.featuredOnly;
        await saveCurrentEntity({ refreshAfter: true });
      },
      { signal }
    );
  }

  function decorateHeroBlock(secEl, block) {
    const signal = editSignal();
    secEl.querySelectorAll('[data-editable-btn]').forEach((btnEl) => {
      stashHrefForEditing(btnEl);
      const key = btnEl.getAttribute('data-editable-btn');
      btnEl.addEventListener(
        'click',
        (e) => {
          e.preventDefault();
          const cur = block.data[key] || { label: '', href: '' };
          openLinkPopover(btnEl, {
            title: key === 'primaryBtn' ? '编辑主按钮' : '编辑次按钮',
            label: cur.label || '',
            href: cur.href || '',
            onSave: async ({ label, href }) => {
              block.data[key] = label ? { label, href } : null;
              await saveCurrentEntity({ refreshAfter: true });
            },
          });
        },
        { signal }
      );
    });

    const actionsEl = secEl.querySelector('.hero-actions');
    if (actionsEl && !block.data?.secondaryBtn?.label) {
      const addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'ie-mini-btn ie-hero-empty-btn';
      addBtn.textContent = '＋ 按钮设置';
      addBtn.addEventListener('click', (e) => openHeroButtonsPopover(e.currentTarget, block), { signal });
      actionsEl.appendChild(addBtn);
    }
  }

  function decorateSubCardsBlock(secEl, block) {
    const signal = editSignal();
    const container = secEl.querySelector('[data-sub-container]');
    if (!container) return;
    const listKey = container.getAttribute('data-sub-container');
    const list = (block.data[listKey] = Array.isArray(block.data[listKey]) ? block.data[listKey] : []);

    container.querySelectorAll('[data-sub-kind]').forEach((cardEl) => {
      stashHrefForEditing(cardEl);
      const subIdx = Number(cardEl.getAttribute('data-sub-idx'));
      const subKind = cardEl.getAttribute('data-sub-kind');
      const itemData = list[subIdx];
      if (!itemData) return;

      cardEl.querySelectorAll('[data-card-field]').forEach((fieldEl) => {
        const field = fieldEl.getAttribute('data-card-field');
        bindEditableText(fieldEl, () => itemData[field] || '', async (val) => {
          itemData[field] = val;
          await saveCurrentEntity();
        });
      });

      const ctrl = document.createElement('div');
      ctrl.className = 'ie-sub-controls';
      const hasLink = subKind === 'bento-card' || subKind === 'link-item' || subKind === 'gallery-item';
      const hasImage = subKind === 'gallery-item';
      const isBento = subKind === 'bento-card';

      ctrl.innerHTML = `
        ${isBento ? `<button type="button" class="ie-mini-btn ${Number(itemData.colSpan) === 2 ? 'active' : ''}" data-sub-act="span" title="切换单倍/双倍跨列宽度">${Number(itemData.colSpan) === 2 ? '2x宽' : '1x'}</button>` : ''}
        ${isBento ? `<button type="button" class="ie-mini-btn ${itemData.highlight ? 'active' : ''}" data-sub-act="hi" title="切换高亮边框">★</button>` : ''}
        ${hasImage ? `<button type="button" class="ie-mini-btn" data-sub-act="img" title="设置/上传图片">🖼</button>` : ''}
        ${hasLink ? `<button type="button" class="ie-mini-btn" data-sub-act="href" title="设置跳转链接">🔗</button>` : ''}
        <button type="button" class="ie-mini-btn" data-sub-act="prev" ${subIdx === 0 ? 'disabled' : ''} title="前移">←</button>
        <button type="button" class="ie-mini-btn" data-sub-act="next" ${subIdx === list.length - 1 ? 'disabled' : ''} title="后移">→</button>
        <button type="button" class="ie-mini-btn danger" data-sub-act="del" title="删除卡片">✕</button>
      `;
      cardEl.appendChild(ctrl);

      ctrl.querySelector('[data-sub-act="span"]')?.addEventListener(
        'click',
        async (e) => {
          e.stopPropagation();
          itemData.colSpan = Number(itemData.colSpan) === 2 ? 1 : 2;
          await saveCurrentEntity({ refreshAfter: true });
        },
        { signal }
      );
      ctrl.querySelector('[data-sub-act="hi"]')?.addEventListener(
        'click',
        async (e) => {
          e.stopPropagation();
          itemData.highlight = !itemData.highlight;
          await saveCurrentEntity({ refreshAfter: true });
        },
        { signal }
      );
      ctrl.querySelector('[data-sub-act="prev"]')?.addEventListener(
        'click',
        async (e) => {
          e.stopPropagation();
          [list[subIdx - 1], list[subIdx]] = [list[subIdx], list[subIdx - 1]];
          await saveCurrentEntity({ refreshAfter: true });
        },
        { signal }
      );
      ctrl.querySelector('[data-sub-act="next"]')?.addEventListener(
        'click',
        async (e) => {
          e.stopPropagation();
          [list[subIdx], list[subIdx + 1]] = [list[subIdx + 1], list[subIdx]];
          await saveCurrentEntity({ refreshAfter: true });
        },
        { signal }
      );
      ctrl.querySelector('[data-sub-act="del"]')?.addEventListener(
        'click',
        async (e) => {
          e.stopPropagation();
          list.splice(subIdx, 1);
          await saveCurrentEntity({ refreshAfter: true });
        },
        { signal }
      );
      ctrl.querySelector('[data-sub-act="href"]')?.addEventListener(
        'click',
        (e) => {
          e.stopPropagation();
          const urlField = subKind === 'link-item' ? 'url' : 'href';
          openSingleUrlPopover(e.currentTarget, {
            title: '设置卡片链接',
            value: itemData[urlField] || '',
            placeholder: '/works 或 https://...',
            onSave: async (val) => {
              itemData[urlField] = val;
              await saveCurrentEntity({ refreshAfter: true });
            },
          });
        },
        { signal }
      );
      ctrl.querySelector('[data-sub-act="img"]')?.addEventListener(
        'click',
        (e) => {
          e.stopPropagation();
          openImagePopover(e.currentTarget, {
            value: itemData.image || '',
            onSave: async (val) => {
              itemData.image = val;
              await saveCurrentEntity({ refreshAfter: true });
            },
          });
        },
        { signal }
      );
    });

    const addTile = document.createElement('button');
    addTile.type = 'button';
    addTile.className = 'ie-add-card-tile';
    addTile.innerHTML = `<span style="font-size:20px;line-height:1;">＋</span><span>添加卡片</span>`;
    addTile.addEventListener(
      'click',
      async () => {
        if (block.type === 'bento') list.push({ label: 'NEW', value: '新卡片标题', note: '点击文字直接修改内容', href: '' });
        else if (block.type === 'timeline') list.push({ date: new Date().toISOString().slice(0, 7), tag: '记录', title: '新节点', detail: '补充节点说明' });
        else if (block.type === 'links') list.push({ badge: 'LINK', name: '新链接', desc: '一句话介绍', url: 'https://' });
        else if (block.type === 'stats') list.push({ label: '指标', value: '00', note: '说明文字' });
        else if (block.type === 'gallery') list.push({ tag: 'IMG', title: '新图片卡片', desc: '点击🖼上传图片', image: '', href: '' });
        await saveCurrentEntity({ refreshAfter: true });
      },
      { signal }
    );
    container.appendChild(addTile);
  }

  // ---------- Markdown Page Decoration ----------
  function decorateMarkdownPage(page) {
    const titleEl = document.querySelector('[data-inline-page-title]');
    const descEl = document.querySelector('[data-inline-page-desc]');
    const proseEl = document.querySelector('[data-inline-prose="page"]');

    if (titleEl) {
      bindEditableText(titleEl, () => page.title || '', async (val) => {
        page.title = val;
        if (page.data) page.data.title = val;
        await saveCurrentEntity();
      });
    }
    if (descEl) {
      bindEditableText(descEl, () => page.description || '', async (val) => {
        page.description = val;
        if (page.data) page.data.description = val;
        await saveCurrentEntity();
      });
    }
    if (proseEl) {
      attachMarkdownTrigger(proseEl, () => page.body || '', async (nextMd) => {
        page.body = nextMd;
        await saveCurrentEntity({ refreshAfter: true });
      });
    }
  }

  // ---------- Collection Index Page Decoration ----------
  function decorateCollectionPage(col) {
    const signal = editSignal();
    const titleEl = document.querySelector('[data-inline-col-title]');
    const descEl = document.querySelector('[data-inline-col-desc]');
    const header = document.querySelector('main.site-main header.page-header');

    if (titleEl) {
      bindEditableText(titleEl, () => col.title || '', async (val) => {
        col.title = val;
        await saveCurrentEntity();
      });
    }
    if (descEl) {
      bindEditableText(descEl, () => col.description || '', async (val) => {
        col.description = val;
        await saveCurrentEntity();
      });
    }

    if (header) {
      const panel = document.createElement('div');
      panel.className = 'ie-inline-panel';
      panel.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap;">
          <strong>⚙️ 栏目布局与快捷管理</strong>
          <button type="button" class="ie-mini-btn active" id="ie-col-new-item">＋ 在“${escHtml(col.title)}”新建条目</button>
        </div>
        <div class="ie-inline-grid">
          <div class="ie-field">
            <label>默认展示视图</label>
            <select class="ie-select" id="ie-col-view">
              <option value="grid" ${col.defaultView === 'grid' ? 'selected' : ''}>网格卡片 (Grid)</option>
              <option value="list" ${col.defaultView === 'list' ? 'selected' : ''}>简洁列表 (List)</option>
              <option value="timeline" ${col.defaultView === 'timeline' ? 'selected' : ''}>时间轴 (Timeline)</option>
            </select>
          </div>
          <div class="ie-field">
            <label>序号前缀（如 PROJ）</label>
            <input type="text" class="ie-input" id="ie-col-prefix" value="${escHtml(col.itemPrefix || '')}" placeholder="留空不显示编号" />
          </div>
          <div class="ie-field">
            <label>排序方式</label>
            <select class="ie-select" id="ie-col-sort">
              <option value="date" ${col.sortBy === 'date' ? 'selected' : ''}>按日期倒序</option>
              <option value="order" ${col.sortBy === 'order' ? 'selected' : ''}>按 Order 权重</option>
            </select>
          </div>
        </div>
      `;
      header.appendChild(panel);

      panel.querySelector('#ie-col-new-item')?.addEventListener('click', () => openNewItemModal(col.id), { signal });
      panel.querySelector('#ie-col-view')?.addEventListener(
        'change',
        async (e) => {
          col.defaultView = e.target.value;
          await saveCurrentEntity({ refreshAfter: true });
        },
        { signal }
      );
      panel.querySelector('#ie-col-prefix')?.addEventListener(
        'change',
        async (e) => {
          col.itemPrefix = e.target.value.trim();
          await saveCurrentEntity({ refreshAfter: true });
        },
        { signal }
      );
      panel.querySelector('#ie-col-sort')?.addEventListener(
        'change',
        async (e) => {
          col.sortBy = e.target.value;
          await saveCurrentEntity({ refreshAfter: true });
        },
        { signal }
      );
    }

    document.querySelectorAll('main.site-main [data-item-slug]').forEach((cardEl) => {
      const slug = cardEl.getAttribute('data-item-slug');
      const itemCol = cardEl.getAttribute('data-item-collection');
      const isDraft = cardEl.getAttribute('data-item-draft') === 'true';
      const ctrl = document.createElement('div');
      ctrl.className = 'ie-sub-controls';
      ctrl.innerHTML = `
        ${isDraft ? `<span class="ie-badge ie-badge-muted">草稿</span>` : ''}
        <button type="button" class="ie-mini-btn danger" title="删除此条目">删除</button>
      `;
      cardEl.style.position = 'relative';
      cardEl.appendChild(ctrl);
      ctrl.querySelector('button')?.addEventListener(
        'click',
        async (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!confirm(`确定删除条目 "${slug}" 吗？`)) return;
          await api(`/api/studio/items/${encodeURIComponent(itemCol)}/${encodeURIComponent(slug)}`, 'DELETE');
          toast(`已删除 ${slug}`);
          await refreshMainFromServer();
        },
        { signal }
      );
    });
  }

  // ---------- Collection Item Page Decoration ----------
  function decorateItemPage(item) {
    const signal = editSignal();
    const titleEl = document.querySelector('[data-inline-item-title]');
    const summaryEl = document.querySelector('[data-inline-item-summary]');
    const tagsEl = document.querySelector('[data-inline-tags]');
    const header = document.querySelector('main.site-main header.page-header');
    const proseEl = document.querySelector('[data-inline-prose="item"]');

    if (titleEl) {
      bindEditableText(titleEl, () => item.data.title || item.title || '', async (val) => {
        item.data.title = val;
        item.title = val;
        await saveCurrentEntity();
      });
    }
    if (summaryEl) {
      bindEditableText(summaryEl, () => item.data.summary || '', async (val) => {
        item.data.summary = val;
        item.summary = val;
        await saveCurrentEntity();
      });
    }

    if (tagsEl) {
      renderInlineTagsEditor(tagsEl, item);
    }

    if (header) {
      const metaKeys = ['title', 'summary', 'description', 'date', 'updated', 'status', 'tags', 'related', 'repoUrl', 'demoUrl', 'order', 'featured', 'draft'];
      const customPairs = Object.entries(item.data || {}).filter(([k]) => !metaKeys.includes(k));
      const allRefs = [];
      for (const col of workspace.collections) {
        for (const entry of col.items) {
          if (entry.ref !== item.ref) allRefs.push(entry);
        }
      }

      const panel = document.createElement('details');
      panel.className = 'ie-inline-panel';
      panel.innerHTML = `
        <summary style="cursor:pointer; font-weight:600; display:flex; align-items:center; justify-content:space-between;">
          <span>🧾 条目属性、关联内容与状态配置（点击展开）</span>
          <span style="font-size:12px; color:var(--ie-muted);">${item.data.date || '无日期'} · ${item.data.draft ? '草稿' : '已发布'}</span>
        </summary>
        <div class="ie-inline-grid">
          <div class="ie-field">
            <label>发布日期</label>
            <input type="date" class="ie-input" id="ie-item-date" value="${escHtml(item.data.date || '')}" />
          </div>
          <div class="ie-field">
            <label>状态标识</label>
            <select class="ie-select" id="ie-item-status">
              <option value="" ${!item.data.status ? 'selected' : ''}>无状态</option>
              <option value="active" ${item.data.status === 'active' ? 'selected' : ''}>进行中 (active)</option>
              <option value="completed" ${item.data.status === 'completed' ? 'selected' : ''}>已完成 (completed)</option>
              <option value="archived" ${item.data.status === 'archived' ? 'selected' : ''}>已归档 (archived)</option>
            </select>
          </div>
          <div class="ie-field">
            <label>演示链接 (demoUrl)</label>
            <input type="text" class="ie-input" id="ie-item-demo" value="${escHtml(item.data.demoUrl || '')}" placeholder="https://..." />
          </div>
          <div class="ie-field">
            <label>源码链接 (repoUrl)</label>
            <input type="text" class="ie-input" id="ie-item-repo" value="${escHtml(item.data.repoUrl || '')}" placeholder="https://github.com/..." />
          </div>
          <div class="ie-field">
            <label>首页精选 / 草稿开关</label>
            <div style="display:flex; gap:12px; align-items:center; height:34px;">
              <label style="display:inline-flex; gap:5px; align-items:center; cursor:pointer; color:var(--ie-text);">
                <input type="checkbox" id="ie-item-featured" ${item.data.featured ? 'checked' : ''} /> 精选
              </label>
              <label style="display:inline-flex; gap:5px; align-items:center; cursor:pointer; color:var(--ie-text);">
                <input type="checkbox" id="ie-item-draft" ${item.data.draft ? 'checked' : ''} /> 设为草稿
              </label>
            </div>
          </div>
          <div class="ie-field">
            <label>自定义前端字段（如 角色/耗时/技术栈）</label>
            <button type="button" class="ie-mini-btn" id="ie-add-kv">＋ 添加/管理自定义字段 (${customPairs.length})</button>
          </div>
        </div>
        ${
          allRefs.length
            ? `<div class="ie-field" style="margin-top:10px;">
                <label>双向关联条目（勾选自动互相展示）</label>
                <div style="display:flex; flex-wrap:wrap; gap:6px;">
                  ${allRefs
                    .map((r) => {
                      const checked = (item.data.related || []).includes(r.ref);
                      return `<label style="display:inline-flex; gap:5px; align-items:center; padding:4px 9px; border-radius:999px; border:1px solid var(--ie-border); background:var(--ie-surface-solid); cursor:pointer; font-size:12px; color:var(--ie-text);">
                        <input type="checkbox" data-rel-ref="${escHtml(r.ref)}" ${checked ? 'checked' : ''} />
                        <span>${escHtml(r.collection)} / ${escHtml(r.title)}</span>
                      </label>`;
                    })
                    .join('')}
                </div>
              </div>`
            : ''
        }
      `;
      header.appendChild(panel);

      const bindItemInput = (sel, setter, refresh = false) => {
        panel.querySelector(sel)?.addEventListener(
          'change',
          async (e) => {
            setter(e.target.type === 'checkbox' ? e.target.checked : e.target.value);
            await saveCurrentEntity({ refreshAfter: refresh });
          },
          { signal }
        );
      };

      bindItemInput('#ie-item-date', (v) => { item.data.date = v; }, true);
      bindItemInput('#ie-item-status', (v) => {
        if (v) item.data.status = v;
        else delete item.data.status;
      }, true);
      bindItemInput('#ie-item-demo', (v) => {
        if (v.trim()) item.data.demoUrl = v.trim();
        else delete item.data.demoUrl;
      }, true);
      bindItemInput('#ie-item-repo', (v) => {
        if (v.trim()) item.data.repoUrl = v.trim();
        else delete item.data.repoUrl;
      }, true);
      bindItemInput('#ie-item-featured', (v) => { item.data.featured = v; });
      bindItemInput('#ie-item-draft', (v) => { item.data.draft = v; }, true);

      panel.querySelectorAll('[data-rel-ref]').forEach((cb) => {
        cb.addEventListener(
          'change',
          async () => {
            const refs = new Set(item.data.related || []);
            const ref = cb.getAttribute('data-rel-ref');
            if (cb.checked) refs.add(ref);
            else refs.delete(ref);
            item.data.related = Array.from(refs);
            await saveCurrentEntity({ refreshAfter: true });
          },
          { signal }
        );
      });

      panel.querySelector('#ie-add-kv')?.addEventListener('click', () => openCustomKvModal(item), { signal });
    }

    if (proseEl) {
      attachMarkdownTrigger(proseEl, () => item.body || '', async (nextMd) => {
        item.body = nextMd;
        await saveCurrentEntity({ refreshAfter: true });
      });
    }
  }

  function renderInlineTagsEditor(tagsEl, item) {
    const signal = editSignal();
    const tags = Array.isArray(item.data.tags) ? item.data.tags : [];
    tagsEl.innerHTML = `
      ${tags
        .map(
          (t, i) => `<span class="pill">#${escHtml(t)} <button type="button" data-rm-tag="${i}" style="border:none;background:none;color:inherit;cursor:pointer;padding:0 0 0 4px;">×</button></span>`
        )
        .join('')}
      <input type="text" id="ie-new-tag-input" placeholder="+ 回车添加标签" style="border:1px dashed var(--ie-border-strong); background:transparent; border-radius:999px; padding:3px 10px; font-size:12px; color:var(--ie-text); width:115px; outline:none;" />
    `;
    tagsEl.querySelectorAll('[data-rm-tag]').forEach((btn) => {
      btn.addEventListener(
        'click',
        async () => {
          item.data.tags.splice(Number(btn.getAttribute('data-rm-tag')), 1);
          await saveCurrentEntity();
          renderInlineTagsEditor(tagsEl, item);
        },
        { signal }
      );
    });
    const inp = tagsEl.querySelector('#ie-new-tag-input');
    inp?.addEventListener(
      'keydown',
      async (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const tag = inp.value.trim().replace(/^#/, '');
          if (!tag) return;
          item.data.tags = item.data.tags || [];
          if (!item.data.tags.includes(tag)) {
            item.data.tags.push(tag);
            await saveCurrentEntity();
            renderInlineTagsEditor(tagsEl, item);
          } else {
            inp.value = '';
          }
        }
      },
      { signal }
    );
  }

  // ---------- In-Place Split Markdown Editor ----------
  function attachMarkdownTrigger(proseEl, getMarkdown, onSaveMarkdown) {
    const signal = editSignal();
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ie-mini-btn active ie-prose-edit-btn';
    btn.innerHTML = '✏️ 编辑正文 (Markdown)';
    proseEl.parentNode.insertBefore(btn, proseEl);

    const open = () => {
      if (!editMode) return;
      openInlineMarkdownEditor(proseEl, btn, getMarkdown, onSaveMarkdown);
    };
    btn.addEventListener('click', open, { signal });
    proseEl.addEventListener('dblclick', open, { signal });
  }

  async function openInlineMarkdownEditor(proseEl, triggerBtn, getMarkdown, onSaveMarkdown) {
    if (activeMdCleanup) {
      activeMdCleanup();
      activeMdCleanup = null;
    }

    const initialMd = getMarkdown();
    triggerBtn.style.display = 'none';
    proseEl.style.display = 'none';

    const editorWrap = document.createElement('div');
    editorWrap.className = 'ie-md-editor';
    editorWrap.innerHTML = `
      <div class="ie-md-toolbar">
        <button type="button" class="ie-mini-btn" data-md-ins="h2">H2</button>
        <button type="button" class="ie-mini-btn" data-md-ins="h3">H3</button>
        <button type="button" class="ie-mini-btn" data-md-wrap="**">B</button>
        <button type="button" class="ie-mini-btn" data-md-wrap="*">I</button>
        <button type="button" class="ie-mini-btn" data-md-ins="code">代码块</button>
        <button type="button" class="ie-mini-btn" data-md-ins="callout">提示框</button>
        <button type="button" class="ie-mini-btn" data-md-ins="link">链接</button>
        <label class="ie-mini-btn" style="cursor:pointer;">
          📷 上传图片
          <input type="file" accept="image/*" id="ie-md-upload" style="display:none;" />
        </label>
        <span style="font-size:11px; color:var(--ie-muted);">支持 Ctrl+V 直接粘贴截图</span>
        <div class="ie-spacer"></div>
        <button type="button" class="ie-mini-btn" id="ie-md-toggle-split">隐藏预览</button>
        <button type="button" class="ie-mini-btn" id="ie-md-cancel">取消</button>
        <button type="button" class="ie-mini-btn active" id="ie-md-done">✓ 完成并保存</button>
      </div>
      <div class="ie-md-split" id="ie-md-split">
        <textarea class="ie-md-input" id="ie-md-textarea" spellcheck="false" placeholder="开始书写 Markdown…">${escHtml(initialMd)}</textarea>
        <div class="ie-md-preview prose" id="ie-md-preview"></div>
      </div>
    `;
    proseEl.insertAdjacentElement('afterend', editorWrap);

    const textarea = editorWrap.querySelector('#ie-md-textarea');
    const preview = editorWrap.querySelector('#ie-md-preview');
    const splitEl = editorWrap.querySelector('#ie-md-split');
    let previewTimer = null;
    let syncLock = null;

    const updatePreview = async () => {
      try {
        const res = await fetch('/api/studio/preview-md', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ markdown: textarea.value }),
        });
        const data = await res.json();
        if (data.html !== undefined) {
          preview.innerHTML = data.html;
        }
      } catch {
        // Ignore transient preview errors
      }
    };

    updatePreview();

    textarea.addEventListener('input', () => {
      setDirty(true);
      clearTimeout(previewTimer);
      previewTimer = setTimeout(updatePreview, 140);
    });

    const syncScroll = (source, target, tag) => {
      if (syncLock && syncLock !== tag) return;
      syncLock = tag;
      const srcMax = Math.max(1, source.scrollHeight - source.clientHeight);
      const dstMax = Math.max(0, target.scrollHeight - target.clientHeight);
      target.scrollTop = (source.scrollTop / srcMax) * dstMax;
      requestAnimationFrame(() => {
        if (syncLock === tag) syncLock = null;
      });
    };
    textarea.addEventListener('scroll', () => syncScroll(textarea, preview, 'left'));
    preview.addEventListener('scroll', () => syncScroll(preview, textarea, 'right'));

    const insertAtCursor = (snippet) => {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const val = textarea.value;
      textarea.value = val.slice(0, start) + snippet + val.slice(end);
      textarea.selectionStart = textarea.selectionEnd = start + snippet.length;
      textarea.focus();
      textarea.dispatchEvent(new Event('input'));
    };

    const wrapSelection = (marker) => {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const val = textarea.value;
      const sel = val.slice(start, end) || '文本';
      const next = `${marker}${sel}${marker}`;
      textarea.value = val.slice(0, start) + next + val.slice(end);
      textarea.selectionStart = start + marker.length;
      textarea.selectionEnd = start + marker.length + sel.length;
      textarea.focus();
      textarea.dispatchEvent(new Event('input'));
    };

    editorWrap.querySelectorAll('[data-md-wrap]').forEach((btn) => {
      btn.addEventListener('click', () => wrapSelection(btn.getAttribute('data-md-wrap')));
    });
    editorWrap.querySelectorAll('[data-md-ins]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const k = btn.getAttribute('data-md-ins');
        if (k === 'h2') insertAtCursor('\n## 二级标题\n');
        else if (k === 'h3') insertAtCursor('\n### 三级标题\n');
        else if (k === 'code') insertAtCursor('\n```js\nconsole.log("hello");\n```\n');
        else if (k === 'callout') insertAtCursor('\n> [!TIP]\n> 在这里写下提示内容。\n');
        else if (k === 'link') insertAtCursor('[链接文字](https://example.com)');
      });
    });

    const uploadFile = async (file) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const res = await api('/api/studio/upload', 'POST', {
            filename: file.name || `paste-${Date.now()}.png`,
            data: reader.result,
          });
          insertAtCursor(`\n![${file.name || 'image'}](${res.asset.url})\n`);
          toast(`已上传图片到 ${res.asset.url}`);
        } catch (err) {
          toast(err.message);
        }
      };
      reader.readAsDataURL(file);
    };

    editorWrap.querySelector('#ie-md-upload')?.addEventListener('change', (e) => {
      const f = e.target.files?.[0];
      if (f) uploadFile(f);
    });

    textarea.addEventListener('paste', (e) => {
      const items = e.clipboardData?.items || [];
      for (const item of items) {
        if (item.type?.startsWith('image/')) {
          e.preventDefault();
          const f = item.getAsFile();
          if (f) uploadFile(f);
          break;
        }
      }
    });

    editorWrap.querySelector('#ie-md-toggle-split')?.addEventListener('click', (e) => {
      const hidePrev = preview.style.display === 'none';
      preview.style.display = hidePrev ? '' : 'none';
      splitEl.classList.toggle('single-pane', !hidePrev);
      e.target.textContent = hidePrev ? '隐藏预览' : '显示双栏预览';
    });

    const cleanup = () => {
      clearTimeout(previewTimer);
      editorWrap.remove();
      proseEl.style.display = '';
      triggerBtn.style.display = '';
      activeMdCleanup = null;
    };
    activeMdCleanup = cleanup;

    editorWrap.querySelector('#ie-md-cancel')?.addEventListener('click', () => {
      setDirty(false);
      cleanup();
    });

    editorWrap.querySelector('#ie-md-done')?.addEventListener('click', async () => {
      const val = textarea.value;
      cleanup();
      await onSaveMarkdown(val);
    });

    textarea.focus();
  }

  // ---------- Draggable Smart-Positioned Floating Popovers ----------
  function makeDraggable(pop, headEl) {
    let startX = 0;
    let startY = 0;
    let origLeft = 0;
    let origTop = 0;
    headEl.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      e.preventDefault();
      const rect = pop.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      origLeft = rect.left;
      origTop = rect.top;
      headEl.setPointerCapture(e.pointerId);

      const onMove = (ev) => {
        const nextLeft = Math.max(8, Math.min(window.innerWidth - rect.width - 8, origLeft + (ev.clientX - startX)));
        const nextTop = Math.max(8, Math.min(window.innerHeight - 60, origTop + (ev.clientY - startY)));
        pop.style.left = `${nextLeft}px`;
        pop.style.top = `${nextTop}px`;
      };
      const onUp = () => {
        headEl.removeEventListener('pointermove', onMove);
        headEl.removeEventListener('pointerup', onUp);
      };
      headEl.addEventListener('pointermove', onMove);
      headEl.addEventListener('pointerup', onUp);
    });
  }

  function createDraggablePopover(anchorEl, titleText, bodyHtml) {
    closePopover();
    const pop = document.createElement('div');
    pop.className = 'ie-popover';
    pop.innerHTML = `
      <div class="ie-popover-head">
        <span>⠿ ${escHtml(titleText)} <span style="font-weight:400;font-size:11px;color:var(--ie-muted);">(可拖拽移动)</span></span>
        <button type="button" class="ie-mini-btn" id="ie-pop-close" title="关闭">✕</button>
      </div>
      ${bodyHtml}
    `;
    document.body.appendChild(pop);
    activePopover = pop;

    // Place cleanly near side/edge so it doesn't sit right over the middle of the block!
    const rect = anchorEl.getBoundingClientRect();
    const popW = pop.offsetWidth || 336;
    const popH = pop.offsetHeight || 280;
    let left = window.innerWidth - popW - 24;
    if (rect.right + 12 + popW <= window.innerWidth - 12) {
      left = rect.right + 12;
    } else if (rect.left - popW - 12 >= 12) {
      left = rect.left - popW - 12;
    }
    const top = Math.max(76, Math.min(window.innerHeight - popH - 80, rect.top));
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;

    makeDraggable(pop, pop.querySelector('.ie-popover-head'));
    pop.querySelector('#ie-pop-close')?.addEventListener('click', closePopover);
    return pop;
  }

  function openBlockStylePopover(anchorEl, secEl, block) {
    const st = block.style || (block.style = {});
    const span = [4, 6, 8, 12].includes(Number(st.span)) ? Number(st.span) : 12;
    const pop = createDraggablePopover(
      anchorEl,
      '模块排版与动效',
      `
      <div style="font-size:11px;color:var(--ie-muted);margin-top:-4px;">所有选项实时生效，无需点击保存</div>
      <div class="ie-inline-grid" style="grid-template-columns:1fr 1fr; margin-top:2px;">
        <div class="ie-field">
          <label>并行占位宽度</label>
          <select class="ie-select" id="ie-bs-span">
            <option value="12" ${span === 12 ? 'selected' : ''}>全宽 (1/1)</option>
            <option value="6" ${span === 6 ? 'selected' : ''}>并排 (1/2)</option>
            <option value="4" ${span === 4 ? 'selected' : ''}>三栏并排 (1/3)</option>
            <option value="8" ${span === 8 ? 'selected' : ''}>宽栏 (2/3)</option>
          </select>
        </div>
        <div class="ie-field">
          <label>内部容器宽度</label>
          <select class="ie-select" id="ie-bs-width">
            <option value="" ${!st.width ? 'selected' : ''}>默认全宽</option>
            <option value="compact" ${st.width === 'compact' ? 'selected' : ''}>专注窄栏 (720px)</option>
            <option value="wide" ${st.width === 'wide' ? 'selected' : ''}>加宽画布</option>
          </select>
        </div>
        <div class="ie-field">
          <label>背景与边框</label>
          <select class="ie-select" id="ie-bs-surface">
            <option value="" ${!st.surface ? 'selected' : ''}>透明无底</option>
            <option value="surface" ${st.surface === 'surface' ? 'selected' : ''}>卡片白底</option>
            <option value="subtle" ${st.surface === 'subtle' ? 'selected' : ''}>柔和浅灰</option>
            <option value="accent" ${st.surface === 'accent' ? 'selected' : ''}>主题强调淡底</option>
            <option value="outline" ${st.surface === 'outline' ? 'selected' : ''}>纯描边外框</option>
          </select>
        </div>
        <div class="ie-field">
          <label>下方间距</label>
          <select class="ie-select" id="ie-bs-spacing">
            <option value="" ${!st.spacing ? 'selected' : ''}>标准</option>
            <option value="tight" ${st.spacing === 'tight' ? 'selected' : ''}>紧凑</option>
            <option value="spacious" ${st.spacing === 'spacious' ? 'selected' : ''}>宽敞</option>
          </select>
        </div>
        <div class="ie-field">
          <label>文字比例</label>
          <select class="ie-select" id="ie-bs-scale">
            <option value="" ${!st.scale ? 'selected' : ''}>标准 (1.0x)</option>
            <option value="sm" ${st.scale === 'sm' ? 'selected' : ''}>紧凑 (0.92x)</option>
            <option value="lg" ${st.scale === 'lg' ? 'selected' : ''}>放大 (1.08x)</option>
          </select>
        </div>
        <div class="ie-field">
          <label>标题文本对齐</label>
          <select class="ie-select" id="ie-bs-align">
            <option value="" ${!st.align ? 'selected' : ''}>默认左对齐</option>
            <option value="center" ${st.align === 'center' ? 'selected' : ''}>居中</option>
          </select>
        </div>
      </div>
      <div class="ie-field">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <label>入场动效</label>
          <button type="button" class="ie-mini-btn" id="ie-bs-replay">▶ 播放动效</button>
        </div>
        <select class="ie-select" id="ie-bs-anim">
          <option value="inherit" ${!st.anim || st.anim === 'inherit' ? 'selected' : ''}>跟随全站设置</option>
          <option value="none" ${st.anim === 'none' ? 'selected' : ''}>无动效</option>
          <option value="fade-up" ${st.anim === 'fade-up' ? 'selected' : ''}>上浮淡入 (Fade Up)</option>
          <option value="fade-in" ${st.anim === 'fade-in' ? 'selected' : ''}>平滑渐显 (Fade In)</option>
          <option value="scale-in" ${st.anim === 'scale-in' ? 'selected' : ''}>轻盈缩放 (Scale In)</option>
          <option value="slide-left" ${st.anim === 'slide-left' ? 'selected' : ''}>右侧滑入 (Slide Left)</option>
          <option value="blur-in" ${st.anim === 'blur-in' ? 'selected' : ''}>景深渐清 (Blur In)</option>
        </select>
      </div>
      <div style="display:flex; justify-content:space-between; gap:6px; margin-top:4px;">
        <button type="button" class="ie-mini-btn" id="ie-bs-reset">恢复默认</button>
        <button type="button" class="ie-mini-btn active" id="ie-bs-done">完成</button>
      </div>
    `
    );

    const liveApply = async () => {
      applyBlockClassesToDom(secEl, block);
      const spanSel = secEl.querySelector('.ie-block-bar [data-act="span"]');
      if (spanSel) spanSel.value = String(block.style.span || 12);
      await saveCurrentEntity({ silent: true });
    };

    pop.querySelector('#ie-bs-span').addEventListener('change', (e) => {
      st.span = Number(e.target.value);
      liveApply();
    });
    pop.querySelector('#ie-bs-width').addEventListener('change', (e) => { st.width = e.target.value; liveApply(); });
    pop.querySelector('#ie-bs-surface').addEventListener('change', (e) => { st.surface = e.target.value; liveApply(); });
    pop.querySelector('#ie-bs-spacing').addEventListener('change', (e) => { st.spacing = e.target.value; liveApply(); });
    pop.querySelector('#ie-bs-scale').addEventListener('change', (e) => { st.scale = e.target.value; liveApply(); });
    pop.querySelector('#ie-bs-align').addEventListener('change', (e) => { st.align = e.target.value; liveApply(); });

    pop.querySelector('#ie-bs-anim').addEventListener('change', async (e) => {
      st.anim = e.target.value;
      await liveApply();
      replayBlockAnimation(secEl, st.anim);
    });
    pop.querySelector('#ie-bs-replay').addEventListener('click', () => {
      replayBlockAnimation(secEl, st.anim || 'fade-up');
    });

    pop.querySelector('#ie-bs-reset').addEventListener('click', async () => {
      delete block.style;
      applyBlockClassesToDom(secEl, block);
      replayBlockAnimation(secEl, 'none');
      closePopover();
      await saveCurrentEntity({ silent: true });
    });
    pop.querySelector('#ie-bs-done').addEventListener('click', closePopover);
  }

  function openLinkPopover(anchorEl, { title, label, href, onSave }) {
    const pop = createDraggablePopover(
      anchorEl,
      title,
      `
      <div class="ie-field">
        <label>文字（留空即删除/隐藏）</label>
        <input type="text" class="ie-input" id="ie-pop-label" value="${escHtml(label)}" />
      </div>
      <div class="ie-field">
        <label>链接地址</label>
        <input type="text" class="ie-input" id="ie-pop-href" value="${escHtml(href)}" placeholder="/works 或 https://..." />
      </div>
      <div style="display:flex; justify-content:space-between; gap:6px;">
        ${href ? `<a class="ie-mini-btn" href="${escHtml(href)}" target="_blank" rel="noreferrer">打开 ↗</a>` : '<span></span>'}
        <div style="display:flex; gap:6px;">
          <button type="button" class="ie-mini-btn" id="ie-pop-cancel">取消</button>
          <button type="button" class="ie-mini-btn active" id="ie-pop-save">确定</button>
        </div>
      </div>
    `
    );

    pop.querySelector('#ie-pop-cancel').addEventListener('click', closePopover);
    pop.querySelector('#ie-pop-save').addEventListener('click', async () => {
      const nextLabel = pop.querySelector('#ie-pop-label').value.trim();
      const nextHref = pop.querySelector('#ie-pop-href').value.trim();
      closePopover();
      await onSave({ label: nextLabel, href: nextHref });
    });
  }

  function openHeroButtonsPopover(anchorEl, block) {
    const p = block.data.primaryBtn || { label: '', href: '' };
    const s = block.data.secondaryBtn || { label: '', href: '' };
    const pop = createDraggablePopover(
      anchorEl,
      '配置 Hero 行动按钮',
      `
      <div class="ie-field"><label>主按钮文字（留空隐藏）</label><input class="ie-input" id="ie-hb-pl" value="${escHtml(p.label || '')}" /></div>
      <div class="ie-field"><label>主按钮链接</label><input class="ie-input" id="ie-hb-ph" value="${escHtml(p.href || '')}" /></div>
      <div class="ie-field"><label>次按钮文字（留空隐藏）</label><input class="ie-input" id="ie-hb-sl" value="${escHtml(s.label || '')}" /></div>
      <div class="ie-field"><label>次按钮链接</label><input class="ie-input" id="ie-hb-sh" value="${escHtml(s.href || '')}" /></div>
      <div style="display:flex; justify-content:flex-end; gap:6px;">
        <button type="button" class="ie-mini-btn" id="ie-pop-cancel">取消</button>
        <button type="button" class="ie-mini-btn active" id="ie-pop-save">保存</button>
      </div>
    `
    );

    pop.querySelector('#ie-pop-cancel').addEventListener('click', closePopover);
    pop.querySelector('#ie-pop-save').addEventListener('click', async () => {
      const pl = pop.querySelector('#ie-hb-pl').value.trim();
      const ph = pop.querySelector('#ie-hb-ph').value.trim();
      const sl = pop.querySelector('#ie-hb-sl').value.trim();
      const sh = pop.querySelector('#ie-hb-sh').value.trim();
      block.data.primaryBtn = pl ? { label: pl, href: ph || '#' } : null;
      block.data.secondaryBtn = sl ? { label: sl, href: sh || '#' } : null;
      closePopover();
      await saveCurrentEntity({ refreshAfter: true });
    });
  }

  function openSingleUrlPopover(anchorEl, { title, value, placeholder, onSave }) {
    const pop = createDraggablePopover(
      anchorEl,
      title,
      `
      <input type="text" class="ie-input" id="ie-pop-val" value="${escHtml(value)}" placeholder="${escHtml(placeholder || '')}" />
      <div style="display:flex; justify-content:space-between; gap:6px;">
        ${value ? `<a class="ie-mini-btn" href="${escHtml(value)}" target="_blank" rel="noreferrer">打开 ↗</a>` : '<span></span>'}
        <div style="display:flex; gap:6px;">
          <button type="button" class="ie-mini-btn" id="ie-pop-cancel">取消</button>
          <button type="button" class="ie-mini-btn active" id="ie-pop-save">保存</button>
        </div>
      </div>
    `
    );

    pop.querySelector('#ie-pop-cancel').addEventListener('click', closePopover);
    pop.querySelector('#ie-pop-save').addEventListener('click', async () => {
      const val = pop.querySelector('#ie-pop-val').value.trim();
      closePopover();
      await onSave(val);
    });
  }

  function openImagePopover(anchorEl, { value, onSave }) {
    const pop = createDraggablePopover(
      anchorEl,
      '设置卡片图片',
      `
      <input type="text" class="ie-input" id="ie-pop-img" value="${escHtml(value)}" placeholder="/assets/... 或 https://..." />
      <label class="ie-mini-btn" style="justify-content:center;">
        📷 上传本地图片到 content/assets
        <input type="file" accept="image/*" id="ie-pop-file" style="display:none;" />
      </label>
      <div style="display:flex; justify-content:flex-end; gap:6px;">
        <button type="button" class="ie-mini-btn" id="ie-pop-cancel">取消</button>
        <button type="button" class="ie-mini-btn active" id="ie-pop-save">应用</button>
      </div>
    `
    );

    pop.querySelector('#ie-pop-file').addEventListener('change', (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = async () => {
        const res = await api('/api/studio/upload', 'POST', { filename: f.name, data: r.result });
        pop.querySelector('#ie-pop-img').value = res.asset.url;
        toast('图片上传成功');
      };
      r.readAsDataURL(f);
    });

    pop.querySelector('#ie-pop-cancel').addEventListener('click', closePopover);
    pop.querySelector('#ie-pop-save').addEventListener('click', async () => {
      const val = pop.querySelector('#ie-pop-img').value.trim();
      closePopover();
      await onSave(val);
    });
  }

  function openBlockPickerModal(insertIndex) {
    closeModal();
    const page = getCurrentPageModel();
    if (!page) return;
    const backdrop = document.createElement('div');
    backdrop.className = 'ie-modal-backdrop';
    backdrop.innerHTML = `
      <div class="ie-modal">
        <div style="display:flex; align-items:center; justify-content:space-between;">
          <strong style="font-size:16px;">选择要插入的页面模块</strong>
          <button type="button" class="ie-mini-btn" id="ie-modal-close">✕</button>
        </div>
        <div class="ie-block-picker-grid">
          ${BLOCK_CATALOG.map(
            (b) => `<button type="button" class="ie-picker-item" data-pick-type="${b.type}">
              <div style="font-weight:600; font-size:14px;">${escHtml(b.title)}</div>
              <div style="font-size:12px; color:var(--ie-muted); margin-top:4px;">${escHtml(b.desc)}</div>
            </button>`
          ).join('')}
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);
    activeModal = backdrop;

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal();
    });
    backdrop.querySelector('#ie-modal-close').addEventListener('click', closeModal);
    backdrop.querySelectorAll('[data-pick-type]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const def = BLOCK_CATALOG.find((b) => b.type === btn.getAttribute('data-pick-type'));
        if (!def) return;
        const newBlock = def.create(workspace);
        page.blocks = page.blocks || [];
        page.blocks.splice(insertIndex, 0, newBlock);
        closeModal();
        await saveCurrentEntity({ refreshAfter: true });
      });
    });
  }

  function openNewPageModal() {
    closeModal();
    const backdrop = document.createElement('div');
    backdrop.className = 'ie-modal-backdrop';
    backdrop.innerHTML = `
      <div class="ie-modal" style="width:420px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <strong style="font-size:15px;">新建独立页面</strong>
          <button type="button" class="ie-mini-btn" id="ie-modal-close">✕</button>
        </div>
        <div style="display:flex; flex-direction:column; gap:10px;">
          <div class="ie-field">
            <label>URL 路径标识（英文字母/连字符，如 portfolio）</label>
            <input type="text" class="ie-input" id="ie-np-slug" placeholder="projects-hub" />
          </div>
          <div class="ie-field">
            <label>页面标题</label>
            <input type="text" class="ie-input" id="ie-np-title" placeholder="我的项目集" />
          </div>
          <div class="ie-field">
            <label>页面形态</label>
            <select class="ie-select" id="ie-np-kind">
              <option value="blocks">自由模块页（像首页一样拖拽组合模块）</option>
              <option value="markdown">纯 Markdown 文档页</option>
            </select>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:6px;">
            <button type="button" class="ie-mini-btn" id="ie-modal-cancel">取消</button>
            <button type="button" class="ie-mini-btn active" id="ie-np-submit">创建并打开编辑</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);
    activeModal = backdrop;
    backdrop.querySelector('#ie-modal-close').addEventListener('click', closeModal);
    backdrop.querySelector('#ie-modal-cancel').addEventListener('click', closeModal);
    backdrop.querySelector('#ie-np-submit').addEventListener('click', async () => {
      const slug = backdrop.querySelector('#ie-np-slug').value.trim().toLowerCase();
      const title = backdrop.querySelector('#ie-np-title').value.trim() || slug;
      const kind = backdrop.querySelector('#ie-np-kind').value;
      if (!slug) return toast('请填写 URL 标识');
      const payload =
        kind === 'blocks'
          ? {
              kind: 'blocks',
              title,
              description: '',
              blocks: [BLOCK_CATALOG[0].create(workspace)],
            }
          : {
              kind: 'markdown',
              title,
              description: '',
              data: { title, description: '' },
              body: `## ${title}\n\n在这里开始写作。`,
            };
      await api(`/api/studio/pages/${encodeURIComponent(slug)}`, 'PUT', payload);
      closeModal();
      location.href = slug === 'home' ? '/' : `/${slug}`;
    });
  }

  function openNewCollectionModal() {
    closeModal();
    const backdrop = document.createElement('div');
    backdrop.className = 'ie-modal-backdrop';
    backdrop.innerHTML = `
      <div class="ie-modal" style="width:420px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <strong style="font-size:15px;">新建自定义栏目</strong>
          <button type="button" class="ie-mini-btn" id="ie-modal-close">✕</button>
        </div>
        <div style="display:flex; flex-direction:column; gap:10px;">
          <div class="ie-field">
            <label>栏目 ID（英文字母/连字符，如 notes / photos / travel）</label>
            <input type="text" class="ie-input" id="ie-nc-id" placeholder="notes" />
          </div>
          <div class="ie-field">
            <label>栏目显示名称</label>
            <input type="text" class="ie-input" id="ie-nc-title" placeholder="随记灵感" />
          </div>
          <div class="ie-field">
            <label>默认展示形态</label>
            <select class="ie-select" id="ie-nc-view">
              <option value="grid">网格卡片 (Grid)</option>
              <option value="list">简洁列表 (List)</option>
              <option value="timeline">时间轴 (Timeline)</option>
            </select>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:6px;">
            <button type="button" class="ie-mini-btn" id="ie-modal-cancel">取消</button>
            <button type="button" class="ie-mini-btn active" id="ie-nc-submit">创建并前往</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);
    activeModal = backdrop;
    backdrop.querySelector('#ie-modal-close').addEventListener('click', closeModal);
    backdrop.querySelector('#ie-modal-cancel').addEventListener('click', closeModal);
    backdrop.querySelector('#ie-nc-submit').addEventListener('click', async () => {
      const id = backdrop.querySelector('#ie-nc-id').value.trim().toLowerCase();
      const title = backdrop.querySelector('#ie-nc-title').value.trim() || id;
      const defaultView = backdrop.querySelector('#ie-nc-view').value;
      if (!id) return toast('请填写栏目 ID');
      await api(`/api/studio/collections/${encodeURIComponent(id)}`, 'PUT', {
        title,
        description: '',
        defaultView,
        itemPrefix: '',
        sortBy: 'date',
      });
      closeModal();
      location.href = `/${id}`;
    });
  }

  function openNewItemModal(colId) {
    closeModal();
    const backdrop = document.createElement('div');
    backdrop.className = 'ie-modal-backdrop';
    backdrop.innerHTML = `
      <div class="ie-modal" style="width:420px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <strong style="font-size:15px;">在 “${escHtml(colId)}” 中新建条目</strong>
          <button type="button" class="ie-mini-btn" id="ie-modal-close">✕</button>
        </div>
        <div style="display:flex; flex-direction:column; gap:10px;">
          <div class="ie-field">
            <label>条目标题</label>
            <input type="text" class="ie-input" id="ie-ni-title" placeholder="例如：搭建本地引擎的笔记" />
          </div>
          <div class="ie-field">
            <label>URL 文件名（英文字母/连字符）</label>
            <input type="text" class="ie-input" id="ie-ni-slug" value="note-${Date.now().toString(36).slice(-4)}" />
          </div>
          <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:6px;">
            <button type="button" class="ie-mini-btn" id="ie-modal-cancel">取消</button>
            <button type="button" class="ie-mini-btn active" id="ie-ni-submit">创建并进入写作</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);
    activeModal = backdrop;
    backdrop.querySelector('#ie-modal-close').addEventListener('click', closeModal);
    backdrop.querySelector('#ie-modal-cancel').addEventListener('click', closeModal);
    backdrop.querySelector('#ie-ni-submit').addEventListener('click', async () => {
      const title = backdrop.querySelector('#ie-ni-title').value.trim() || '未命名内容';
      const slug = backdrop.querySelector('#ie-ni-slug').value.trim().toLowerCase();
      if (!slug) return toast('请填写文件名');
      await api(`/api/studio/items/${encodeURIComponent(colId)}/${encodeURIComponent(slug)}`, 'PUT', {
        data: {
          title,
          summary: '',
          date: new Date().toISOString().slice(0, 10),
          tags: [],
          draft: false,
        },
        body: `## 概要\n\n点击上方「✏️ 编辑正文」即可开始书写 **Markdown**。\n`,
      });
      closeModal();
      location.href = `/${colId}/${slug}`;
    });
  }

  function openCustomKvModal(item) {
    closeModal();
    const systemKeys = new Set(['title', 'summary', 'description', 'date', 'updated', 'status', 'tags', 'related', 'repoUrl', 'demoUrl', 'order', 'featured', 'draft']);
    const entries = Object.entries(item.data || {}).filter(([k]) => !systemKeys.has(k));

    const backdrop = document.createElement('div');
    backdrop.className = 'ie-modal-backdrop';
    backdrop.innerHTML = `
      <div class="ie-modal" style="width:460px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <strong style="font-size:15px;">自定义条目字段（任意键值对）</strong>
          <button type="button" class="ie-mini-btn" id="ie-modal-close">✕</button>
        </div>
        <p style="font-size:12px; color:var(--ie-muted); margin:0 0 10px;">支持任意前端属性（如 技术栈、耗时、评分、城市），会直接展示在文章顶部卡片中。</p>
        <div id="ie-kv-rows" style="display:flex; flex-direction:column; gap:8px;">
          ${entries
            .map(
              ([k, v]) => `<div style="display:flex; gap:6px;" data-kv-row>
                <input type="text" class="ie-input" data-kv-k value="${escHtml(k)}" placeholder="字段名" style="flex:1;" />
                <input type="text" class="ie-input" data-kv-v value="${escHtml(Array.isArray(v) ? v.join(', ') : String(v))}" placeholder="值" style="flex:1.4;" />
                <button type="button" class="ie-mini-btn danger" data-kv-del>✕</button>
              </div>`
            )
            .join('')}
        </div>
        <div style="display:flex; justify-content:space-between; margin-top:12px;">
          <button type="button" class="ie-mini-btn" id="ie-kv-add">＋ 新增一行</button>
          <div style="display:flex; gap:6px;">
            <button type="button" class="ie-mini-btn" id="ie-modal-cancel">取消</button>
            <button type="button" class="ie-mini-btn active" id="ie-kv-save">保存字段</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);
    activeModal = backdrop;

    const rowsEl = backdrop.querySelector('#ie-kv-rows');
    const wireDel = () => {
      rowsEl.querySelectorAll('[data-kv-del]').forEach((btn) => {
        btn.onclick = () => btn.closest('[data-kv-row]')?.remove();
      });
    };
    wireDel();

    backdrop.querySelector('#ie-kv-add').addEventListener('click', () => {
      const div = document.createElement('div');
      div.style.display = 'flex';
      div.style.gap = '6px';
      div.setAttribute('data-kv-row', '');
      div.innerHTML = `
        <input type="text" class="ie-input" data-kv-k placeholder="字段名（如 评分）" style="flex:1;" />
        <input type="text" class="ie-input" data-kv-v placeholder="字段值" style="flex:1.4;" />
        <button type="button" class="ie-mini-btn danger" data-kv-del>✕</button>
      `;
      rowsEl.appendChild(div);
      wireDel();
    });

    backdrop.querySelector('#ie-modal-close').addEventListener('click', closeModal);
    backdrop.querySelector('#ie-modal-cancel').addEventListener('click', closeModal);
    backdrop.querySelector('#ie-kv-save').addEventListener('click', async () => {
      for (const key of Object.keys(item.data)) {
        if (!systemKeys.has(key)) delete item.data[key];
      }
      rowsEl.querySelectorAll('[data-kv-row]').forEach((row) => {
        const k = row.querySelector('[data-kv-k]').value.trim();
        const v = row.querySelector('[data-kv-v]').value.trim();
        if (k && !systemKeys.has(k)) {
          item.data[k] = v;
        }
      });
      closeModal();
      await saveCurrentEntity({ refreshAfter: true });
    });
  }

  // ---------- Keyboard Shortcuts ----------
  document.addEventListener('keydown', async (e) => {
    if (e.key === 'Escape') {
      closePopover();
      closeModal();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
      e.preventDefault();
      await setEditMode(!editMode);
    } else if (editMode && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      try {
        await saveCurrentEntity();
        await saveSite({ silent: true });
      } catch (err) {
        toast(err.message);
      }
    }
  });

  // ---------- Init ----------
  async function init() {
    await loadState();
    buildChrome();
    if (editMode) {
      document.body.classList.add('inline-edit-active');
      decorateEditMode();
      renderDrawers();
      renderDock();
    }
  }

  init().catch((err) => console.error('Inline editor init error:', err));
})();
