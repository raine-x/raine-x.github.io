function sanitizeHexColor(hex, fallback = '#ea580c') {
  return /^#[0-9a-fA-F]{6}$/.test(String(hex || '')) ? hex : fallback;
}

const FONT_STACKS = {
  sans: `"Inter", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, -apple-system, sans-serif`,
  serif: `"Newsreader", "Songti SC", "Noto Serif SC", "STSong", Georgia, serif`,
  mono: `"JetBrains Mono", "Cascadia Code", "Fira Code", "PingFang SC", ui-monospace, monospace`,
};

const PRESET_VARS = {
  lab: {
    light: {
      bg: '#f7f6f2',
      surface: '#ffffff',
      surfaceAlt: '#efede7',
      text: '#18181b',
      muted: '#52525b',
      border: '#dcd8ce',
    },
    dark: {
      bg: '#111113',
      surface: '#18181b',
      surfaceAlt: '#222226',
      text: '#f4f4f5',
      muted: '#a1a1aa',
      border: '#2b2b31',
    },
  },
  paper: {
    light: {
      bg: '#fbf8f3',
      surface: '#fffdf9',
      surfaceAlt: '#f3ede3',
      text: '#231f20',
      muted: '#6b6257',
      border: '#e7dfd3',
    },
    dark: {
      bg: '#161412',
      surface: '#1d1a17',
      surfaceAlt: '#26221e',
      text: '#efe9e0',
      muted: '#a69b8d',
      border: '#322c26',
    },
  },
  bento: {
    light: {
      bg: '#f4f5f7',
      surface: '#ffffff',
      surfaceAlt: '#eceff3',
      text: '#0f172a',
      muted: '#475569',
      border: '#e2e8f0',
    },
    dark: {
      bg: '#090b10',
      surface: '#11141c',
      surfaceAlt: '#191e29',
      text: '#f8fafc',
      muted: '#94a3b8',
      border: '#1f2633',
    },
  },
  mono: {
    light: {
      bg: '#ffffff',
      surface: '#fafafa',
      surfaceAlt: '#f0f0f0',
      text: '#09090b',
      muted: '#52525b',
      border: '#18181b',
    },
    dark: {
      bg: '#050505',
      surface: '#0d0d0d',
      surfaceAlt: '#161616',
      text: '#fafafa',
      muted: '#a1a1aa',
      border: '#3f3f46',
    },
  },
};

function sanitizePx(val, min, max, fallback) {
  const num = parseInt(String(val ?? ''), 10);
  if (Number.isFinite(num) && num >= min && num <= max) return `${num}px`;
  return fallback;
}

export function generateThemeCss(siteTheme = {}) {
  const presetName = PRESET_VARS[siteTheme.preset] ? siteTheme.preset : 'lab';
  const preset = PRESET_VARS[presetName];
  const accent = sanitizeHexColor(siteTheme.accent, '#ea580c');
  const font = FONT_STACKS[siteTheme.font] ? FONT_STACKS[siteTheme.font] : FONT_STACKS.sans;
  const fontSize = sanitizePx(siteTheme.fontSize, 13, 22, '16px');
  const maxWidth = sanitizePx(siteTheme.maxWidth, 680, 1480, '960px');
  const radius =
    siteTheme.radius !== undefined && siteTheme.radius !== ''
      ? sanitizePx(siteTheme.radius, 0, 36, '10px')
      : presetName === 'mono'
        ? '0px'
        : '10px';

  const custom = siteTheme.customColors || {};
  const lightBg = sanitizeHexColor(custom.bg || custom.lightBg, preset.light.bg);
  const lightSurface = sanitizeHexColor(custom.surface, preset.light.surface);
  const lightText = sanitizeHexColor(custom.text || custom.lightFg, preset.light.text);
  const lightBorder = sanitizeHexColor(custom.border, preset.light.border);
  const darkBg = sanitizeHexColor(custom.darkBg, preset.dark.bg);
  const darkSurface = sanitizeHexColor(custom.darkSurface, preset.dark.surface);
  const darkText = sanitizeHexColor(custom.darkText || custom.darkFg, preset.dark.text);
  const darkBorder = sanitizeHexColor(custom.darkBorder, preset.dark.border);

  const bgPattern = siteTheme.bgPattern || (presetName === 'lab' ? 'grid' : 'none');
  const cardStyle = siteTheme.cardStyle || 'border';
  const headerSticky = siteTheme.headerSticky !== false;
  const headerStyle = ['split', 'centered', 'minimal'].includes(siteTheme.headerStyle)
    ? siteTheme.headerStyle
    : 'split';

  let patternCss = '';
  if (bgPattern === 'grid') {
    patternCss = `body {
  background-image:
    linear-gradient(to right, color-mix(in srgb, var(--border) 38%, transparent) 1px, transparent 1px),
    linear-gradient(to bottom, color-mix(in srgb, var(--border) 38%, transparent) 1px, transparent 1px);
  background-size: 36px 36px;
}`;
  } else if (bgPattern === 'dots') {
    patternCss = `body {
  background-image: radial-gradient(color-mix(in srgb, var(--border) 75%, transparent) 1px, transparent 1px);
  background-size: 22px 22px;
}`;
  } else if (bgPattern === 'gradient') {
    patternCss = `body {
  background-image:
    radial-gradient(65% 45% at 15% -5%, color-mix(in srgb, var(--accent) 16%, transparent), transparent 70%),
    radial-gradient(50% 40% at 88% 4%, color-mix(in srgb, var(--accent) 11%, transparent), transparent 70%);
  background-repeat: no-repeat;
}`;
  }

  let cardSurfaceCss = 'background: var(--surface); border: 1px solid var(--border);';
  if (cardStyle === 'shadow') {
    cardSurfaceCss =
      'background: var(--surface); border: 1px solid color-mix(in srgb, var(--border) 55%, transparent); box-shadow: 0 6px 24px rgba(15, 23, 42, 0.06);';
  } else if (cardStyle === 'glass') {
    cardSurfaceCss =
      'background: color-mix(in srgb, var(--surface) 74%, transparent); backdrop-filter: blur(12px); border: 1px solid color-mix(in srgb, var(--border) 75%, transparent);';
  } else if (cardStyle === 'flat') {
    cardSurfaceCss =
      'background: var(--surface-alt); border: 1px solid transparent;';
  }

  let headerExtraCss = '';
  if (headerStyle === 'centered') {
    headerExtraCss = `.header-inner { flex-direction: column; padding: 12px 20px; gap: 10px; }`;
  } else if (headerStyle === 'minimal') {
    headerExtraCss = `.site-header { border-bottom-color: transparent; background: transparent; backdrop-filter: none; }`;
  }

  const userCustomCss = String(siteTheme.customCss || '').replace(/<\/style>/gi, '');

  return `
:root {
  --bg: ${lightBg};
  --surface: ${lightSurface};
  --surface-alt: ${preset.light.surfaceAlt};
  --text: ${lightText};
  --muted: ${preset.light.muted};
  --border: ${lightBorder};
  --accent: ${accent};
  --accent-soft: color-mix(in srgb, ${accent} 12%, transparent);
  --font-main: ${font};
  --font-mono: ${FONT_STACKS.mono};
  --font-size: ${fontSize};
  --max-width: ${maxWidth};
  --radius: ${radius};
}

html.dark {
  --bg: ${darkBg};
  --surface: ${darkSurface};
  --surface-alt: ${preset.dark.surfaceAlt};
  --text: ${darkText};
  --muted: ${preset.dark.muted};
  --border: ${darkBorder};
  --accent-soft: color-mix(in srgb, ${accent} 18%, transparent);
}

*, *::before, *::after { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--bg);
  color: var(--text);
  font-family: var(--font-main);
  font-size: var(--font-size);
  line-height: 1.65;
  -webkit-font-smoothing: antialiased;
  transition: background-color 0.2s ease, color 0.2s ease;
}

${patternCss}

a { color: inherit; text-decoration: none; }
img { max-width: 100%; border-radius: var(--radius); }
button { font-family: inherit; cursor: pointer; }

.container {
  width: 100%;
  max-width: var(--max-width);
  margin: 0 auto;
  padding: 0 20px;
}

.site-header {
  position: ${headerSticky ? 'sticky' : 'relative'};
  top: 0;
  z-index: 40;
  backdrop-filter: blur(12px);
  background: color-mix(in srgb, var(--bg) 86%, transparent);
  border-bottom: 1px solid var(--border);
}

.header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 60px;
}
${headerExtraCss}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.brand-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: calc(var(--radius) * 0.7);
  background: var(--text);
  color: var(--bg);
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 700;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.nav-link {
  padding: 6px 11px;
  border-radius: calc(var(--radius) * 0.75);
  font-size: 14px;
  font-weight: 500;
  color: var(--muted);
  transition: background-color 0.15s ease, color 0.15s ease;
}

.nav-link:hover, .nav-link.active {
  color: var(--text);
  background: var(--surface-alt);
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 10px;
  border-radius: calc(var(--radius) * 0.75);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--muted);
  font-size: 12px;
  font-weight: 500;
  transition: border-color 0.15s ease, color 0.15s ease;
}

.icon-btn:hover {
  color: var(--text);
  border-color: var(--text);
}

.studio-pill {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-soft);
}

.site-main {
  flex: 1;
  padding: 40px 0 64px;
}

.site-footer {
  border-top: 1px solid var(--border);
  padding: 28px 0;
  font-size: 13px;
  color: var(--muted);
  background: color-mix(in srgb, var(--bg) 92%, transparent);
}

.footer-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.footer-links {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.footer-links a:hover { color: var(--text); }

/* Blocks */
.block-section { margin-bottom: 52px; }
.block-section:last-child { margin-bottom: 0; }

.section-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.section-title {
  margin: 0;
  font-size: 21px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.section-sub {
  margin: 4px 0 0;
  font-size: 14px;
  color: var(--muted);
}

.more-link {
  font-size: 13px;
  font-weight: 600;
  color: var(--accent);
}
.more-link:hover { text-decoration: underline; }

.hero-box {
  padding: ${presetName === 'paper' ? '24px 0 36px' : '36px'};
  ${presetName === 'paper' ? 'border: none; border-bottom: 1px solid var(--border); background: transparent;' : `${cardSurfaceCss} border-radius: var(--radius);`}
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface-alt);
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  color: var(--muted);
}

.hero-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent);
}

.hero-title {
  margin: 18px 0 0;
  font-size: clamp(28px, 5vw, 42px);
  line-height: 1.18;
  letter-spacing: -0.03em;
  font-weight: 800;
}

.hero-sub {
  margin: 14px 0 0;
  max-width: 660px;
  font-size: 16px;
  color: var(--muted);
}

.hero-actions {
  margin-top: 24px;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 9px 16px;
  border-radius: calc(var(--radius) * 0.85);
  font-size: 14px;
  font-weight: 600;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  transition: transform 0.15s ease, border-color 0.15s ease, background-color 0.15s ease;
}

.btn:hover { transform: translateY(-1px); border-color: var(--text); }
.btn-primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #ffffff;
}
.btn-primary:hover {
  border-color: var(--accent);
  filter: brightness(1.06);
}

/* Grids & Cards */
.grid-2 { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
.grid-3 { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); }
.grid-4 { display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); }

.card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 20px;
  border-radius: var(--radius);
  ${cardSurfaceCss}
  transition: transform 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease;
}

.card:hover {
  border-color: color-mix(in srgb, var(--accent) 55%, var(--border));
  transform: translateY(-2px);
}

.card-kicker {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--muted);
}

.card-title {
  margin: 10px 0 0;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.015em;
}

.card-title a:hover { color: var(--accent); }

.card-desc {
  margin: 8px 0 0;
  font-size: 14px;
  color: var(--muted);
}

.bento-value {
  margin: 8px 0 0;
  font-size: 17px;
  font-weight: 700;
}

.stat-value {
  font-size: clamp(24px, 4vw, 34px);
  font-weight: 800;
  letter-spacing: -0.03em;
  color: var(--accent);
}

.gallery-img {
  width: 100%;
  aspect-ratio: 16 / 10;
  object-fit: cover;
  border-radius: calc(var(--radius) * 0.75);
  border: 1px solid var(--border);
  margin-bottom: 12px;
}

.tag-row {
  margin-top: 14px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.pill {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: calc(var(--radius) * 0.6);
  background: var(--surface-alt);
  border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
  font-size: 12px;
  color: var(--muted);
}

.pill-accent {
  background: var(--accent-soft);
  border-color: transparent;
  color: var(--accent);
  font-weight: 600;
}

/* List & Timeline Views */
.list-stack { display: flex; flex-direction: column; gap: 12px; }

.list-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 20px;
  border-radius: var(--radius);
  ${cardSurfaceCss}
  transition: border-color 0.15s ease;
}

.list-row:hover { border-color: color-mix(in srgb, var(--accent) 55%, var(--border)); }

.timeline {
  position: relative;
  padding-left: 22px;
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 22px;
}

.timeline-item {
  position: relative;
  padding: 16px 18px;
  border-radius: var(--radius);
  ${cardSurfaceCss}
}

.timeline-item::before {
  content: "";
  position: absolute;
  left: -27px;
  top: 22px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 0 3px var(--bg);
}

/* Filters & Toolbar */
.toolbar-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 18px;
  flex-wrap: wrap;
}

.filter-pills { display: flex; gap: 8px; flex-wrap: wrap; }
.filter-btn {
  padding: 5px 12px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--muted);
  font-size: 12px;
  font-weight: 500;
}
.filter-btn.active {
  background: var(--text);
  color: var(--bg);
  border-color: var(--text);
}

/* Article / Prose */
.page-header {
  padding-bottom: 24px;
  margin-bottom: 28px;
  border-bottom: 1px solid var(--border);
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--muted);
  margin-bottom: 14px;
}
.back-link:hover { color: var(--text); }

.meta-kv-grid {
  margin-top: 16px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.meta-kv-item {
  padding: 6px 12px;
  border-radius: calc(var(--radius) * 0.7);
  border: 1px solid var(--border);
  background: var(--surface);
  font-size: 12.5px;
}
.meta-kv-item span { color: var(--muted); margin-right: 6px; }

.toc-box {
  margin-bottom: 28px;
  padding: 16px 18px;
  border-radius: var(--radius);
  ${cardSurfaceCss}
}
.toc-box summary { font-size: 14px; font-weight: 700; cursor: pointer; }
.toc-list { margin: 10px 0 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 6px; font-size: 13px; }
.toc-list li.depth-3 { padding-left: 16px; }
.toc-list a { color: var(--muted); }
.toc-list a:hover { color: var(--accent); }

.prose {
  font-size: 16px;
  line-height: 1.78;
  max-width: 76ch;
}
.prose h2, .prose h3, .prose h4 {
  margin-top: 1.9em;
  margin-bottom: 0.65em;
  line-height: 1.3;
  letter-spacing: -0.02em;
  scroll-margin-top: 84px;
}
.prose h2 { font-size: 1.45em; border-bottom: 1px solid var(--border); padding-bottom: 0.3em; }
.prose h3 { font-size: 1.18em; }
.prose .heading-anchor {
  opacity: 0;
  margin-right: 6px;
  color: var(--accent);
  font-weight: 400;
  transition: opacity 0.15s ease;
}
.prose h2:hover .heading-anchor,
.prose h3:hover .heading-anchor { opacity: 1; }
.prose p { margin: 1em 0; }
.prose ul, .prose ol { margin: 1em 0; padding-left: 1.5em; }
.prose li { margin: 0.35em 0; }
.prose a { color: var(--accent); text-decoration: underline; text-underline-offset: 3px; }
.prose blockquote {
  margin: 1.4em 0;
  padding: 4px 16px;
  border-left: 3px solid var(--accent);
  color: var(--muted);
  background: var(--surface-alt);
  border-radius: 0 calc(var(--radius) * 0.6) calc(var(--radius) * 0.6) 0;
}
.prose :not(pre) > code {
  font-family: var(--font-mono);
  font-size: 0.875em;
  padding: 2px 6px;
  border-radius: 5px;
  background: var(--surface-alt);
  border: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
}
.prose table {
  width: 100%;
  border-collapse: collapse;
  margin: 1.4em 0;
  font-size: 14px;
}
.prose th, .prose td {
  border: 1px solid var(--border);
  padding: 8px 12px;
  text-align: left;
}
.prose th { background: var(--surface-alt); font-weight: 600; }

.code-block {
  margin: 1.4em 0;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  background: var(--surface);
}
.code-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  background: var(--surface-alt);
  border-bottom: 1px solid var(--border);
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--muted);
}
.copy-code-btn {
  margin-left: auto;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--muted);
  border-radius: 6px;
  padding: 2px 8px;
  font-size: 11px;
}
.copy-code-btn:hover { color: var(--text); }
.code-block pre {
  margin: 0;
  padding: 14px 16px;
  overflow-x: auto;
  font-family: var(--font-mono);
  font-size: 13.5px;
  line-height: 1.6;
}

/* Callouts */
.callout {
  margin: 1.4em 0;
  padding: 14px 16px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  border-left-width: 4px;
  background: var(--surface);
}
.callout-title { font-weight: 700; font-size: 14px; margin-bottom: 4px; }
.callout-body p:first-child { margin-top: 0; }
.callout-body p:last-child { margin-bottom: 0; }
.callout-note { border-left-color: #3b82f6; }
.callout-tip { border-left-color: #10b981; }
.callout-important { border-left-color: #8b5cf6; }
.callout-warning { border-left-color: #f59e0b; }
.callout-caution { border-left-color: #ef4444; }

/* Highlight.js light/dark tokens */
.hljs { color: var(--text); background: transparent; }
.hljs-comment, .hljs-quote { color: #6e7781; font-style: italic; }
.hljs-keyword, .hljs-selector-tag, .hljs-subst { color: #cf222e; }
.hljs-string, .hljs-doctag, .hljs-attr { color: #0a3069; }
.hljs-title, .hljs-section, .hljs-function { color: #8250df; }
.hljs-number, .hljs-literal, .hljs-variable { color: #0550ae; }
html.dark .hljs-comment, html.dark .hljs-quote { color: #8b949e; }
html.dark .hljs-keyword, html.dark .hljs-selector-tag, html.dark .hljs-subst { color: #ff7b72; }
html.dark .hljs-string, html.dark .hljs-doctag, html.dark .hljs-attr { color: #a5d6ff; }
html.dark .hljs-title, html.dark .hljs-section, html.dark .hljs-function { color: #d2a8ff; }
html.dark .hljs-number, html.dark .hljs-literal, html.dark .hljs-variable { color: #79c0ff; }

/* Command Search Modal */
.cmd-backdrop {
  position: fixed;
  inset: 0;
  z-index: 90;
  background: rgba(0, 0, 0, 0.48);
  backdrop-filter: blur(4px);
  display: none;
  align-items: flex-start;
  justify-content: center;
  padding-top: 12vh;
}
.cmd-backdrop.open { display: flex; }
.cmd-dialog {
  width: min(560px, 92vw);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  overflow: hidden;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.25);
}
.cmd-input {
  width: 100%;
  padding: 14px 16px;
  border: none;
  border-bottom: 1px solid var(--border);
  background: transparent;
  color: var(--text);
  font-size: 15px;
  outline: none;
}
.cmd-results {
  max-height: 340px;
  overflow-y: auto;
  padding: 8px;
}
.cmd-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-radius: calc(var(--radius) * 0.7);
  font-size: 14px;
}
.cmd-item:hover { background: var(--surface-alt); }
.cmd-meta { font-size: 12px; color: var(--muted); font-family: var(--font-mono); }

.hidden { display: none !important; }

/* 12-Column Parallel Block Canvas */
.blocks-canvas {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  column-gap: 24px;
  row-gap: 0;
  align-items: start;
}
.blk-span-12 { grid-column: span 12; width: 100%; }
.blk-span-8 { grid-column: span 8; width: 100%; }
.blk-span-6 { grid-column: span 6; width: 100%; }
.blk-span-4 { grid-column: span 4; width: 100%; }
.blk-span-6 .grid-3, .blk-span-6 .grid-4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.blk-span-4 .grid-2, .blk-span-4 .grid-3, .blk-span-4 .grid-4 { grid-template-columns: 1fr; }

/* Per-block & per-card customization helpers */
.blk-w-compact { max-width: 720px; margin-left: auto; margin-right: auto; }
.blk-w-wide { max-width: calc(var(--max-width) + 140px); margin-left: auto; margin-right: auto; }
.blk-sp-tight { margin-bottom: 24px; }
.blk-sp-spacious { margin-bottom: 84px; }
.blk-bg-surface { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 28px; }
.blk-bg-subtle { background: var(--surface-alt); border-radius: var(--radius); padding: 28px; }
.blk-bg-accent { background: var(--accent-soft); border: 1px solid color-mix(in srgb, var(--accent) 26%, transparent); border-radius: var(--radius); padding: 28px; }
.blk-bg-outline { border: 1.5px solid var(--border); border-radius: var(--radius); padding: 28px; }
.blk-bg-surface .hero-box,
.blk-bg-subtle .hero-box,
.blk-bg-accent .hero-box,
.blk-bg-outline .hero-box {
  background: transparent;
  border: none;
  box-shadow: none;
  padding: 8px 4px;
}
.blk-align-center { text-align: center; }
.blk-align-center .section-head { justify-content: center; text-align: center; }
.blk-align-center .hero-actions { justify-content: center; }
.blk-scale-sm { font-size: 0.92em; }
.blk-scale-lg { font-size: 1.08em; }
.card-span-2 { grid-column: span 2; }
.card-highlight { border-color: var(--accent); background: linear-gradient(180deg, var(--accent-soft), var(--surface)); }
.blk-divider { display: flex; align-items: center; gap: 14px; padding: 6px 0; color: var(--muted); font-size: 12px; font-family: var(--font-mono); }
.blk-divider-line { flex: 1; height: 1px; background: var(--border); }

/* Motion / Entrance Animations */
@keyframes ieAnimFadeUp {
  from { opacity: 0; transform: translateY(22px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes ieAnimFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes ieAnimScaleIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes ieAnimSlideLeft {
  from { opacity: 0; transform: translateX(26px); }
  to { opacity: 1; transform: translateX(0); }
}
@keyframes ieAnimBlurIn {
  from { opacity: 0; filter: blur(8px); transform: translateY(10px); }
  to { opacity: 1; filter: blur(0); transform: translateY(0); }
}

html.js-anim [data-anim]:not(.is-visible) { opacity: 0; }
body.inline-edit-active [data-anim] { opacity: 1 !important; }
[data-anim="fade-up"].is-visible { animation: ieAnimFadeUp 0.55s cubic-bezier(0.22, 1, 0.36, 1) both; }
[data-anim="fade-in"].is-visible { animation: ieAnimFadeIn 0.5s ease both; }
[data-anim="scale-in"].is-visible { animation: ieAnimScaleIn 0.48s cubic-bezier(0.22, 1, 0.36, 1) both; }
[data-anim="slide-left"].is-visible { animation: ieAnimSlideLeft 0.55s cubic-bezier(0.22, 1, 0.36, 1) both; }
[data-anim="blur-in"].is-visible { animation: ieAnimBlurIn 0.6s cubic-bezier(0.22, 1, 0.36, 1) both; }
${siteTheme.hoverLift === false ? '.card:hover, .btn:hover { transform: none !important; }' : '.card { transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease; } .card:hover { transform: translateY(-2px); }'}

/* Polished 404 Page */
.not-found-wrap {
  max-width: 760px;
  margin: 12px auto 8px;
}
.not-found-hero {
  position: relative;
  overflow: hidden;
  text-align: center;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 46px 36px 38px;
  box-shadow: var(--shadow);
}
.not-found-hero::before {
  content: '';
  position: absolute;
  inset: -40% -20% auto;
  height: 220px;
  background: radial-gradient(ellipse at top, var(--accent-soft), transparent 70%);
  pointer-events: none;
}
.not-found-hero > * {
  position: relative;
}
.not-found-code {
  font-size: clamp(68px, 14vw, 118px);
  font-weight: 800;
  line-height: 0.94;
  letter-spacing: -0.05em;
  margin: 14px 0 10px;
  background: linear-gradient(180deg, var(--text) 18%, color-mix(in srgb, var(--accent) 52%, var(--muted)) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.not-found-title {
  font-size: clamp(22px, 3vw, 28px);
  font-weight: 700;
  letter-spacing: -0.02em;
  margin: 0 0 10px;
}
.not-found-desc {
  color: var(--muted);
  font-size: 15px;
  max-width: 46ch;
  margin: 0 auto 18px;
  line-height: 1.7;
}
.not-found-path {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: 100%;
  padding: 5px 13px;
  border-radius: 999px;
  background: var(--surface-alt);
  border: 1px solid var(--border);
  color: var(--muted);
  font-size: 12px;
  font-family: var(--font-mono);
  margin-bottom: 24px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.not-found-path code {
  background: transparent;
  padding: 0;
  color: var(--text);
  font-weight: 600;
}
.not-found-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
}
.not-found-directory {
  margin-top: 26px;
}
.not-found-dir-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  font-size: 12px;
  font-family: var(--font-mono);
  color: var(--muted);
}
.not-found-dir-head::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border);
}
.not-found-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 10px;
}
.not-found-link-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 13px 16px;
  border-radius: var(--radius);
  background: var(--surface);
  border: 1px solid var(--border);
  transition: border-color 0.16s ease, transform 0.16s ease;
}
.not-found-link-card:hover {
  border-color: var(--accent);
  transform: translateY(-2px);
}
.nf-card-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.nf-card-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.nf-card-sub {
  font-size: 12px;
  color: var(--muted);
  font-family: var(--font-mono);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.nf-card-arrow {
  font-size: 13px;
  color: var(--muted);
  flex-shrink: 0;
  transition: transform 0.16s ease, color 0.16s ease;
}
.not-found-link-card:hover .nf-card-arrow {
  color: var(--accent);
  transform: translateX(3px);
}
.not-found-recent {
  margin-top: 14px;
  padding: 8px 18px;
  border-radius: var(--radius);
  background: var(--surface);
  border: 1px solid var(--border);
}
.not-found-recent-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
  font-size: 14px;
}
.not-found-recent-row:last-child {
  border-bottom: none;
}
.not-found-recent-row:hover .nf-recent-title {
  color: var(--accent);
}
.nf-recent-title {
  font-weight: 500;
  color: var(--text);
  transition: color 0.15s ease;
}
.nf-recent-meta {
  font-size: 12px;
  color: var(--muted);
  font-family: var(--font-mono);
  flex-shrink: 0;
}

@media (max-width: 860px) {
  .blk-span-8, .blk-span-6, .blk-span-4 { grid-column: span 12; }
  .blk-span-6 .grid-3, .blk-span-6 .grid-4,
  .blk-span-4 .grid-2, .blk-span-4 .grid-3, .blk-span-4 .grid-4 {
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  }
}
@media (max-width: 720px) {
  .card-span-2 { grid-column: span 1; }
}
@media (max-width: 640px) {
  .list-row { flex-direction: column; }
  .hero-box { padding: ${presetName === 'paper' ? '16px 0 28px' : '24px 20px'}; }
}

${userCustomCss}
`.trim();
}
